import urllib.parse
import time
import re
import os
import sqlite3
import datetime

def sync_whatsapp_history(device, run_cmd, supabase):
    """
    Syncs recent WhatsApp messages from the device's msgstore.db database
    to the Supabase whatsapp_messages table.
    """
    db_local_path = "daemon/msgstore_sync.db"
    try:
        # 1. Copy the msgstore database to a accessible temp location on the phone
        run_cmd(f"adb -s {device} shell \"su -c 'cp /data/data/com.whatsapp.w4b/databases/msgstore.db /data/local/tmp/msgstore_sync.db && chmod 666 /data/local/tmp/msgstore_sync.db'\"")
        
        # 2. Pull the database file to the host system
        run_cmd(f"adb -s {device} pull /data/local/tmp/msgstore_sync.db {db_local_path}")
        
        # 3. Clean up the temp file on the phone immediately
        run_cmd(f"adb -s {device} shell \"su -c 'rm /data/local/tmp/msgstore_sync.db'\"")
        
        if not os.path.exists(db_local_path):
            print("⚠️ WhatsApp sync failed: msgstore_sync.db could not be pulled.")
            return

        # 4. Connect to local pulled SQLite DB
        conn = sqlite3.connect(db_local_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 5. Fetch latest message timestamp from Supabase
        since_ms = int((time.time() - 7 * 24 * 3600) * 1000) # Default: last 7 days
        try:
            res = supabase.table('whatsapp_messages').select('sent_at').order('sent_at', desc=True).limit(1).execute()
            if res.data:
                latest_iso = res.data[0]['sent_at']
                dt = datetime.datetime.fromisoformat(latest_iso.replace('Z', '+00:00'))
                since_ms = int(dt.timestamp() * 1000)
        except Exception as db_err:
            print(f"[*] Supabase read (fresh table or network): {db_err}")

        # 6. Query SQLite msgstore database for messages since the last synced timestamp
        query = """
            SELECT message.key_id, jid.user, message.from_me, message.status, message.text_data, message.timestamp, message.message_type
            FROM message
            JOIN chat ON message.chat_row_id = chat._id
            JOIN jid ON chat.jid_row_id = jid._id
            WHERE jid.server = 's.whatsapp.net'
              AND message.timestamp > ?
            ORDER BY message.timestamp ASC
        """
        cursor.execute(query, (since_ms,))
        rows = cursor.fetchall()
        
        # 7. Format and batch upsert into Supabase
        upsert_rows = []
        for r in rows:
            dt_sent = datetime.datetime.fromtimestamp(r['timestamp'] / 1000.0, datetime.timezone.utc)
            
            msg_text = r['text_data']
            if not msg_text:
                msg_type = r['message_type']
                if msg_type == 1: msg_text = "[Image]"
                elif msg_type == 2: msg_text = "[Audio]"
                elif msg_type == 3: msg_text = "[Video]"
                elif msg_type == 9: msg_text = "[Document]"
                elif msg_type == 16: msg_text = "[Location]"
                elif msg_type == 10 or msg_type == 65: msg_text = "[Call]"
                else: msg_text = "[Media/Attachment]"

            # Clean and normalize phone number
            phone_num = r['user']
            if not phone_num.startswith('+'):
                phone_num = '+' + phone_num

            upsert_rows.append({
                'key_id': r['key_id'],
                'phone_number': phone_num,
                'from_me': bool(r['from_me']),
                'message_text': msg_text,
                'status': r['status'],
                'sent_at': dt_sent.isoformat()
            })

        if upsert_rows:
            # Batch upsert to Supabase
            supabase.table('whatsapp_messages').upsert(upsert_rows).execute()
            print(f"✅ Synced {len(upsert_rows)} WhatsApp messages to Supabase.")
        
        conn.close()
    except Exception as ex:
        print(f"⚠️ WhatsApp sync exception: {ex}")
    finally:
        # Clean up host temporary copy
        if os.path.exists(db_local_path):
            try:
                os.remove(db_local_path)
            except Exception:
                pass


def handle_whatsapp(device, command, run_cmd):
    parts = command.split('|')
    phone = parts[1]
    message = parts[2]
    _execute_whatsapp(device, phone, message, run_cmd)

def handle_whatsapp_json(device, data, run_cmd, supabase=None):
    phone = data.get('phone', '')
    message = data.get('message', '')
    media_filename = data.get('media_filename')
    _execute_whatsapp(device, phone, message, run_cmd, media_filename, supabase)

def _execute_whatsapp(device, phone, message, run_cmd, media_filename=None, supabase=None):
    """
    Why: Core WhatsApp ADB dispatch. Uses api.whatsapp.com deeplink for text-only
    or ACTION_SEND for media. Polls uiautomator XML for send button, then taps.
    Reports progress milestones to system_state.whatsapp_progress for the frontend.
    """
    def report(status):
        if supabase:
            try:
                supabase.table('system_state').update({'whatsapp_progress': status}).eq('id', 1).execute()
            except Exception as e:
                print(f"⚠️ Error reporting progress: {e}")

    try:
        report("ran_script")

        if not phone or not phone.strip():
            raise ValueError("Phone number is empty or missing")

        clean_num = re.sub(r'\D', '', phone)
        if not clean_num:
            raise ValueError(f"Phone number '{phone}' contains no digits")
        if not clean_num.startswith('91') and len(clean_num) == 10:
            clean_num = '91' + clean_num

        # Detect installed WhatsApp package
        pkg = "com.whatsapp"
        pkg_check = run_cmd(f"adb -s {device} shell \"pm list packages com.whatsapp.w4b\"")
        if "com.whatsapp.w4b" in pkg_check:
            pkg = "com.whatsapp.w4b"
        
        print(f"[*] Using WhatsApp package: {pkg}")

        if media_filename:
            print(f"[*] WhatsApp media dispatch. File: {media_filename} -> {clean_num}...")
            ext = os.path.splitext(media_filename)[1].lower()
            mime_type = "application/pdf" if ext == ".pdf" else "image/*"
            # Use safe filename without spaces for device-side copy
            safe_name = media_filename.replace(' ', '_')
            local_media = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media_cache', media_filename)
            device_path = f"/sdcard/Download/{safe_name}"
            if os.path.exists(local_media):
                run_cmd(f'adb -s {device} push "{local_media}" "{device_path}"', timeout=30)
            else:
                # File might already be on device from previous push
                run_cmd(f'adb -s {device} shell "cp /data/local/tmp/aerodial_media/\'\'{media_filename}\'\' {device_path}"', timeout=10)
            # Broadcast so media scanner indexes it
            run_cmd(f'adb -s {device} shell "am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://{device_path}"', timeout=5)
            time.sleep(0.5)
            extra_text = f"--es android.intent.extra.TEXT '{message}'" if message else ""
            cmd = f'adb -s {device} shell "am start -a android.intent.action.SEND -t {mime_type} -e jid {clean_num}@s.whatsapp.net --eu android.intent.extra.STREAM file://{device_path} {extra_text} -p {pkg}"'
            result = run_cmd(cmd)
            print(f"[*] am start (media) result: {result}")
        else:
            print(f"[*] WhatsApp text. Prefilling chat: {clean_num}...")
            url = f"https://api.whatsapp.com/send?phone={clean_num}&text={urllib.parse.quote(message)}"
            result = run_cmd(f"adb -s {device} shell \"am start -a android.intent.action.VIEW -d '{url}' {pkg}\"")
            print(f"[*] am start (text) result: {result}")

        if result and "Error" in result:
            raise RuntimeError(f"am start failed: {result}")

        report("opened_whatsapp")
        time.sleep(2.0)
        report("types_draft")

        # Poll for send button in WhatsApp UI
        send_btn_coords = None
        last_xml = ""
        for attempt in range(6):
            time.sleep(1.2)
            print(f"[*] Polling for send button (attempt {attempt + 1}/6)...")

            run_cmd(f"adb -s {device} shell uiautomator dump /sdcard/w_dump.xml", timeout=8)

            temp_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "w_dump.xml")
            run_cmd(f"adb -s {device} pull /sdcard/w_dump.xml {temp_path}", timeout=8)
            run_cmd(f"adb -s {device} shell rm /sdcard/w_dump.xml", timeout=4)

            xml = ""
            if os.path.exists(temp_path):
                try:
                    with open(temp_path, "r", encoding="utf-8", errors="ignore") as f:
                        xml = f.read()
                    os.remove(temp_path)
                except Exception as file_ex:
                    print(f"⚠️ Error reading pulled XML dump: {file_ex}")

            last_xml = xml

            # Check for send button by resource-id
            m = re.search(r'resource-id="[^"]*id/send"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
            if m:
                x1, y1, x2, y2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
                send_btn_coords = ((x1 + x2) // 2, (y1 + y2) // 2)
                break

        if send_btn_coords:
            cx, cy = send_btn_coords
            print(f"[*] Send button found at ({cx}, {cy}). Tapping EXACTLY ONCE...")
            report("sent")
            run_cmd(f"adb -s {device} shell input tap {cx} {cy}")
            time.sleep(1.5)
            report("verified")
        else:
            print(f"⚠️ WhatsApp UI dump did not contain send button. Trying fallback...")

            print("⚠️ Send button not detected in UI dump. Attempting fallback tap / keyevent...")
            report("sent")
            size_out = run_cmd(f"adb -s {device} shell wm size")
            size_match = re.search(r'(\d+)x(\d+)', size_out)
            if size_match:
                width, height = int(size_match.group(1)), int(size_match.group(2))
                cx, cy = width - 70, height - 70
                print(f"[*] Tapping fallback bottom-right coordinates ({cx}, {cy})...")
                run_cmd(f"adb -s {device} shell input tap {cx} {cy}")
            else:
                run_cmd(f"adb -s {device} shell input keyevent 22")
                time.sleep(0.2)
                run_cmd(f"adb -s {device} shell input keyevent 66")
            time.sleep(1.5)
            report("verified")
    except Exception as ex:
        print(f"⚠️ WhatsApp error: {ex}")
        report(f"error:{str(ex)}")
        raise ex

