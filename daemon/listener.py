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
        return max(int(s) for s in states)
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
                
                if state['command'] == 'hangup' and is_connected:
                    print("[*] Remote Command Received: HANGUP ALL ACTIVE CALLS...")
                    for d in devices:
                        run_cmd(f"adb -s {d} shell \"su -c 'input keyevent 6'\"")
                    supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

            # 3. CHECK PHONE CALL STATE (MONITOR OUTGOING & INCOMING CALLS)
            if is_connected:
                device = devices[0]
                state = get_call_state(device)
                if state != 0:
                    print(f"\n[*] Active call state detected: {state}. Measuring duration...")
                    start_time_ms = int(time.time() * 1000)
                    start_time_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    call_start_time = time.time()
                    
                    # Wait for call to terminate
                    while get_call_state(device) != 0:
                        time.sleep(1)
                        
                    call_end_time = time.time()
                    duration = int(call_end_time - call_start_time)
                    print(f"[*] Call ended. Local duration: {duration}s. Waiting for log database...")
                    time.sleep(2) # let the device write log
                    
                    # Revert voice call SIM setting in case it was modified
                    run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account'\"")
                    
                    # Fetch last log entry from phone
                    latest_log = None
                    try:
                        cmd = f"adb -s {device} shell \"su -c 'content query --uri content://call_log/calls --projection date:duration:number:type --sort \\\"date DESC\\\"'\""
                        out = run_cmd(cmd)
                        # Take only the first row from output
                        first_row_line = None
                        for line in out.splitlines():
                            if "number=" in line:
                                first_row_line = line
                                break
                        if first_row_line:
                            date_match = re.search(r'date=(\d+)', first_row_line)
                            dur_match = re.search(r'duration=(\d+)', first_row_line)
                            num_match = re.search(r'number=([+\d#*]+)', first_row_line)
                            type_match = re.search(r'type=(\d+)', first_row_line)
                            if date_match and num_match and type_match:
                                latest_log = {
                                    'date': int(date_match.group(1)),
                                    'duration': int(dur_match.group(1)) if dur_match else 0,
                                    'number': num_match.group(1),
                                    'type': int(type_match.group(1))
                                }
                    except Exception as ex:
                        print(f"⚠️ Error reading Android call logs: {ex}")
                        
                    # Process call log
                    raw_number = None
                    call_type = 'outgoing'
                    
                    # Verify if call log belongs to the call that just ended (last 45s window)
                    if latest_log and latest_log['date'] >= (start_time_ms - 45000):
                        raw_number = latest_log['number']
                        call_type = 'incoming' if latest_log['type'] == 1 else 'outgoing'
                    else:
                        print("⚠️ Could not match Android call log within timeframe. Checking active queue...")
                        
                    # Fallback to current queue entry if outbound call log matching failed
                    if not raw_number:
                        queue_res = supabase.table('call_queue').select('*').in_('status', ['dialing', 'call_active']).limit(1).execute()
                        if queue_res.data:
                            raw_number = queue_res.data[0]['number']
                            
                    if raw_number:
                        clean_num = str(raw_number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                        if len(clean_num) == 10:
                            clean_num = "+91" + clean_num
                        elif len(clean_num) == 12 and clean_num.startswith("91"):
                            clean_num = "+" + clean_num
                            
                        last_10 = clean_num[-10:]
                        contact_id = None
                        jd_lead_id = None
                        platform = "justdial"
                        
                        # Match contact/lead by number
                        contact_res = supabase.table('contacts').select('*').like('phone_number', f'%{last_10}').execute()
                        if contact_res.data:
                            contact = contact_res.data[0]
                            contact_id = contact['id']
                            platform = "cold_call"
                            curr_count = contact.get('call_count', 0) or 0
                            
                            status_update = "Answered" if duration > 0 else "Unanswered"
                            supabase.table('contacts').update({
                                'last_call_at': start_time_iso,
                                'call_duration': f"{duration}s",
                                'status_update': status_update,
                                'call_count': curr_count + 1
                            }).eq('id', contact_id).execute()
                        else:
                            jd_res = supabase.table('justdial_leads').select('*').like('phone', f'%{last_10}').execute()
                            if jd_res.data:
                                lead = jd_res.data[0]
                                jd_lead_id = lead['id']
                                platform = "justdial"
                                curr_count = lead.get('call_count', 0) or 0
                                
                                contacted_status = "Yes" if duration > 0 else "No"
                                contact_state_val = "Answered" if duration > 0 else "Unanswered"
                                supabase.table('justdial_leads').update({
                                    'contacted': contacted_status,
                                    'contact_state': contact_state_val,
                                    'updated_at': start_time_iso,
                                    'call_count': curr_count + 1
                                }).eq('id', jd_lead_id).execute()
                                
                        # Log call in database
                        status_log = "Answered" if duration > 0 else "Unanswered"
                        supabase.table('call_logs').insert({
                            'phone_number': clean_num,
                            'duration_seconds': duration,
                            'status': status_log,
                            'call_date': start_time_iso,
                            'call_type': call_type,
                            'platform': platform,
                            'contact_id': contact_id,
                            'justdial_lead_id': jd_lead_id
                        }).execute()
                        
                        # Set active queue items to completed
                        supabase.table('call_queue').update({'status': 'completed'}).in_('status', ['dialing', 'call_active']).execute()
                        print(f"✅ Call logged: {clean_num} ({call_type}, {duration}s)")
                    else:
                        print("⚠️ Call ended but no matched phone number could be determined.")
                        # Force close active dialing tasks if any
                        supabase.table('call_queue').update({'status': 'failed_unknown'}).in_('status', ['dialing', 'call_active']).execute()

            # 4. PROCESS DIALING IN QUEUE (IF DEVICE IS CONNECTED & NOT ACTIVE)
            if is_connected and get_call_state(device) == 0:
                call_res = supabase.table('call_queue').select('*').eq('status', 'dialing').limit(1).execute()
                if call_res.data:
                    call_task = call_res.data[0]
                    number = call_task['number']
                    print(f"[*] Placing outgoing call from queue: {number}")
                    
                    # Update status to active
                    supabase.table('call_queue').update({'status': 'call_active'}).eq('id', call_task['id']).execute()
                    
                    # Set default SIM 2 (Airtel) outgoing
                    airtel_sub = get_airtel_sub_id(device)
                    print(f"[*] Setting Airtel Default (Sub ID: {airtel_sub})...")
                    comp = "com.android.phone/com.android.services.telephony.TelephonyConnectionService"
                    run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account {comp} {airtel_sub} 0'\"")
                    
                    # Clean/normalize number for dialing
                    clean_num = str(number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                    if len(clean_num) == 10:
                        clean_num = "+91" + clean_num
                    elif len(clean_num) == 12 and clean_num.startswith("91"):
                        clean_num = "+" + clean_num
                        
                    # Trigger dial intent
                    run_cmd(f"adb -s {device} shell \"su -c 'am start -a android.intent.action.CALL -d tel:{clean_num}'\"")
                    time.sleep(3) # allow dialer to load and state to transition
                    
            elif not is_connected:
                # If dialing is pending but no connection
                supabase.table('call_queue').update({'status': 'failed_no_connection'}).eq('status', 'dialing').execute()

            time.sleep(1)

        except Exception as e:
            print(f"⚠️ Network/DB Error in main loop: {e}")
            time.sleep(4)

if __name__ == "__main__":
    main()