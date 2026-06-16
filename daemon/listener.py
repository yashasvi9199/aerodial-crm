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

def update_queue_status(qid, status):
    if qid:
        supabase.table('call_queue').update({'status': status}).eq('id', qid).execute()
    else:
        supabase.table('call_queue').update({'status': status}).in_('status', ['dialing', 'call_active']).execute()

def get_connected_devices():
    lines = run_cmd("adb devices").splitlines()[1:]
    devices = [l.split()[0] for l in lines if l.strip() and "device" in l and l.split()[1] == "device"]
    devices.sort(key=lambda d: 0 if ":" in d else 1)
    return devices

def check_adb_status():
    """Returns True if a device is connected wirelessly or via USB"""
    devices = get_connected_devices()
    return len(devices) > 0

def get_airtel_sub_id(device):
    try:
        out = run_cmd(f"adb -s {device} shell \"su -c 'content query --uri content://telephony/siminfo --projection _id:display_name'\"")
        m = re.search(r'_id=(\d+).*Airtel', out, re.IGNORECASE)
        if m: return int(m.group(1))
    except Exception as e:
        print(f"⚠️ Error querying Airtel SIM: {e}")
    return 1

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
    if ":" in device: return True
    ip_match = re.search(r'inet\s+(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)', run_cmd(f"adb -s {device} shell ip addr"))
    if ip_match:
        ip = ip_match.group(1)
        run_cmd(f"adb -s {device} tcpip 5555")
        time.sleep(3)
        run_cmd(f"adb disconnect {ip}:5555")
        for _ in range(2):
            if "connected" in run_cmd(f"adb connect {ip}:5555").lower():
                print(f"✅ Sync Successful: {ip}")
                return True
            time.sleep(1.5)
    print("❌ Sync Failed. Is USB plugged in?")
    return False

# --- MAIN DAEMON LOOP ---
def main():
    print("🚀 AeroDial Local Daemon Started.")
    print("Listening to Supabase for calls and sync commands...\n")

    devices = []
    is_connected = False
    call_state = 0
    active_call_task_id = None
    
    last_device_check = 0.0
    last_state_check = 0.0
    last_queue_check = 0.0

    while True:
        try:
            now = time.time()
            
            # 1. THE HEARTBEAT (Every 4 seconds or if we don't have devices)
            if not devices or (now - last_device_check >= 4.0):
                devices = get_connected_devices()
                is_connected = len(devices) > 0
                last_device_check = now
                
            current_status = 'connected' if is_connected else 'disconnected'
            device = devices[0] if is_connected else None
            
            # 2. CHECK SYSTEM STATE (Every 0.4 seconds)
            if now - last_state_check >= 0.4:
                last_state_check = now
                state_res = supabase.table('system_state').select('*').eq('id', 1).execute()
                if state_res.data:
                    state = state_res.data[0]
                    if state['adb_status'] != current_status:
                        supabase.table('system_state').update({'adb_status': current_status}).eq('id', 1).execute()

                    if state['command'] == 'run_sync' and is_connected:
                        success = perform_usb_sync(device)
                        supabase.table('system_state').update({
                            'command': 'idle', 
                            'adb_status': 'connected' if success else 'disconnected'
                        }).eq('id', 1).execute()
                    
                    if state['command'] == 'hangup' and is_connected:
                        print("[*] Remote Command Received: HANGUP ALL ACTIVE CALLS...")
                        for d in devices:
                            run_cmd(f"adb -s {d} shell \"su -c 'input keyevent 6'\"")
                        supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

                    if state['command'] and state['command'].startswith('whatsapp|') and is_connected:
                        from whatsapp_handler import handle_whatsapp
                        handle_whatsapp(device, state['command'], run_cmd)
                        supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

            # If device is connected, check call state and process dialing queue
            if is_connected:
                # 3. CHECK PHONE CALL STATE (Every 0.4 seconds)
                call_state = get_call_state(device)
                if call_state != 0:
                    print(f"\n[*] Active call state detected: {call_state}. Measuring duration...")
                    start_time_ms = int(time.time() * 1000)
                    start_time_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    call_start_time = time.time()
                    
                    # Wait for call to terminate
                    while get_call_state(device) != 0:
                        try:
                            st = supabase.table('system_state').select('command').eq('id', 1).execute().data
                            if st and st[0]['command'] == 'hangup':
                                for d in devices: run_cmd(f"adb -s {d} shell \"su -c 'input keyevent 6'\"")
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                        except Exception as e: print(f"⚠️ State error: {e}")
                        time.sleep(0.3)
                        
                    call_end_time = time.time()
                    duration = int(call_end_time - call_start_time)
                    print(f"[*] Call ended. Local duration: {duration}s. Waiting for log database...")
                    time.sleep(1.5)
                    
                    run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account'\"")
                    
                    latest_log = None
                    try:
                        cmd = f"adb -s {device} shell \"su -c 'content query --uri content://call_log/calls --projection date:duration:number:type --sort \\\"date DESC\\\" LIMIT 1'\""
                        out = run_cmd(cmd)
                        line = next((l for l in out.splitlines() if "number=" in l), None)
                        if line:
                            d_m, dur_m, n_m, t_m = re.search(r'date=(\d+)', line), re.search(r'duration=(\d+)', line), re.search(r'number=([+\d#*]+)', line), re.search(r'type=(\d+)', line)
                            if d_m and n_m and t_m:
                                latest_log = {'date': int(d_m.group(1)), 'duration': int(dur_m.group(1)) if dur_m else 0, 'number': n_m.group(1), 'type': int(t_m.group(1))}
                    except Exception as ex: print(f"⚠️ Error reading Android call logs: {ex}")
                        
                    raw_number = None
                    call_type = 'outgoing'
                    if latest_log and latest_log['date'] >= (start_time_ms - 45000):
                        raw_number = latest_log['number']
                        call_type = 'incoming' if latest_log['type'] == 1 else 'outgoing'
                    else:
                        print("⚠️ Could not match Android call log within timeframe. Checking active queue...")
                        
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
                        
                        update_queue_status(active_call_task_id, 'completed')
                        active_call_task_id = None
                        print(f"✅ Call logged: {clean_num} ({call_type}, {duration}s)")
                    else:
                        print("⚠️ Call ended but no matched phone number could be determined.")
                        update_queue_status(active_call_task_id, 'failed_unknown')
                        active_call_task_id = None

                # 4. PROCESS DIALING IN QUEUE (Every 0.4 seconds)
                elif now - last_queue_check >= 0.4:
                    last_queue_check = now
                    call_res = supabase.table('call_queue').select('*').eq('status', 'dialing').limit(1).execute()
                    if call_res.data:
                        call_task = call_res.data[0]
                        active_call_task_id = call_task['id']
                        number = call_task['number']
                        print(f"[*] Placing outgoing call from queue: {number}")
                        
                        supabase.table('call_queue').update({'status': 'call_active'}).eq('id', call_task['id']).execute()
                        
                        airtel_sub = get_airtel_sub_id(device)
                        print(f"[*] Setting Airtel Default (Sub ID: {airtel_sub})...")
                        comp = "com.android.phone/com.android.services.telephony.TelephonyConnectionService"
                        run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account {comp} {airtel_sub} 0'\"")
                        
                        clean_num = str(number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                        if len(clean_num) == 10:
                            clean_num = "+91" + clean_num
                        elif len(clean_num) == 12 and clean_num.startswith("91"):
                            clean_num = "+" + clean_num
                            
                        run_cmd(f"adb -s {device} shell \"su -c 'am start -a android.intent.action.CALL -d tel:{clean_num}'\"")
                        time.sleep(1.5)
                        
            elif not is_connected and now - last_queue_check >= 1.0:
                last_queue_check = now
                supabase.table('call_queue').update({'status': 'failed_no_connection'}).eq('status', 'dialing').execute()

            time.sleep(0.1)

        except Exception as e:
            print(f"⚠️ Network/DB Error in main loop: {e}")
            time.sleep(2)

if __name__ == "__main__":
    main()