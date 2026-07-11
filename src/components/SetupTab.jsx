import { useState } from 'react';
import { useSetup } from '../hooks/useSetup';
import TestCallPopup from './TestCallPopup';
import { Check, X, Shield, Phone, Download, Trash, Mail, Database } from 'lucide-react';

/**
 * JSDoc: Setup tab component.
 * Displays connection states, skin brand name, active SIM cards list, 
 * default slot selectors, failsafe 197 call tests, and log exporting tools.
 */
export default function SetupTab() {
  const {
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
    connectWirelessAdb
  } = useSetup();

  const [ipInput, setIpInput] = useState(() => localStorage.getItem('adb_wireless_ip') || '');

  const saveAndConnect = () => {
    if (!ipInput.trim()) return;
    localStorage.setItem('adb_wireless_ip', ipInput.trim());
    connectWirelessAdb(ipInput.trim());
  };

  const autofillIp = () => {
    if (parsedStatus.device_ip) {
      setIpInput(parsedStatus.device_ip);
      localStorage.setItem('adb_wireless_ip', parsedStatus.device_ip);
    } else {
      alert("No device IP detected in current connection. Make sure device is USB connected first.");
    }
  };

  const activeSlot = parsedStatus.default_sim_slot || 0;
  const sims = parsedStatus.sim_cards || [];

  const handleEmailLogs = () => {
    const body = encodeURIComponent(JSON.stringify(logs, null, 2));
    window.location.href = `mailto:developer@aerodial.com?subject=AeroDial%20CRM%20Diagnostics%20Logs&body=${body}`;
  };

  return (
    <div style={{ padding: '25px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 20px 0', letterSpacing: '-0.02em' }}>App Setup & Diagnostics</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '25px' }}>
        
        {/* Wireless ADB Connection Card */}
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--accent)' }}>Wireless ADB Connector</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Connect wirelessly to your Android device. Enter the IP address manually or auto-fetch it from a USB connection.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>IP ADDRESS (e.g. 192.168.1.100)</label>
            <input
              type="text"
              placeholder="192.168.1.100"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <button
              onClick={autofillIp}
              disabled={!parsedStatus.device_ip}
              style={{
                flexGrow: 1,
                background: parsedStatus.device_ip ? 'var(--bg-input)' : 'rgba(255, 255, 255, 0.03)',
                color: parsedStatus.device_ip ? 'var(--text)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: parsedStatus.device_ip ? 'pointer' : 'not-allowed',
                fontSize: '12.5px'
              }}
            >
              Auto-Fetch IP
            </button>
            
            <button
              onClick={saveAndConnect}
              style={{
                flexGrow: 1,
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '12.5px'
              }}
            >
              Connect Wirelessly
            </button>
          </div>
        </div>

        {/* Connection Diagnostics Card */}
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', fontWeight: '700', color: 'var(--accent)' }}>System Integrity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Python Daemon status</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isPythonRunning ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                {isPythonRunning ? <Check size={16} /> : <X size={16} />} {isPythonRunning ? 'Active' : 'Offline'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>ADB Bridge status</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isDeviceConnected ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                {isDeviceConnected ? <Check size={16} /> : <X size={16} />} {isDeviceConnected ? 'Connected' : 'No Device'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Root Privilege status</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: parsedStatus.is_root ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                <Shield size={16} /> {parsedStatus.is_root ? 'Rooted' : 'Non-Rooted'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Truecaller app</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: parsedStatus.truecaller ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                {parsedStatus.truecaller ? <Check size={16} /> : <X size={16} />} 
                {parsedStatus.truecaller ? 'Installed' : 'Missing'}
                {!parsedStatus.truecaller && (
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.truecaller&pcampaignid=web_share"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: '1px solid var(--border)'
                    }}
                  >
                    Play Store
                  </a>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>WhatsApp Business</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: parsedStatus.whatsapp ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                {parsedStatus.whatsapp ? <Check size={16} /> : <X size={16} />} 
                {parsedStatus.whatsapp ? 'Installed' : 'Missing'}
                {!parsedStatus.whatsapp && (
                  <a 
                    href="https://play.google.com/store/apps/details?id=com.whatsapp.w4b&pcampaignid=web_share"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: '1px solid var(--border)'
                    }}
                  >
                    Play Store
                  </a>
                )}
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Device Name / Model</div>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{parsedStatus.brand || 'Unknown'} {parsedStatus.model || ''}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>ROM Skin / UI Dialer</div>
              <div>{parsedStatus.os_name || 'Standard'} ({parsedStatus.dialer_details || 'Generic Dialer'})</div>
            </div>
          </div>
        </div>

        {/* SIM Selection Card */}
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '15px', fontWeight: '700', color: 'var(--accent)' }}>Outbound SIM Routing</h3>
          <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: 'var(--text-muted)' }}>Select which active SIM card to route dialing operations through:</p>
          
          {sims.length === 0 ? (
            <div style={{ padding: '15px', borderRadius: '8px', background: 'var(--bg-input)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No SIM cards detected or device is disconnected.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sims.map((sim) => (
                <label 
                  key={sim.slot} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: activeSlot === sim.slot ? 'rgba(0, 255, 204, 0.05)' : 'var(--bg-input)',
                    border: activeSlot === sim.slot ? '1px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="default_sim"
                    checked={activeSlot === sim.slot}
                    onChange={() => selectDefaultSimSlot(sim.slot)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>SIM {sim.slot + 1}: {sim.carrier}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Number: {sim.number}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={() => triggerTestCall(0)}
            disabled={!isDeviceConnected}
            style={{
              marginTop: '15px',
              width: '100%',
              background: isDeviceConnected ? 'var(--accent)' : 'var(--border)',
              color: '#000000',
              border: 'none',
              padding: '10px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: isDeviceConnected ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Phone size={14} />
            Test Dialer Fallbacks (197)
          </button>
        </div>
      </div>

      {/* Diagnostics Logs Section */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--accent)' }}>Local Event & Diagnostics Audit Log</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportLogs} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)' }}>
              <Download size={13} /> Export JSON
            </button>
            <button onClick={handleEmailLogs} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)' }}>
              <Mail size={13} /> Email Developer
            </button>
            <button onClick={clearLogs} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash size={13} /> Clear
            </button>
          </div>
        </div>

        <div style={{
          height: '240px',
          background: 'var(--bg-dark)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '15px',
          fontFamily: 'monospace',
          fontSize: '12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px 0' }}>No logs recorded yet.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ lineBreak: 'anywhere' }}>
                <span style={{ color: 'var(--text-muted)' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span style={{
                  fontWeight: 'bold',
                  color: log.level === 'ERROR' ? '#ef4444' : log.level === 'WARN' ? '#f59e0b' : log.level === 'ACTION' ? 'var(--accent)' : '#9ca3af'
                }}>[{log.level}]</span>{' '}
                <span style={{ color: 'var(--text)' }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <TestCallPopup
        isOpen={isTestPopupOpen}
        onClose={() => setIsTestPopupOpen(false)}
        onSuccess={handleTestSuccess}
        onFail={handleFailsafeRetry}
      />
    </div>
  );
}
