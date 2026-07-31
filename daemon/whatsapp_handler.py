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
    ui_debug = data.get('ui_debug', False)
    _execute_whatsapp(device, phone, message, run_cmd, media_filename, supabase, ui_debug=ui_debug)


def _execute_whatsapp(device, phone, message, run_cmd, media_filename=None, supabase=None, custom_reporter=None, ui_debug=False):
    """
    Why: Core WhatsApp ADB dispatch. Uses api.whatsapp.com deeplink for text-only
    or ACTION_SEND for media. Polls uiautomator XML for send button, then taps.
    Reports progress milestones to system_state.whatsapp_progress for the frontend.
    """
    def report(status):
        if custom_reporter:
            try:
                custom_reporter(status)
            except Exception as cr_ex:
                print(f"⚠️ Custom progress reporter failed: {cr_ex}")
        if supabase:
            try:
                supabase.table('system_state').update({'whatsapp_progress': status}).eq('id', 1).execute()
            except Exception as e:
                print(f"⚠️ Error reporting progress: {e}")

        # Wait for user confirmation in database if UI debugging is enabled
        if ui_debug and status in ('ran_script', 'opened_whatsapp', 'types_draft', 'sent', 'verified'):
            confirm_field = f"confirm_{status}"
            print(f"⏰ [UI DEBUG] Step '{status}' completed. Waiting for UI confirmation...")
            
            # Reset confirmation field in database state first
            try:
                supabase.table('system_state').update({confirm_field: 'waiting'}).eq('id', 1).execute()
            except Exception as reset_ex:
                print(f"⚠️ Error resetting confirmation field: {reset_ex}")

            # Poll for user decision
            confirmed = False
            for _ in range(600): # 10 minutes timeout max
                time.sleep(1.0)
                try:
                    res = supabase.table('system_state').select(confirm_field).eq('id', 1).execute().data
                    if res and res[0].get(confirm_field) == 'success':
                        confirmed = True
                        print(f"✅ [UI DEBUG] Step '{status}' confirmed successfully by user!")
                        break
                    elif res and res[0].get(confirm_field) == 'failure':
                        raise RuntimeError(f"User rejected step: {status}")
                except Exception as db_err:
                    if "rejected" in str(db_err):
                        raise db_err
                    print(f"⚠️ Polling confirmation error: {db_err}")
            
            if not confirmed:
                raise RuntimeError(f"UI confirmation timed out for step: {status}")

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
            time.sleep(2.0)
            
            # Query content provider to get content:// URI instead of raw file://
            content_uri = None
            uri_query_cmd = f"adb -s {device} shell \"content query --uri content://media/external/file --projection _id --where \\\"_data='{device_path}'\\\"\""
            query_res = run_cmd(uri_query_cmd)
            m_id = re.search(r'_id=(\d+)', query_res)
            if m_id:
                content_uri = f"content://media/external/file/{m_id.group(1)}"
            else:
                # Fallback to images specific URI
                uri_query_cmd_img = f"adb -s {device} shell \"content query --uri content://media/external/images/media --projection _id --where \\\"_data='{device_path}'\\\"\""
                query_res_img = run_cmd(uri_query_cmd_img)
                m_id_img = re.search(r'_id=(\d+)', query_res_img)
                if m_id_img:
                    content_uri = f"content://media/external/images/media/{m_id_img.group(1)}"
            
            # If the media database resolver is lagging, force insert it to content provider to get a valid URI
            if not content_uri:
                mime_insert = "image/png" if ext == ".png" else ("image/jpeg" if ext in (".jpg", ".jpeg") else mime_type)
                insert_cmd = f"adb -s {device} shell \"content insert --uri content://media/external/file --bind _data:s:{device_path} --bind mime_type:s:{mime_insert}\""
                insert_res = run_cmd(insert_cmd)
                m_ins = re.search(r'row\s+(\d+)', insert_res, re.IGNORECASE)
                if m_ins:
                    content_uri = f"content://media/external/file/{m_ins.group(1)}"
                else:
                    # Parse alternate insert result formats
                    m_ins_alt = re.search(r'id=(\d+)', insert_res, re.IGNORECASE)
                    if m_ins_alt:
                        content_uri = f"content://media/external/file/{m_ins_alt.group(1)}"
            
            stream_uri = content_uri if content_uri else f"file://{device_path}"
            print(f"[*] Dispatching media stream URI: {stream_uri}")
            
            extra_text = f"--es android.intent.extra.TEXT '{message}'" if message else ""
            # Try starting with explicit ContactPicker component first to bypass ResolverActivity
            component_name = f"{pkg}/com.whatsapp.ContactPicker"
            cmd = f"adb -s {device} shell am start -a android.intent.action.SEND -t {mime_type} -e jid {clean_num}@s.whatsapp.net --eu android.intent.extra.STREAM {stream_uri} {extra_text} -n {component_name} --grant-read-uri-permission --grant-write-uri-permission --receiver-permission android.permission.WRITE_EXTERNAL_STORAGE"
            result = run_cmd(cmd)
            print(f"[*] am start explicit component result: {result}")
            if "Error" in result or "does not exist" in result or "ActivityNotFoundException" in result:
                # Fallback to package-only matching if explicit component fails
                cmd = f"adb -s {device} shell am start -a android.intent.action.SEND -t {mime_type} -e jid {clean_num}@s.whatsapp.net --eu android.intent.extra.STREAM {stream_uri} {extra_text} -p {pkg} --grant-read-uri-permission --grant-write-uri-permission --receiver-permission android.permission.WRITE_EXTERNAL_STORAGE"
                result = run_cmd(cmd)
                print(f"[*] am start fallback result: {result}")
        else:
            print(f"[*] WhatsApp text. Prefilling chat: {clean_num}...")
            encoded_msg = urllib.parse.quote(message)
            url = f"https://wa.me/{clean_num}?text={encoded_msg}"
            result = run_cmd(f"adb -s {device} shell am start -a android.intent.action.VIEW -d '{url}' -p {pkg}")
            print(f"[*] am start (text) result: {result}")

        if result and "Error" in result:
            raise RuntimeError(f"am start failed: {result}")

        # Verify WhatsApp package is active in foreground with retries and ResolverActivity handling
        is_foreground = False
        fallback_run = False
        foreground_check = ""
        for attempt in range(4):
            time.sleep(1.0)
            foreground_check = run_cmd(f"adb -s {device} shell \"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'\"")
            print(f"[*] Foreground window status (attempt {attempt + 1}/4): {foreground_check}")
            if pkg in foreground_check:
                is_foreground = True
                break
            elif "ResolverActivity" in foreground_check:
                if not fallback_run:
                    print("[*] Unrestricted ResolverActivity detected. Dismissing and trying package-restricted fallback...")
                    run_cmd(f"adb -s {device} shell input keyevent 4")  # Back button to dismiss
                    time.sleep(0.8)
                    cmd = f"adb -s {device} shell am start -a android.intent.action.SEND -t {mime_type} -e jid {clean_num}@s.whatsapp.net --eu android.intent.extra.STREAM {stream_uri} {extra_text} -p {pkg} --grant-read-uri-permission --grant-write-uri-permission --receiver-permission android.permission.WRITE_EXTERNAL_STORAGE"
                    fallback_res = run_cmd(cmd)
                    print(f"[*] am start package-restricted fallback result: {fallback_res}")
                    fallback_run = True
                else:
                    print("[*] Restricted ResolverActivity detected, selecting WhatsApp automatically...")
                    # Tap center of screen / select default option on app resolver chooser dialog if present
                    run_cmd(f"adb -s {device} shell input keyevent 23")  # KEYCODE_ENTER / DPAD_CENTER
                    run_cmd(f"adb -s {device} shell input tap 540 1200")

        if not is_foreground:
            raise RuntimeError(f"WhatsApp did not open on device. Current focus: {foreground_check.strip()}")

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

