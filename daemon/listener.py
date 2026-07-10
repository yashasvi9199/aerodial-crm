import os
import sys
import time
import datetime
import json

# Add current folder to path to resolve local imports correctly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from supabase import create_client

from adb_helper import (
    run_cmd,
    get_connected_devices,
    check_rooted,
    check_package,
    get_device_details,
    perform_usb_sync,
    get_sim_cards,
    get_dialer_intent_extras
)

# --- SETUP SUPABASE ---
# Try to load .env from parent directory
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase Environment Variables.")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def update_queue_status(qid, status):
    """
    Updates the call queue record status in database.
    """
    if qid:
        supabase.table('call_queue').update({'status': status}).eq('id', qid).execute()
    else:
        supabase.table('call_queue').update({'status': status}).in_('status', ['dialing', 'call_active']).execute()

def get_call_state(device):
    """
    Checks call state using dumpsys.
    """
    out = run_cmd(f"adb -s {device} shell \"dumpsys telephony.registry | grep mCallState\"")
    states = re.findall(r'mCallState=(\d+)', out) if 're' in globals() else []
    if not states:
        # Import re locally if needed
        import re
        states = re.findall(r'mCallState=(\d+)', out)
    return max(int(s) for s in states) if states else 0

# --- MAIN DAEMON LOOP ---
def main():
    print("🚀 AeroDial Local Daemon Started (JSON Ready).\n")
    devices = []
    is_connected = False
    active_call_task_id = None
    last_device_check, last_state_check, last_queue_check, last_whatsapp_sync = 0.0, 0.0, 0.0, 0.0

    while True:
        try:
            now = time.time()
            if not devices or (now - last_device_check >= 4.0):
                devices = get_connected_devices()
                is_connected = len(devices) > 0
                last_device_check = now
                
            device = devices[0] if is_connected else None
            is_root = False
            
            # Read current settings from DB
            state_res = supabase.table('system_state').select('*').eq('id', 1).execute()
            db_state = state_res.data[0] if state_res.data else {}
            default_sim_slot = db_state.get('default_sim_slot', 0) or 0
            
            if is_connected and device:
                is_root = check_rooted(device)
                tc_installed = check_package(device, "com.truecaller")
                w4b_installed = check_package(device, "com.whatsapp.w4b")
                details = get_device_details(device)
                sims = get_sim_cards(device, is_root)
                
                status_payload = {
                    "status": "connected",
                    "is_root": is_root,
                    "truecaller": tc_installed,
                    "whatsapp": w4b_installed,
                    "brand": details["brand"],
                    "model": details["model"],
                    "os_name": details["os_name"],
                    "dialer_details": details["dialer_details"],
                    "phone_support": details["phone_support"],
                    "sim_cards": sims,
                    "default_sim_slot": default_sim_slot
                }
                current_status = json.dumps(status_payload)
            else:
                current_status = json.dumps({"status": "disconnected"})
            
            if now - last_state_check >= 0.4:
                last_state_check = now
                if db_state:
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    supabase.table('system_state').update({
                        'adb_status': current_status,
                        'updated_at': now_iso
                    }).eq('id', 1).execute()

                    cmd_str = db_state.get('command', 'idle')
                    if cmd_str and cmd_str != 'idle' and is_connected:
                        if cmd_str == 'run_sync':
                            success = perform_usb_sync(device)
                            supabase.table('system_state').update({
                                'command': 'idle', 
                                'adb_status': current_status
                            }).eq('id', 1).execute()
                        elif cmd_str == 'hangup':
                            print("[*] Remote Command Received: HANGUP ALL ACTIVE CALLS...")
                            for d in devices:
                                cmd_prefix = "su -c " if is_root else ""
                                run_cmd(f"adb -s {d} shell \"{cmd_prefix}input keyevent 6\"")
                            supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                        elif cmd_str.startswith('{'):
                            try:
                                cmd_data = json.loads(cmd_str)
                                action = cmd_data.get('action')
                                if action == 'whatsapp':
                                    from whatsapp_handler import handle_whatsapp_json
                                    handle_whatsapp_json(device, cmd_data, run_cmd)
                                elif action == 'truecaller_lookup':
                                    from truecaller_handler import handle_truecaller_json
                                    handle_truecaller_json(device, cmd_data, run_cmd, supabase)
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                            except Exception as je:
                                print(f"⚠️ JSON command error: {je}")
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

            if is_connected:
                if now - last_whatsapp_sync >= 15.0:
                    last_whatsapp_sync = now
                    try:
                        from whatsapp_handler import sync_whatsapp_history
                        sync_whatsapp_history(device, run_cmd, supabase)
                    except Exception as sync_ex:
                        print(f"⚠️ WhatsApp background sync error: {sync_ex}")

                call_state = get_call_state(device)
                if call_state != 0:
                    print(f"\n[*] Active call state detected: {call_state}. Measuring duration...")
                    start_time_ms = int(time.time() * 1000)
                    start_time_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    call_start_time = time.time()
                    
                    while get_call_state(device) != 0:
                        try:
                            st = supabase.table('system_state').select('command').eq('id', 1).execute().data
                            if st and st[0]['command'] == 'hangup':
                                for d in devices:
                                    cmd_prefix = "su -c " if is_root else ""
                                    run_cmd(f"adb -s {d} shell \"{cmd_prefix}input keyevent 6\"")
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                        except Exception as e: 
                            print(f"⚠️ State error: {e}")
                        time.sleep(0.3)
                        
                    call_end_time = time.time()
                    duration = int(call_end_time - call_start_time)
                    print(f"[*] Call ended. Local duration: {duration}s. Syncing...")
                    time.sleep(1.5)
                    
                    latest_log = None
                    try:
                        cmd_prefix = "su -c " if is_root else ""
                        cmd = f"adb -s {device} shell \"{cmd_prefix}content query --uri content://call_log/calls --projection date:duration:number:type --sort \\\"date DESC\\\" LIMIT 1\""
                        out = run_cmd(cmd)
                        line = next((l for l in out.splitlines() if "number=" in l), None)
                        if line:
                            import re
                            d_m = re.search(r'date=(\d+)', line)
                            dur_m = re.search(r'duration=(\d+)', line)
                            n_m = re.search(r'number=([+\d#*]+)', line)
                            t_m = re.search(r'type=(\d+)', line)
                            if d_m and n_m and t_m:
                                latest_log = {
                                    'date': int(d_m.group(1)), 
                                    'duration': int(dur_m.group(1)) if dur_m else 0, 
                                    'number': n_m.group(1), 
                                    'type': int(t_m.group(1))
                                }
                    except Exception as ex: 
                        print(f"⚠️ Error reading Android call logs: {ex}")
                        
                    raw_number = None
                    call_type = 'outgoing'
                    if latest_log and latest_log['date'] >= (start_time_ms - 45000):
                        raw_number = latest_log['number']
                        call_type = 'incoming' if latest_log['type'] == 1 else 'outgoing'
                    else:
                        print("⚠️ Check active queue...")
                        
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
                        contact_id, jd_lead_id, platform = None, None, "justdial"
                        
                        contact_res = supabase.table('contacts').select('*').like('phone_number', f'%{last_10}').execute()
                        if contact_res.data:
                            contact = contact_res.data[0]
                            contact_id, platform = contact['id'], "cold_call"
                            curr_count = contact.get('call_count', 0) or 0
                            supabase.table('contacts').update({
                                'last_call_at': start_time_iso,
                                'call_duration': f"{duration}s",
                                'status_update': "Answered" if duration > 0 else "Unanswered",
                                'call_count': curr_count + 1
                            }).eq('id', contact_id).execute()
                        else:
                            jd_res = supabase.table('justdial_leads').select('*').like('phone', f'%{last_10}').execute()
                            if jd_res.data:
                                lead = jd_res.data[0]
                                jd_lead_id, platform = lead['id'], "justdial"
                                curr_count = lead.get('call_count', 0) or 0
                                supabase.table('justdial_leads').update({
                                    'contacted': "Yes" if duration > 0 else "No",
                                    'contact_state': "Answered" if duration > 0 else "Unanswered",
                                    'updated_at': start_time_iso,
                                    'call_count': curr_count + 1
                                }).eq('id', jd_lead_id).execute()
                                
                        supabase.table('call_logs').insert({
                            'phone_number': clean_num,
                            'duration_seconds': duration,
                            'status': "Answered" if duration > 0 else "Unanswered",
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
                        print("⚠️ Call ended but no matched phone number.")
                        update_queue_status(active_call_task_id, 'failed_unknown')
                        active_call_task_id = None

                elif now - last_queue_check >= 0.4:
                    last_queue_check = now
                    call_res = supabase.table('call_queue').select('*').eq('status', 'dialing').limit(1).execute()
                    if call_res.data:
                        call_task = call_res.data[0]
                        active_call_task_id = call_task['id']
                        number = call_task['number']
                        method = "default"
                        if "#" in str(number):
                            number_parts = str(number).split("#", 1)
                            number = number_parts[0]
                            method = number_parts[1]
                            
                        print(f"[*] Placing outgoing call from queue: {number} (Method: {method})")
                        supabase.table('call_queue').update({'status': 'call_active'}).eq('id', call_task['id']).execute()
                        
                        details = get_device_details(device)
                        
                        if method == "slot0":
                            intent_extras = get_dialer_intent_extras(details["os_name"], 0)
                        elif method == "slot1":
                            intent_extras = get_dialer_intent_extras(details["os_name"], 1)
                        elif method == "generic":
                            intent_extras = ""
                        else:
                            intent_extras = get_dialer_intent_extras(details["os_name"], default_sim_slot)
                            
                        if is_root:
                            if method == "root_service":
                                # Direct service call for dialing using phone service
                                run_cmd(f"adb -s {device} shell \"su -c 'service call phone 2 s16 {number}'\"")
                                time.sleep(1.5)
                                continue
                            else:
                                comp = "com.android.phone/com.android.services.telephony.TelephonyConnectionService"
                                target_slot = 0 if method == "slot0" else (1 if method == "slot1" else default_sim_slot)
                                sub_id = target_slot + 1
                                if 'sims' in locals() and sims:
                                    for s in sims:
                                        if s.get("slot") == target_slot:
                                            sub_id = s.get("sub_id", target_slot + 1)
                                            break
                                run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account {comp} {sub_id} 0'\"")
                                cmd_prefix = "su -c "
                        else:
                            cmd_prefix = ""
                            
                        clean_num = str(number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                        if len(clean_num) == 10: 
                            clean_num = "+91" + clean_num
                        elif len(clean_num) == 12 and clean_num.startswith("91"): 
                            clean_num = "+" + clean_num
                        
                        run_cmd(f"adb -s {device} shell \"{cmd_prefix}am start -a android.intent.action.CALL -d tel:{clean_num}{intent_extras}\"")
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