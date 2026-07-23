import os
import sys
import time
import datetime
import json
import subprocess

# If not running inside the local virtual environment, re-execute using the venv python
venv_python = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "bin", "python")
if os.path.exists(venv_python) and sys.executable != venv_python:
    os.execv(venv_python, [venv_python] + sys.argv)

# Add current folder to path to resolve local imports correctly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from supabase import create_client, ClientOptions

from adb_helper import (
    run_cmd,
    get_connected_devices,
    check_rooted,
    check_package,
    get_device_details,
    perform_usb_sync,
    get_sim_cards,
    get_dialer_intent_extras,
    get_device_ip,
    get_default_outgoing_phone_account,
    save_device_defaults,
    restore_device_defaults
)

# --- SETUP SUPABASE ---
# Try to load .env from parent directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(PROJECT_ROOT, ".env")
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

options = ClientOptions(postgrest_client_timeout=10)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)

def get_image_thumbnail_base64(file_path):
    try:
        from PIL import Image
        import io
        import base64
        with Image.open(file_path) as img:
            img.thumbnail((120, 120))
            buffered = io.BytesIO()
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(buffered, format="JPEG", quality=60)
            return "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"⚠️ Thumbnail generation failed for {file_path}: {e}")
        return ""

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

def get_incoming_number(device):
    """
    Resolves the incoming caller number using dumpsys telephony, dumpsys notification, and logcat.
    """
    import re
    # Method 1: dumpsys telephony.registry
    out_tel = run_cmd(f"adb -s {device} shell \"dumpsys telephony.registry | grep mCallIncomingNumber\"")
    for line in out_tel.splitlines():
        if "mCallIncomingNumber=" in line:
            num = line.split("=", 1)[1].strip()
            clean = re.sub(r'[^\d+]', '', num)
            if len(clean) >= 10:
                return clean

    # Method 2: dumpsys notification (dialer notification extras)
    out_notif = run_cmd(f"adb -s {device} shell \"dumpsys notification | grep -E 'extras=|android.title|android.text|Notification\(pkg='\"")
    pkg = ""
    for line in out_notif.splitlines():
        if "Notification(pkg=" in line:
            pkg_match = re.search(r'pkg=([^\s\),]+)', line)
            if pkg_match:
                pkg = pkg_match.group(1).lower()
        if any(keyword in pkg for keyword in ["dialer", "phone", "incall", "telecom"]):
            nums = re.findall(r'\b[+0-9\s-]{10,20}\b', line)
            for n in nums:
                clean = re.sub(r'[^\d+]', '', n)
                if len(clean) >= 10:
                    return clean

    # Method 3: logcat -d
    out_log = run_cmd(f"adb -s {device} shell \"logcat -d -b main -t 150 | grep -Ei 'incoming|phone_state|callstate|calllog'\"")
    for line in out_log.splitlines():
        nums = re.findall(r'\b[+0-9\s-]{10,20}\b', line)
        for n in nums:
            clean = re.sub(r'[^\d+]', '', n)
            if len(clean) >= 10:
                if "197" in clean or len(clean) > 15:
                    continue
                return clean
                
    return None

# --- MAIN DAEMON LOOP ---
def main():
    print("🚀 AeroDial Local Daemon Started (JSON Ready).\n")
    devices = []
    is_connected = False
    active_call_task_id = None
    last_device_check, last_state_check, last_queue_check, last_whatsapp_sync, last_bulk_check = 0.0, 0.0, 0.0, 0.0, 0.0
    last_status_sent = None
    saved_devices_in_session = set()

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
                
                # Detect incoming call details
                call_state = get_call_state(device)
                
                # Auto-save defaults if connection is made using root and call is idle
                if is_root and call_state == 0 and device not in saved_devices_in_session:
                    defaults = get_default_outgoing_phone_account(device, is_root)
                    save_device_defaults(device, defaults)
                    saved_devices_in_session.add(device)

                # --- WhatsApp Media Library Sync ---
                media_files = []
                try:
                    # 1. Ensure phone media directory exists
                    run_cmd(f"adb -s {device} shell \"mkdir -p /data/local/tmp/aerodial_media/ && chmod 777 /data/local/tmp/aerodial_media/\"")
                    # 2. Get list of files on phone
                    files_out = run_cmd(f"adb -s {device} shell \"ls -p /data/local/tmp/aerodial_media/ | grep -v /\"")
                    phone_files = [f.strip() for f in files_out.splitlines() if f.strip() and not f.startswith("ls:")]
                    
                    # 3. Ensure local cache directory exists
                    cache_dir = os.path.join(PROJECT_ROOT, "daemon", "media_cache")
                    os.makedirs(cache_dir, exist_ok=True)
                    
                    # 4. Pull new files from phone to host cache
                    for filename in phone_files:
                        local_path = os.path.join(cache_dir, filename)
                        if not os.path.exists(local_path):
                            print(f"[*] Syncing new media file from phone: {filename}")
                            run_cmd(f'adb -s {device} pull /data/local/tmp/aerodial_media/{filename} {local_path}')
                        
                        mime_type = "application/octet-stream"
                        ext = os.path.splitext(filename)[1].lower()
                        thumbnail = ""
                        if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
                            mime_type = f"image/{ext[1:]}" if ext != ".jpg" else "image/jpeg"
                            thumbnail = get_image_thumbnail_base64(local_path)
                        elif ext == ".pdf":
                            mime_type = "application/pdf"
                            
                        media_files.append({
                            "filename": filename,
                            "mime_type": mime_type,
                            "thumbnail": thumbnail
                        })
                    
                    # 5. Clean up stale local cache files
                    for f in os.listdir(cache_dir):
                        if f not in phone_files:
                            try:
                                os.remove(os.path.join(cache_dir, f))
                            except Exception:
                                pass
                except Exception as m_ex:
                    print(f"⚠️ Error syncing media library: {m_ex}")

                incoming_number = None
                incoming_caller_name = None
                if call_state == 1:  # RINGING
                    incoming_number = get_incoming_number(device)
                    if incoming_number:
                        clean_num = incoming_number
                        if len(clean_num) == 10:
                            clean_num = "+91" + clean_num
                        elif len(clean_num) == 12 and clean_num.startswith("91"):
                            clean_num = "+" + clean_num
                        
                        last_10 = clean_num[-10:]
                        # Lookup contact info
                        contact_res = supabase.table('contacts').select('poc_name, business_name').like('phone_number', f'%{last_10}').execute()
                        if contact_res.data:
                            incoming_caller_name = contact_res.data[0].get('poc_name') or contact_res.data[0].get('business_name')
                        else:
                            jd_res = supabase.table('justdial_leads').select('name, lead_name').like('phone', f'%{last_10}').execute()
                            if jd_res.data:
                                incoming_caller_name = jd_res.data[0].get('name') or jd_res.data[0].get('lead_name')
                
                status_payload = {
                    "status": "connected",
                    "device_ip": get_device_ip(device),
                    "is_root": is_root,
                    "truecaller": tc_installed,
                    "whatsapp": w4b_installed,
                    "brand": details["brand"],
                    "model": details["model"],
                    "os_name": details["os_name"],
                    "dialer_details": details["dialer_details"],
                    "phone_support": details["phone_support"],
                    "sim_cards": sims,
                    "default_sim_slot": default_sim_slot,
                    "call_state": call_state,
                    "incoming_call": {
                        "number": incoming_number,
                        "name": incoming_caller_name or "Unknown Caller"
                    } if incoming_number else None,
                    "media_files": media_files
                }
                current_status = json.dumps(status_payload)
            else:
                saved_devices_in_session.clear()
                current_status = json.dumps({"status": "disconnected"})
            
            status_changed = (current_status != last_status_sent)
            if status_changed or (now - last_state_check >= 3.0):
                last_state_check = now
                last_status_sent = current_status
                if db_state:
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    supabase.table('system_state').update({
                        'adb_status': current_status,
                        'updated_at': now_iso
                    }).eq('id', 1).execute()

                    cmd_str = db_state.get('command', 'idle')
                    if cmd_str and cmd_str != 'idle':
                        cmd_data = {}
                        if cmd_str.startswith('{'):
                            try:
                                cmd_data = json.loads(cmd_str)
                            except Exception:
                                pass
                        
                        action = cmd_data.get('action')

                        # 1. Connection-independent commands (connect wireless)
                        if action == 'connect_wireless_adb':
                            ip = cmd_data.get('ip')
                            if ip:
                                print(f"[*] Remote Command Received: CONNECT WIRELESS ADB to {ip}...")
                                # Try to switch any USB-connected devices to TCPIP mode first
                                usb_devs = [d for d in get_connected_devices() if ":" not in d]
                                if usb_devs:
                                    print(f"[*] Switching USB device {usb_devs[0]} to tcpip mode...")
                                    run_cmd(f"adb -s {usb_devs[0]} tcpip 5555")
                                    time.sleep(3)
                                
                                connect_res = run_cmd(f"adb connect {ip}")
                                print(f"[+] ADB connect output: {connect_res}")
                            supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                        
                        # 2. Media commands (work with any available device, don't need heartbeat)
                        elif action == 'upload_media':
                            filename = cmd_data.get('filename')
                            print(f"[*] upload_media received for: {filename}")
                            target_dev = device if is_connected else (get_connected_devices() or [None])[0]
                            if filename and target_dev:
                                try:
                                    # Try fetching chunks first
                                    chunks_resp = supabase.table('media_chunks').select('data_base64').eq('filename', filename).order('chunk_index', desc=False).execute()
                                    chunks_rows = chunks_resp.data or []
                                    file_base64 = None
                                    if chunks_rows:
                                        print(f"[*] Assembling file from {len(chunks_rows)} chunks...")
                                        file_base64 = "".join(chunk['data_base64'] for chunk in chunks_rows)
                                    else:
                                        # Fallback to media_queue
                                        queue_resp = supabase.table('media_queue').select('id,file_base64').eq('filename', filename).order('created_at', desc=True).limit(1).execute()
                                        queue_rows = queue_resp.data or []
                                        if queue_rows:
                                            file_base64 = queue_rows[0]['file_base64']
                                        
                                    if not file_base64:
                                        print(f"⚠️ No media_queue or media_chunks rows found for: {filename}")
                                    else:
                                        import base64 as b64mod
                                        cache_dir = os.path.join(PROJECT_ROOT, "daemon", "media_cache")
                                        os.makedirs(cache_dir, exist_ok=True)
                                        local_path = os.path.join(cache_dir, filename)
                                        if "," in file_base64:
                                            file_base64 = file_base64.split(",", 1)[1]
                                        raw_bytes = b64mod.b64decode(file_base64)
                                        with open(local_path, "wb") as f:
                                            f.write(raw_bytes)
                                        print(f"[*] Staged file locally: {local_path} ({len(raw_bytes)} bytes)")
                                        run_cmd(f'adb -s {target_dev} shell "mkdir -p /data/local/tmp/aerodial_media && chmod 777 /data/local/tmp/aerodial_media"')
                                        push_result = run_cmd(f'adb -s {target_dev} push "{local_path}" "/data/local/tmp/aerodial_media/{filename}"', timeout=180)
                                        print(f"[*] adb push result: {push_result}")
                                        run_cmd(f'adb -s {target_dev} shell "chmod 666 \\"/data/local/tmp/aerodial_media/{filename}\\""')
                                        
                                        # Clean up database records
                                        if chunks_rows:
                                            supabase.table('media_chunks').delete().eq('filename', filename).execute()
                                        else:
                                            supabase.table('media_queue').delete().eq('filename', filename).execute()
                                        print(f"[✓] Media file uploaded and pushed to device: {filename}")
                                except Exception as ex:
                                    print(f"⚠️ Error uploading media file: {ex}")
                                    import traceback
                                    traceback.print_exc()
                            elif not target_dev:
                                print(f"⚠️ upload_media: no device available")
                            supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

                        elif action == 'delete_media':
                            filename = cmd_data.get('filename')
                            target_dev = device if is_connected else (get_connected_devices() or [None])[0]
                            if filename and target_dev:
                                try:
                                    print(f"[*] Deleting media file: {filename} from phone and cache...")
                                    run_cmd(f'adb -s {target_dev} shell "rm \\"/data/local/tmp/aerodial_media/{filename}\\""')
                                    cache_dir = os.path.join(PROJECT_ROOT, "daemon", "media_cache")
                                    local_path = os.path.join(cache_dir, filename)
                                    if os.path.exists(local_path):
                                        os.remove(local_path)
                                except Exception as ex:
                                    print(f"⚠️ Error deleting media file: {ex}")
                            supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

                        # 3. Commands that require an active connection
                        elif is_connected:
                            if cmd_str == 'run_sync':
                                success = perform_usb_sync(device)
                                supabase.table('system_state').update({
                                    'command': 'idle', 
                                    'adb_status': current_status
                                }).eq('id', 1).execute()
                            elif cmd_str == 'sync_call_logs':
                                print("[*] Remote Command Received: SYNC CALL LOGS FROM DEVICE...")
                                script_path = os.path.join(PROJECT_ROOT, "scripts", "sync_recent_4days.py")
                                env_copy = os.environ.copy()
                                if 'VITE_SUPABASE_URL' in env_copy and 'SUPABASE_URL' not in env_copy:
                                    env_copy['SUPABASE_URL'] = env_copy['VITE_SUPABASE_URL']
                                if 'VITE_SUPABASE_ANON_KEY' in env_copy and 'SUPABASE_ANON_KEY' not in env_copy:
                                    env_copy['SUPABASE_ANON_KEY'] = env_copy['VITE_SUPABASE_ANON_KEY']
                                
                                try:
                                    res = subprocess.run([sys.executable, script_path], capture_output=True, text=True, env=env_copy, timeout=120)
                                    print(f"[+] Sync script output:\n{res.stdout}\n{res.stderr}")
                                except Exception as ex:
                                    print(f"⚠️ Error running call logs sync script: {ex}")
                                
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
                            elif action == 'whatsapp':
                                from whatsapp_handler import handle_whatsapp_json
                                handle_whatsapp_json(device, cmd_data, run_cmd)
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                            elif action == 'truecaller_lookup':
                                from truecaller_handler import handle_truecaller_json
                                handle_truecaller_json(device, cmd_data, run_cmd, supabase)
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                            elif action == 'install_truecaller':
                                apk_path = os.path.join(PROJECT_ROOT, "resources", "Truecaller_v26.27.5.apk")
                                if os.path.exists(apk_path):
                                    print(f"[*] Installing Truecaller APK: {apk_path}")
                                    res = run_cmd(f"adb -s {device} install -r \"{apk_path}\"")
                                    print(f"[*] Install output: {res}")
                                else:
                                    print(f"❌ Error: Truecaller APK not found at {apk_path}")
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                            else:
                                # Reset unknown command
                                supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()
                        else:
                            # Not connected and not a connection-independent command
                            supabase.table('system_state').update({'command': 'idle'}).eq('id', 1).execute()

            if is_connected:
                if now - last_whatsapp_sync >= 15.0:
                    last_whatsapp_sync = now
                    try:
                        from whatsapp_handler import sync_whatsapp_history
                        sync_whatsapp_history(device, run_cmd, supabase)
                    except Exception as sync_ex:
                        print(f"⚠️ WhatsApp background sync error: {sync_ex}")

                if now - last_bulk_check >= 5.0:
                    last_bulk_check = now
                    try:
                        from whatsapp_bulk_handler import process_bulk_messaging
                        process_bulk_messaging(device, run_cmd, supabase)
                    except Exception as bulk_ex:
                        print(f"⚠️ WhatsApp bulk messaging error: {bulk_ex}")

                call_state = get_call_state(device)
                if call_state != 0:
                    print(f"\n[*] Active call state detected: {call_state}. Measuring duration...")
                    start_time_ms = int(time.time() * 1000)
                    start_time_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    import datetime as dt_mod
                    start_time_formatted = dt_mod.datetime.now().strftime("%B %d, %Y | %I:%M %p")
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
                    if is_root:
                        restore_device_defaults(device, is_root)
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
                                'last_call_at': start_time_formatted,
                                'last_contact_at': start_time_iso,
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
                                    'last_contact_at': start_time_iso,
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
                        
                        # Verify if the call became active within 5 seconds; if not, restore defaults immediately
                        call_detected = False
                        for _ in range(10):  # 10 * 0.5s = 5s
                            if get_call_state(device) != 0:
                                call_detected = True
                                break
                            time.sleep(0.5)

                        if not call_detected:
                            print("⚠️ Outgoing call did not connect or start. Restoring SIM defaults.")
                            if is_root:
                                restore_device_defaults(device, is_root)
                        
            elif not is_connected and now - last_queue_check >= 1.0:
                last_queue_check = now
                supabase.table('call_queue').update({'status': 'failed_no_connection'}).eq('status', 'dialing').execute()

            time.sleep(0.1)
        except Exception as e:
            print(f"⚠️ Network/DB Error in main loop: {e}")
            time.sleep(2)

if __name__ == "__main__":
    main()