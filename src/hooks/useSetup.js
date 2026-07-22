import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getStoredLogs, clearLogs, writeLog } from '../lib/logger';

const FAILSAFE_METHODS = ['default', 'slot0', 'slot1', 'generic', 'root_service'];

/**
 * JSDoc: Custom hook for the Setup tab features.
 * Separates business logic from the UI view for SIM slot choice,
 * device metrics, log downloading, and failsafe dial retries.
 */
export function useSetup() {
  const [adbStatus, setAdbStatus] = useState('{"status":"disconnected"}');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [nowTime, setNowTime] = useState(() => Date.now());
  const [logs, setLogs] = useState(() => getStoredLogs());
  const [isTestPopupOpen, setIsTestPopupOpen] = useState(false);
  const [failsafeIndex, setFailsafeIndex] = useState(0);
  const [localSimSlot, setLocalSimSlot] = useState(null);
  const [callingMethod, setCallingMethod] = useState(() => localStorage.getItem('aerodial_calling_method') || 'default');

  // Keep nowTime updated for heartbeat check
  useEffect(() => {
    const interval = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial system state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const { data } = await supabase.from('system_state').select('*').eq('id', 1).single();
        if (data) {
          setAdbStatus(data.adb_status);
          setUpdatedAt(data.updated_at);
          if (typeof data.default_sim_slot === 'number') {
            setLocalSimSlot(data.default_sim_slot);
          }
        }
      } catch (err) {
        console.error('Error fetching system state:', err);
      }
    };
    fetchState();

    const stateSubscription = supabase.channel('setup_state_sub')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_state' }, (payload) => {
        setAdbStatus(payload.new.adb_status);
        setUpdatedAt(payload.new.updated_at);
        if (typeof payload.new.default_sim_slot === 'number') {
          setLocalSimSlot(payload.new.default_sim_slot);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stateSubscription);
    };
  }, []);

  // Sync log messages from local storage
  const syncLogs = useCallback(() => {
    setLogs(getStoredLogs());
  }, []);

  useEffect(() => {
    window.addEventListener('aerodial_logs_updated', syncLogs);
    return () => {
      window.removeEventListener('aerodial_logs_updated', syncLogs);
    };
  }, [syncLogs]);

  // Decode JSON status
  let parsedStatus = { status: 'disconnected', sim_cards: [] };
  try {
    if (adbStatus && adbStatus.startsWith('{')) {
      parsedStatus = JSON.parse(adbStatus);
    } else if (adbStatus === 'disconnected') {
      parsedStatus = { status: 'disconnected', sim_cards: [] };
    } else {
      // Legacy compatibility format parsing
      const isRoot = adbStatus.includes('root:1');
      const isTruecaller = adbStatus.includes('truecaller:1');
      const isWhatsapp = adbStatus.includes('whatsapp:1');
      const brandMatch = adbStatus.match(/brand:([^|]+)/);
      const osMatch = adbStatus.match(/os:([^|]+)/);
      const modelMatch = adbStatus.match(/model:([^|]+)/);
      parsedStatus = {
        status: adbStatus.startsWith('connected') ? 'connected' : 'disconnected',
        is_root: isRoot,
        truecaller: isTruecaller,
        whatsapp: isWhatsapp,
        brand: brandMatch ? brandMatch[1] : 'Unknown',
        model: modelMatch ? modelMatch[1] : '',
        os_name: osMatch ? osMatch[1] : 'Android',
        dialer_details: 'Standard Dialer',
        phone_support: 'Fully Supported',
        sim_cards: [],
        default_sim_slot: 0
      };
    }
  } catch (e) {
    console.error('Error decoding adbStatus JSON:', e);
  }

  // Inject optimistic SIM slot
  if (localSimSlot !== null) {
    parsedStatus.default_sim_slot = localSimSlot;
  }

  const timeDiff = updatedAt ? Math.abs(nowTime - new Date(updatedAt).getTime()) : 999999;
  const isHeartbeatValid = timeDiff < 15000;
  const isPythonRunning = isHeartbeatValid;
  const isDeviceConnected = parsedStatus.status === 'connected' && isHeartbeatValid;

  // Change default SIM card slot configuration
  const selectDefaultSimSlot = useCallback(async (slotIndex) => {
    setLocalSimSlot(slotIndex); // Optimistically set immediately!
    try {
      writeLog('INFO', `User changed default SIM slot to: Slot ${slotIndex + 1}`);
      await supabase.from('system_state').update({ default_sim_slot: slotIndex }).eq('id', 1);
    } catch (err) {
      console.error('Failed to update default SIM slot', err);
    }
  }, []);

  const updateCallingMethod = useCallback((method) => {
    setCallingMethod(method);
    localStorage.setItem('aerodial_calling_method', method);
    writeLog('INFO', `User changed default calling method to: ${method}`);
  }, []);

  // Queue a 197 test call utilizing failsafe options
  const triggerTestCall = useCallback(async (methodIndex = null) => {
    try {
      const activeMethod = methodIndex !== null ? FAILSAFE_METHODS[methodIndex] : (localStorage.getItem('aerodial_calling_method') || 'default');
      const actualIndex = methodIndex !== null ? methodIndex : FAILSAFE_METHODS.indexOf(activeMethod);
      writeLog('INFO', `Triggering 197 test call. Failsafe Method: ${activeMethod}`);
      await supabase.from('call_queue').insert([{ 
        number: `197#${activeMethod}`, 
        status: 'dialing' 
      }]);
      setIsTestPopupOpen(true);
      setFailsafeIndex(actualIndex >= 0 ? actualIndex : 0);
    } catch (err) {
      writeLog('ERROR', `Failed to queue test call: ${err.message}`);
    }
  }, []);

  const handleFailsafeRetry = useCallback(() => {
    const nextIndex = failsafeIndex + 1;
    if (nextIndex < FAILSAFE_METHODS.length) {
      writeLog('WARN', `Test unsuccessful. Retrying with failsafe method: ${FAILSAFE_METHODS[nextIndex]}`);
      triggerTestCall(nextIndex);
    } else {
      writeLog('ERROR', 'All dialer failsafe methods exhausted without success.');
      setIsTestPopupOpen(false);
      alert('All connection methods failed. Please inspect logs or check phone dialer settings.');
    }
  }, [failsafeIndex, triggerTestCall]);

  const handleTestSuccess = useCallback(() => {
    writeLog('INFO', 'Test call confirmed successful by user.');
    setIsTestPopupOpen(false);
  }, []);

  const exportLogs = useCallback(() => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aerodial_logs_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      writeLog('INFO', 'Logs exported/downloaded by user.');
    } catch (err) {
      writeLog('ERROR', `Failed to export logs: ${err.message}`);
    }
  }, [logs]);

  const installTruecaller = useCallback(async () => {
    try {
      writeLog('INFO', 'Initiated Truecaller APK installation via ADB.');
      const command = JSON.stringify({ action: 'install_truecaller' });
      await supabase.from('system_state').update({ command }).eq('id', 1);
    } catch (err) {
      writeLog('ERROR', `Failed to send Truecaller install command: ${err.message}`);
    }
  }, []);

  const connectWirelessAdb = useCallback(async (ipAddress) => {
    if (!ipAddress || !ipAddress.trim()) {
      alert('Please enter a valid IP address.');
      return;
    }
    try {
      writeLog('INFO', `Initiated wireless ADB connection to IP: ${ipAddress}`);
      const command = JSON.stringify({ action: 'connect_wireless_adb', ip: ipAddress.trim() });
      await supabase.from('system_state').update({ command }).eq('id', 1);
    } catch (err) {
      writeLog('ERROR', `Failed to send wireless connect command: ${err.message}`);
    }
  }, []);

  const uploadMedia = useCallback(async (file) => {
    if (!file) return;
    try {
      writeLog('INFO', `Uploading media file to device: ${file.name}`);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const command = JSON.stringify({
          action: 'upload_media',
          filename: file.name,
          file_base64: base64Data
        });
        await supabase.from('system_state').update({ command }).eq('id', 1);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      writeLog('ERROR', `Failed to upload media: ${err.message}`);
    }
  }, []);

  const deleteMedia = useCallback(async (filename) => {
    if (!filename) return;
    try {
      writeLog('INFO', `Requesting media file deletion: ${filename}`);
      const command = JSON.stringify({
        action: 'delete_media',
        filename
      });
      await supabase.from('system_state').update({ command }).eq('id', 1);
    } catch (err) {
      writeLog('ERROR', `Failed to delete media: ${err.message}`);
    }
  }, []);

  return {
    parsedStatus,
    isPythonRunning,
    isDeviceConnected,
    logs,
    clearLogs,
    selectDefaultSimSlot,
    triggerTestCall,
    isTestPopupOpen,
    setIsTestPopupOpen,
    handleFailsafeRetry,
    handleTestSuccess,
    exportLogs,
    installTruecaller,
    connectWirelessAdb,
    callingMethod,
    updateCallingMethod,
    uploadMedia,
    deleteMedia
  };
}
