import os
import re
import sys
import time
import random
import subprocess
import datetime
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase Environment Variables.")
    print("Please export SUPABASE_URL and SUPABASE_ANON_KEY before running.")
    sys.exit(1)

def run_cmd(command):
    res = subprocess.run(command, shell=True, capture_output=True, text=True)
    return res.stdout.strip()

def get_connected_devices():
    devices = []
    out = run_cmd("adb devices")
    for line in out.splitlines()[1:]:
        if line.strip() and ("device" in line) and not ("list of" in line.lower()):
            parts = line.split()
            if len(parts) >= 2 and parts[1] == 'device':
                devices.append(parts[0])
    return devices

def main():
    print("--- AeroDial History Sync (4-Day Depth & Random Backfill) ---")
    
    # Check ADB devices
    devices = get_connected_devices()
    if not devices:
        print("❌ Error: No connected Android device found via ADB.")
        sys.exit(1)
        
    device = devices[0]
    print(f"[*] Connected device: {device}")
    
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Retrieve target sub_id based on selected default_sim_slot
    target_sub_id = None
    try:
        state_res = supabase.table('system_state').select('default_sim_slot, adb_status').eq('id', 1).execute()
        if state_res.data:
            db_state = state_res.data[0]
            default_sim_slot = db_state.get('default_sim_slot', 0) or 0
            adb_status_str = db_state.get('adb_status', '')
            if adb_status_str.startswith('{'):
                import json
                status_data = json.loads(adb_status_str)
                sims = status_data.get('sim_cards', [])
                for sim in sims:
                    if sim.get('slot') == default_sim_slot:
                        target_sub_id = sim.get('sub_id')
                        print(f"[*] Target SIM slot: {default_sim_slot}, matched subscription_id: {target_sub_id}")
                        break
    except Exception as e:
        print(f"⚠️ Error mapping target SIM slot: {e}")

    # 4 days ago timestamp
    four_days_ago_ms = int((time.time() - 4 * 24 * 3600) * 1000)
    print(f"[*] Querying call log database since 4 days ago ({datetime.datetime.fromtimestamp(four_days_ago_ms/1000).strftime('%Y-%m-%d %H:%M:%S')})...")
    
    projection = "date:duration:number:type:subscription_id"
    cmd = f"adb -s {device} shell \"su -c 'content query --uri content://call_log/calls --projection {projection} --where \\\"date >= {four_days_ago_ms}\\\" --sort \\\"date DESC\\\"'\""
    out = run_cmd(cmd)
    
    if not out:
        print("⚠️ No call logs returned from device query.")
        sys.exit(0)
        
    if "number=" not in out:
        print(f"❌ Error querying logs: {out}")
        sys.exit(1)
        
    calls = []
    for line in out.splitlines():
        if "number=" not in line:
            continue
        date_match = re.search(r'date=(\d+)', line)
        dur_match = re.search(r'duration=(\d+)', line)
        num_match = re.search(r'number=([+\d#*]+)', line)
        type_match = re.search(r'type=(\d+)', line)
        sub_id_match = re.search(r'subscription_id=(\d+)', line)
        
        if date_match and num_match and type_match:
            # Filter by subscription_id if target_sub_id is mapped
            if target_sub_id is not None and sub_id_match:
                try:
                    sub_id = int(sub_id_match.group(1))
                    if sub_id != target_sub_id:
                        continue
                except ValueError:
                    pass
            
            calls.append({
                'date_ms': int(date_match.group(1)),
                'duration': int(dur_match.group(1)) if dur_match else 0,
                'number': num_match.group(1),
                'type': int(type_match.group(1))
            })
            
    print(f"[+] Retrieved {len(calls)} logs from device. Syncing call_logs table...")
    
    logs_added = 0
    logs_updated = 0
    
    # Iterate from oldest to newest to ensure chronological insertion
    for call in reversed(calls):
        raw_number = call['number']
        duration = call['duration']
        date_ms = call['date_ms']
        call_type_id = call['type']
        
        call_type = 'incoming' if call_type_id == 1 else 'outgoing'
        
        # Normalize number
        clean_num = str(raw_number).replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if len(clean_num) == 10:
            clean_num = "+91" + clean_num
        elif len(clean_num) == 12 and clean_num.startswith("91"):
            clean_num = "+" + clean_num
            
        if not clean_num.startswith("+91"):
            continue
            
        last_10 = clean_num[-10:]
        
        # Check if number matches a contact or lead
        contact_id = None
        jd_lead_id = None
        platform = None
        
        contact_res = supabase.table('contacts').select('id').like('phone_number', f'%{last_10}').execute()
        if contact_res.data:
            contact_id = contact_res.data[0]['id']
            platform = 'cold_call'
        else:
            jd_res = supabase.table('justdial_leads').select('id').like('phone', f'%{last_10}').execute()
            if jd_res.data:
                jd_lead_id = jd_res.data[0]['id']
                platform = 'justdial'
                
        # If it doesn't match any entity, skip it
        if not platform:
            continue
            
        # Check if dialed log (type = 2) but duration is 0. If so, update it randomly to 30-110 seconds.
        if call_type_id == 2 and duration == 0:
            duration = random.randint(30, 110)
            
        # Convert date to UTC ISO format
        dt = datetime.datetime.fromtimestamp(date_ms / 1000, datetime.timezone.utc)
        call_date_iso = dt.isoformat()
        
        # Check if already logged (60s window)
        start_win = (dt - datetime.timedelta(seconds=60)).isoformat()
        end_win = (dt + datetime.timedelta(seconds=60)).isoformat()
        
        exist_res = supabase.table('call_logs')\
            .select('id, duration_seconds')\
            .eq('phone_number', clean_num)\
            .gte('call_date', start_win)\
            .lte('call_date', end_win)\
            .execute()
            
        status_log = "Answered" if duration > 0 else "Unanswered"
        
        if exist_res.data:
            existing = exist_res.data[0]
            # Update duration if database currently has 0 or if we're filling a dialed call's duration
            if existing['duration_seconds'] == 0 and duration > 0:
                supabase.table('call_logs').update({
                    'duration_seconds': duration,
                    'status': status_log
                }).eq('id', existing['id']).execute()
                logs_updated += 1
        else:
            # Insert new log
            supabase.table('call_logs').insert({
                'phone_number': clean_num,
                'duration_seconds': duration,
                'status': status_log,
                'call_date': call_date_iso,
                'call_type': call_type,
                'platform': platform,
                'contact_id': contact_id,
                'justdial_lead_id': jd_lead_id
            }).execute()
            logs_added += 1

    print(f"[+] Sync logs table done: {logs_added} logs created, {logs_updated} logs updated.")
    
    # Recalculate totals using aggregation
    print("[*] Fetching all call logs from Supabase for stats aggregation...")
    all_logs = supabase.table('call_logs')\
        .select('contact_id, justdial_lead_id, duration_seconds, status, call_date')\
        .order('call_date', desc=False)\
        .execute().data

    # Group logs by entity
    contact_logs = {}
    lead_logs = {}
    
    for log in all_logs:
        c_id = log.get('contact_id')
        l_id = log.get('justdial_lead_id')
        if c_id:
            if c_id not in contact_logs:
                contact_logs[c_id] = []
            contact_logs[c_id].append(log)
        if l_id:
            if l_id not in lead_logs:
                lead_logs[l_id] = []
            lead_logs[l_id].append(log)

    print(f"[*] Found {len(contact_logs)} contacts and {len(lead_logs)} leads with active call logs.")

    # Reset all contact and lead counters/statuses
    print("[*] Resetting inactive call counts in database...")
    supabase.table('contacts').update({
        'call_count': 0,
        'last_call_at': None,
        'call_duration': None,
        'status_update': 'Not Called'
    }).gt('call_count', 0).execute()

    supabase.table('justdial_leads').update({
        'call_count': 0,
        'contact_state': 'Unanswered',
        'contacted': 'No'
    }).gt('call_count', 0).execute()

    # Update stats for active contacts
    print(f"[*] Updating {len(contact_logs)} active contacts...")
    for c_id, logs in contact_logs.items():
        count = len(logs)
        latest = logs[-1]
        latest_dur = latest['duration_seconds']
        latest_status = latest['status']
        latest_date = latest['call_date']
        
        supabase.table('contacts').update({
            'call_count': count,
            'last_call_at': latest_date,
            'last_contact_at': latest_date,
            'call_duration': f"{latest_dur}s",
            'status_update': latest_status
        }).eq('id', c_id).execute()

    # Update stats for active leads
    print(f"[*] Updating {len(lead_logs)} active leads...")
    for l_id, logs in lead_logs.items():
        count = len(logs)
        latest = logs[-1]
        latest_dur = latest['duration_seconds']
        latest_status = latest['status']
        latest_date = latest['call_date']
        
        supabase.table('justdial_leads').update({
            'call_count': count,
            'updated_at': latest_date,
            'last_contact_at': latest_date,
            'contact_state': latest_status,
            'contacted': 'Yes' if latest_dur > 0 else 'No'
        }).eq('id', l_id).execute()

    print("✅ All-Contacts stats synchronization completed successfully!")

if __name__ == "__main__":
    main()
