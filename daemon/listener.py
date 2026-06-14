import os
import time
import subprocess
import re
import datetime
from supabase import create_client, Client

# --- SETUP SUPABASE ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase Environment Variables.")
    print("Make sure you ran 'source ~/.config/fish/config.fish'")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- ADB FUNCTIONS ---
def run_cmd(command):
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

def get_connected_devices():
    devices = []
    out = run_cmd("adb devices")
    for line in out.splitlines()[1:]:
        if line.strip() and ("device" in line) and not ("list of" in line.lower()):
            parts = line.split()
            if len(parts) >= 2 and parts[1] == 'device':
                devices.append(parts[0])
    return devices

def check_adb_status():
    """Returns True if a device is connected wirelessly or via USB"""
    devices = get_connected_devices()
    return len(devices) > 0

def get_airtel_sub_id(device):
    try:
        out = run_cmd(f"adb -s {device} shell \"su -c 'content query --uri content://telephony/siminfo --projection _id:display_name:carrier_name'\"")
        for line in out.splitlines():
            if "Airtel" in line:
                match = re.search(r'_id=(\d+)', line)
                if match:
                    return int(match.group(1))
    except Exception as e:
        print(f"⚠️ Error querying Airtel SIM: {e}")
    return 1 # Fallback to 1 if anything fails

def get_call_state(device):
    out = run_cmd(f"adb -s {device} shell \"dumpsys telephony.registry | grep mCallState\"")
    states = re.findall(r'mCallState=(\d+)', out)
    if states:
        return int(states[0])
    return 0

def get_last_outgoing_call_duration(device, clean_num, start_time_ms):
    last_10 = clean_num[-10:] if len(clean_num) >= 10 else clean_num
    try:
        cmd = f"adb -s {device} shell \"su -c 'content query --uri content://call_log/calls --projection date:duration:type --where \\\"number LIKE \\'%{last_10}%\\' AND type = 2\\\" --sort \\'date DESC\\' LIMIT 1'\""
        out = run_cmd(cmd)
        if out and "date=" in out:
            date_match = re.search(r'date=(\d+)', out)
            dur_match = re.search(r'duration=(\d+)', out)
            if date_match and dur_match:
                call_date_ms = int(date_match.group(1))
                duration = int(dur_match.group(1))
                # Call should be placed near start_time_ms
                if call_date_ms >= (start_time_ms - 30000):
                    return duration
    except Exception as e:
        print(f"⚠️ Error querying call logs: {e}")
    return None

def perform_usb_sync(device):
    print(f"\n[*] Remote Command Received: EXECUTING USB SYNC on {device}...")
    ip_out = run_cmd(f"adb -s {device} shell ip addr")
    matches = re.findall(r'inet\s+(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)', ip_out)
    
    if matches:
        ip = matches[0]
        run_cmd(f"adb -s {device} tcpip 5555")
        time.sleep(2)
        connect_out = run_cmd(f"adb connect {ip}:5555")
        if "connected" in connect_out.lower():
            print(f"✅ Sync Successful: {ip}")
            return True
    print("❌ Sync Failed. Is USB plugged in?")
    return False

# --- MAIN DAEMON LOOP ---
def main():
    print("🚀 AeroDial Local Daemon Started.")
    print("Listening to Supabase for calls and sync commands...\n")

    while True:
        try:
            # 1. THE HEARTBEAT
            devices = get_connected_devices()
            is_connected = len(devices) > 0
            current_status = 'connected' if is_connected else 'disconnected'
            
            # 2. CHECK SYSTEM STATE
            state_res = supabase.table('system_state').select('*').eq('id', 1).execute()
            if state_res.data:
                state = state_res.data[0]
                
                if state['adb_status'] != current_status:
                    supabase.table('system_state').update({'adb_status': current_status}).eq('id', 1).execute()

                if state['command'] == 'run_sync' and is_connected:
                    success = perform_usb_sync(devices[0])
                    supabase.table('system_state').update({
                        'command': 'idle', 
                        'adb_status': 'connected' if success else 'disconnected'
                    }).eq('id', 1).execute()
                
                if state['command'] == 'hangup':
                    print("[*] Remote Command Received: HANGUP ALL ACTIVE CALLS...")
                    for d in devices:
                        run_cmd(f"adb -s {d} shell \"su -c 'input keyevent 6'\"")
                    supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

            # 3. CHECK FOR CALLS
            call_res = supabase.table('call_queue').select('*').eq('status', 'dialing').limit(1).execute()
            if call_res.data:
                call_task = call_res.data[0]
                
                if is_connected:
                    device = devices[0]
                    number = call_task['number']
                    print(f"[*] Placed Call Command Received: {number}")
                    
                    # Update status to active
                    supabase.table('call_queue').update({'status': 'call_active'}).eq('id', call_task['id']).execute()
                    
                    # Resolve Airtel sub_id
                    airtel_sub = get_airtel_sub_id(device)
                    print(f"[*] Setting Airtel Default (Sub ID: {airtel_sub})...")
                    comp = "com.android.phone/com.android.services.telephony.TelephonyConnectionService"
                    run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account {comp} {airtel_sub} 0'\"")
                    
                    # Dial
                    clean_num = str(number).replace(" ", "").replace("-", "")
                    clean_num = "+" + clean_num if (clean_num.startswith("91") and len(clean_num) > 10) else "+91" + clean_num if not clean_num.startswith("+91") else clean_num
                    
                    start_time_ms = int(time.time() * 1000)
                    start_time_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    
                    print(f"[*] Dialing: {clean_num}...")
                    run_cmd(f"adb -s {device} shell \"su -c 'am start -a android.intent.action.CALL -d tel:{clean_num}'\"")
                    
                    # Wait for call to start, then monitor state transitions
                    time.sleep(2)
                    
                    call_active = True
                    elapsed = 0
                    while call_active and elapsed < 600:
                        state = get_call_state(device)
                        if state == 0:
                            call_active = False
                        else:
                            time.sleep(2)
                            elapsed += 2
                            
                    print("[*] Call ended. Restoring SIM settings and fetching logs...")
                    time.sleep(2) # Allow call logs database write
                    
                    # Revert voice call SIM to 'Ask every time'
                    run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account'\"")
                    
                    # Fetch call logs duration
                    duration = get_last_outgoing_call_duration(device, clean_num, start_time_ms)
                    if duration is None:
                        duration = 0 # Default if query fails
                    
                    print(f"[+] Call completed. Actual duration: {duration}s")
                    
                    # Match contact/lead by last 10 digits
                    last_10 = clean_num[-10:]
                    contact_id = None
                    jd_lead_id = None
                    platform = "excel"
                    
                    contact_res = supabase.table('contacts').select('*').like('phone_number', f'%{last_10}').execute()
                    if contact_res.data:
                        contact = contact_res.data[0]
                        contact_id = contact['id']
                        platform = "excel"
                        
                        status_update = "Answered" if duration > 0 else "Unanswered"
                        supabase.table('contacts').update({
                            'last_call_at': start_time_iso,
                            'call_duration': f"{duration}s",
                            'status_update': status_update
                        }).eq('id', contact_id).execute()
                    else:
                        jd_res = supabase.table('justdial_leads').select('*').like('phone', f'%{last_10}').execute()
                        if jd_res.data:
                            lead = jd_res.data[0]
                            jd_lead_id = lead['id']
                            platform = "justdial"
                            
                            contacted_status = "Yes" if duration > 0 else "No"
                            supabase.table('justdial_leads').update({
                                'contacted': contacted_status,
                                'updated_at': start_time_iso
                            }).eq('id', jd_lead_id).execute()
                    
                    # Log the call attempt
                    status_log = "Answered" if duration > 0 else "Unanswered"
                    supabase.table('call_logs').insert({
                        'phone_number': clean_num,
                        'duration_seconds': duration,
                        'status': status_log,
                        'call_date': start_time_iso,
                        'call_type': 'outgoing',
                        'platform': platform,
                        'contact_id': contact_id,
                        'justdial_lead_id': jd_lead_id
                    }).execute()
                    
                    # Transition call task status in queue to completed
                    supabase.table('call_queue').update({'status': 'completed'}).eq('id', call_task['id']).execute()
                    
                else:
                    print("⚠️ Missed Call Trigger: Phone is disconnected!")
                    supabase.table('call_queue').update({'status': 'failed_no_connection'}).eq('id', call_task['id']).execute()

            time.sleep(2)

        except Exception as e:
            print(f"⚠️ Network/DB Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()