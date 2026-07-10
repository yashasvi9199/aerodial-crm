import os
import re
import sqlite3
import datetime

def handle_truecaller_json(device, data, run_cmd, supabase):
    phone = data.get('phone', '')
    if not phone:
        return
        
    print(f"[*] Truecaller lookup command for phone: {phone}...")
    
    # Extract digits
    clean_num = re.sub(r'\D', '', phone)
    if len(clean_num) < 10:
        print(f"⚠️ Invalid phone number for Truecaller lookup: {phone}")
        return
        
    phone_10_digits = clean_num[-10:]
    search_num = "0" + phone_10_digits
    
    db_phone_path = "/data/data/com.truecaller/databases/tc.db"
    db_local_path = "daemon/tc_sync.db"
    
    truecaller_name = None
    
    def try_sqlite_query():
        name_val = None
        try:
            # Copy Truecaller database from device
            run_cmd(f"adb -s {device} shell \"su -c 'cp {db_phone_path} /data/local/tmp/tc_sync.db && chmod 666 /data/local/tmp/tc_sync.db'\"")
            run_cmd(f"adb -s {device} pull /data/local/tmp/tc_sync.db {db_local_path}")
            run_cmd(f"adb -s {device} shell \"su -c 'rm /data/local/tmp/tc_sync.db'\"")
            
            if os.path.exists(db_local_path):
                conn = sqlite3.connect(db_local_path)
                cursor = conn.cursor()
                
                # Query history_with_aggregated_contact_number first (more recent calls)
                cursor.execute("""
                    SELECT contact_name, cached_name 
                    FROM history_with_aggregated_contact_number 
                    WHERE (normalized_number LIKE ? OR raw_number LIKE ? OR normalized_number LIKE ? OR raw_number LIKE ?)
                      AND (contact_name IS NOT NULL AND contact_name != '' OR cached_name IS NOT NULL AND cached_name != '')
                    ORDER BY timestamp DESC LIMIT 1
                """, (f"%{search_num}", f"%{search_num}", f"%{phone_10_digits}", f"%{phone_10_digits}"))
                row = cursor.fetchone()
                if row:
                    name_val = row[0] or row[1]
                else:
                    # Query raw_contact
                    cursor.execute("""
                        SELECT contact_name 
                        FROM raw_contact 
                        WHERE (contact_default_number LIKE ? OR search_query LIKE ? OR contact_default_number LIKE ? OR search_query LIKE ?)
                          AND contact_name IS NOT NULL AND contact_name != ''
                        LIMIT 1
                    """, (f"%{search_num}", f"%{search_num}", f"%{phone_10_digits}", f"%{phone_10_digits}"))
                    row = cursor.fetchone()
                    if row:
                        name_val = row[0]
                        
                conn.close()
        except Exception as ex:
            print(f"⚠️ Truecaller SQLite lookup failed: {ex}")
        finally:
            if os.path.exists(db_local_path):
                try:
                    os.remove(db_local_path)
                except Exception:
                    pass
        return name_val

    # 1. Query the database first
    truecaller_name = try_sqlite_query()
    
    # 2. Fallback to launching the app if not found
    if not truecaller_name or truecaller_name == 'Searching...':
        print(f"[*] Launching Truecaller intent fallback for: {phone_10_digits}...")
        run_cmd(f"adb -s {device} shell am start -a android.intent.action.VIEW -d \"truecaller://search?query={phone_10_digits}\"")
        import time
        time.sleep(3.5)
        # Attempt query again
        truecaller_name = try_sqlite_query()
                
    # Normalize phone key for Supabase cache (format: +91XXXXXXXXXX)
    sb_phone = f"+91{phone_10_digits}"
    
    # Save/upsert to Supabase
    try:
        payload = {
            'phone_number': sb_phone,
            'name': truecaller_name or 'Not Found',
            'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        supabase.table('truecaller_cache').upsert(payload).execute()
        print(f"✅ Truecaller cache updated for {sb_phone}: {truecaller_name or 'Not Found'}")
    except Exception as db_ex:
        print(f"⚠️ Supabase upsert error: {db_ex}")
