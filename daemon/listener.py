import os
import time
import subprocess
import re
import datetime
import json
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
def run_cmd(command, timeout=15):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print(f"⚠️ Command timed out after {timeout}s: {command}")
        return ""

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

def check_rooted(device):
    try:
        out = run_cmd(f"adb -s {device} shell which su")
        if out and "/su" in out:
            test = run_cmd(f"adb -s {device} shell \"su -c id\"")
            return "uid=0" in test
    except Exception:
        pass
    return False

def check_package(device, package_name):
    try:
        out = run_cmd(f"adb -s {device} shell \"pm list packages {package_name}\"")
        return package_name in out
    except Exception:
        return False

def check_adb_status():
    """Returns True if a device is connected wirelessly or via USB"""
    return len(get_connected_devices()) > 0

def get_airtel_sub_id(device, is_root=False):
    try:
        cmd_prefix = "su -c " if is_root else ""
        out = run_cmd(f"adb -s {device} shell \"{cmd_prefix}content query --uri content://telephony/siminfo --projection _id:display_name\"")
        m = re.search(r'_id=(\d+).*Airtel', out, re.IGNORECASE)
        if m: return int(m.group(1))
    except Exception as e:
        print(f"⚠️ Error querying Airtel SIM: {e}")
    return 1

def get_call_state(device):
    out = run_cmd(f"adb -s {device} shell \"dumpsys telephony.registry | grep mCallState\"")
    states = re.findall(r'mCallState=(\d+)', out)
    return max(int(s) for s in states) if states else 0

def get_last_outgoing_call_duration(device, clean_num, start_time_ms, is_root=False):
    last_10 = clean_num[-10:] if len(clean_num) >= 10 else clean_num
    try:
        cmd_prefix = "su -c " if is_root else ""
        cmd = f"adb -s {device} shell \"{cmd_prefix}content query --uri content://call_log/calls --projection date:duration:type --where \\\"number LIKE \\'%{last_10}%\\' AND type = 2\\\" --sort \\'date DESC\\' LIMIT 1\""
        out = run_cmd(cmd)
        if out and "date=" in out:
            date_match = re.search(r'date=(\d+)', out)
            dur_match = re.search(r'duration=(\d+)', out)
            if date_match and dur_match and int(date_match.group(1)) >= (start_time_ms - 30000):
                return int(dur_match.group(1))
    except Exception as e:
        print(f"⚠️ Error querying call logs: {e}")
    return None

def get_device_ip(device):
    # Try 4 fallback methods to obtain the active IP address
    ip = run_cmd(f"adb -s {device} shell getprop dhcp.wlan0.ipaddress")
    if ip and re.match(r'^\d+\.\d+\.\d+\.\d+$', ip):
        return ip
    out = run_cmd(f"adb -s {device} shell ip route")
    m = re.search(r'src\s+(\d+\.\d+\.\d+\.\d+)', out)
    if m:
        return m.group(1)
    out = run_cmd(f"adb -s {device} shell ip addr show wlan0")
    m = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', out)
    if m:
        return m.group(1)
    out = run_cmd(f"adb -s {device} shell dumpsys wifi")
    m = re.search(r'IP\s+address\s+(\d+\.\d+\.\d+\.\d+)', out, re.IGNORECASE)
    if m:
        return m.group(1)
    return ""

def get_device_details(device):
    brand = run_cmd(f"adb -s {device} shell getprop ro.product.brand").strip()
    model = run_cmd(f"adb -s {device} shell getprop ro.product.model").strip()
    android_ver = run_cmd(f"adb -s {device} shell getprop ro.build.version.release").strip()
    
    display_id = run_cmd(f"adb -s {device} shell getprop ro.build.display.id").strip().lower()
    brand_lower = brand.lower()
    os_name = "Android"
    
    if "lineage" in display_id or "aosp" in display_id:
        os_name = "LineageOS/AOSP"
    elif "hos" in display_id or brand_lower == "huawei":
        os_name = "HarmonyOS"
    elif brand_lower in ["oppo", "realme"]:
        os_name = "ColorOS"
    elif brand_lower == "vivo":
        os_name = "FuntouchOS"
    elif brand_lower == "xiaomi":
        os_name = "MIUI/HyperOS"
    elif brand_lower == "lava":
        os_name = "LavaOS"
    elif brand_lower == "micromax":
        os_name = "Micromax"
        
    return {
        "brand": brand,
        "model": model,
        "android_version": android_ver,
        "os_name": os_name
    }

def perform_usb_sync(device):
    print(f"\n[*] Remote Command Received: EXECUTING USB SYNC on {device}...")
    if ":" in device: return True
    ip = get_device_ip(device)
    if ip:
        print(f"[*] Dynamic IP resolved: {ip}. Attempting TCP/IP bridge...")
        run_cmd(f"adb -s {device} tcpip 5555")
        time.sleep(3)
        run_cmd(f"adb disconnect {ip}:5555")
        for _ in range(2):
            if "connected" in run_cmd(f"adb connect {ip}:5555").lower():
                print(f"✅ Sync Successful: {ip}")
                return True
            time.sleep(1.5)
    print("❌ Sync Failed. Is USB plugged in and Wi-Fi active?")
    return False


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
            if is_connected and device:
                is_root = check_rooted(device)
                tc_installed = check_package(device, "com.truecaller")
                w4b_installed = check_package(device, "com.whatsapp.w4b")
                details = get_device_details(device)
                current_status = f"connected|root:{'1' if is_root else '0'}|truecaller:{'1' if tc_installed else '0'}|whatsapp:{'1' if w4b_installed else '0'}|brand:{details['brand']}|os:{details['os_name']}|model:{details['model']}"
            else:
                current_status = 'disconnected'
            
            if now - last_state_check >= 0.4:
                last_state_check = now
                state_res = supabase.table('system_state').select('*').eq('id', 1).execute()
                if state_res.data:
                    state = state_res.data[0]
                    # Update status and push heartbeat
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    supabase.table('system_state').update({
                        'adb_status': current_status,
                        'updated_at': now_iso
                    }).eq('id', 1).execute()

                    cmd_str = state['command']
                    if cmd_str and cmd_str != 'idle' and is_connected:
                        if cmd_str == 'run_sync':
                            success = perform_usb_sync(device)
                            supabase.table('system_state').update({'command': 'idle', 'adb_status': 'connected' if success else 'disconnected'}).eq('id', 1).execute()
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
                        else:
                            # Legacy compatibility
                            if cmd_str.startswith('whatsapp|'):
                                from whatsapp_handler import handle_whatsapp
                                handle_whatsapp(device, cmd_str, run_cmd)
                            supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

            if is_connected:
                # Sync WhatsApp history periodically (every 15 seconds)
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
                        except Exception as e: print(f"⚠️ State error: {e}")
                        time.sleep(0.3)
                        
                    call_end_time = time.time()
                    duration = int(call_end_time - call_start_time)
                    print(f"[*] Call ended. Local duration: {duration}s. Syncing...")
                    time.sleep(1.5)
                    if is_root:
                        run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account'\"")
                    
                    latest_log = None
                    try:
                        cmd_prefix = "su -c " if is_root else ""
                        cmd = f"adb -s {device} shell \"{cmd_prefix}content query --uri content://call_log/calls --projection date:duration:number:type --sort \\\"date DESC\\\" LIMIT 1\""
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
                        print("⚠️ Check active queue...")
                        
                    if not raw_number:
                        queue_res = supabase.table('call_queue').select('*').in_('status', ['dialing', 'call_active']).limit(1).execute()
                        if queue_res.data: raw_number = queue_res.data[0]['number']
                            
                    if raw_number:
                        clean_num = str(raw_number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                        if len(clean_num) == 10: clean_num = "+91" + clean_num
                        elif len(clean_num) == 12 and clean_num.startswith("91"): clean_num = "+" + clean_num
                            
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
                        print(f"[*] Placing outgoing call from queue: {number}")
                        supabase.table('call_queue').update({'status': 'call_active'}).eq('id', call_task['id']).execute()
                        
                        airtel_sub = get_airtel_sub_id(device, is_root)
                        if is_root:
                            comp = "com.android.phone/com.android.services.telephony.TelephonyConnectionService"
                            run_cmd(f"adb -s {device} shell \"su -c 'telecom set-user-selected-outgoing-phone-account {comp} {airtel_sub} 0'\"")
                        
                        clean_num = str(number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                        if len(clean_num) == 10: clean_num = "+91" + clean_num
                        elif len(clean_num) == 12 and clean_num.startswith("91"): clean_num = "+" + clean_num
                            
                        cmd_prefix = "su -c " if is_root else ""
                        intent_extras = ""
                        if not is_root:
                            # Fallback intent extra routing for non-rooted Android brands (Oppo, Vivo, Lava, Micromax, etc.)
                            intent_extras = " --ei simId 1 --ei com.android.phone.extra.slot 1 --ei slot 1 --ei phone 1 --ei subscription 1"
                        
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