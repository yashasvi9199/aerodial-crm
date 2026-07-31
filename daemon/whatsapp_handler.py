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
        if ui_debug and status in ('ran_script', 'opened_whatsapp', 'types_draft', 'sent', 'typing_text', 'sent_text', 'verified'):
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

        # Target WhatsApp Business strictly
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
            
            # Normalize path for db query (replace /sdcard/ with /storage/emulated/0/)
            norm_path = device_path.replace('/sdcard/', '/storage/emulated/0/')
            
            # Try 1: Query by normalized path on external file provider
            uri_query_cmd = f"adb -s {device} shell \"content query --uri content://media/external/file --projection _id --where \\\"_data='{norm_path}'\\\"\""
            query_res = run_cmd(uri_query_cmd)
            m_id = re.search(r'_id=(\d+)', query_res)
            if m_id:
                content_uri = f"content://media/external/file/{m_id.group(1)}"
            
            # Try 2: Query by raw path (original fallback) if normalized didn't work
            if not content_uri:
                uri_query_cmd = f"adb -s {device} shell \"content query --uri content://media/external/file --projection _id --where \\\"_data='{device_path}'\\\"\""
                query_res = run_cmd(uri_query_cmd)
                m_id = re.search(r'_id=(\d+)', query_res)
                if m_id:
                    content_uri = f"content://media/external/file/{m_id.group(1)}"

            # Try 3: Query by display_name (very robust on Android 10+!)
            if not content_uri:
                uri_query_cmd = f"adb -s {device} shell \"content query --uri content://media/external/file --projection _id --where \\\"_display_name='{safe_name}'\\\"\""
                query_res = run_cmd(uri_query_cmd)
                m_id = re.search(r'_id=(\d+)', query_res)
                if m_id:
                    content_uri = f"content://media/external/file/{m_id.group(1)}"
            
            # Try 4: Query by display_name in specific images URI
            if not content_uri and ext in (".png", ".jpg", ".jpeg", ".webp"):
                uri_query_cmd_img = f"adb -s {device} shell \"content query --uri content://media/external/images/media --projection _id --where \\\"_display_name='{safe_name}'\\\"\""
                query_res_img = run_cmd(uri_query_cmd_img)
                m_id_img = re.search(r'_id=(\d+)', query_res_img)
                if m_id_img:
                    content_uri = f"content://media/external/images/media/{m_id_img.group(1)}"
                    
            # Try 5: Query by normalized path in images specific table
            if not content_uri and ext in (".png", ".jpg", ".jpeg", ".webp"):
                uri_query_cmd_img = f"adb -s {device} shell \"content query --uri content://media/external/images/media --projection _id --where \\\"_data='{norm_path}'\\\"\""
                query_res_img = run_cmd(uri_query_cmd_img)
                m_id_img = re.search(r'_id=(\d+)', query_res_img)
                if m_id_img:
                    content_uri = f"content://media/external/images/media/{m_id_img.group(1)}"

            # If the media database resolver is lagging, force insert it to content provider to get a valid URI
            if not content_uri:
                mime_insert = "image/png" if ext == ".png" else ("image/jpeg" if ext in (".jpg", ".jpeg") else mime_type)
                insert_cmd = f"adb -s {device} shell \"content insert --uri content://media/external/file --bind _data:s:{norm_path} --bind mime_type:s:{mime_insert}\""
                insert_res = run_cmd(insert_cmd)
                if "UNIQUE constraint failed" in insert_res or "SQLiteConstraintException" in insert_res:
                    # It exists but wasn't found - try to query again by display name specifically
                    print("[*] UNIQUE constraint on insert, searching again by display name...")
                    uri_query_cmd = f"adb -s {device} shell \"content query --uri content://media/external/file --projection _id --where \\\"_display_name='{safe_name}'\\\"\""
                    query_res = run_cmd(uri_query_cmd)
                    m_id = re.search(r'_id=(\d+)', query_res)
                    if m_id:
                        content_uri = f"content://media/external/file/{m_id.group(1)}"
                else:
                    m_ins = re.search(r'row\s+(\d+)', insert_res, re.IGNORECASE)
                    if m_ins:
                        content_uri = f"content://media/external/file/{m_ins.group(1)}"
                    else:
                        m_ins_alt = re.search(r'id=(\d+)', insert_res, re.IGNORECASE)
                        if m_ins_alt:
                            content_uri = f"content://media/external/file/{m_ins_alt.group(1)}"
            
            stream_uri = content_uri if content_uri else f"file://{device_path}"
            print(f"[*] Dispatching media stream URI: {stream_uri}")
            
            # Quote mime_type to prevent shell glob expansion of image/*
            quoted_mime = f"'{mime_type}'"

            # Media intents: do NOT include message text here — it breaks am start parsing.
            # Text will be typed and sent as a second message after the media is dispatched.
            intents_to_try = [
                f"adb -s {device} shell am start -a android.intent.action.SEND -t {quoted_mime} -n {pkg}/com.whatsapp.contact.ui.picker.ExternalShareAlias --eu android.intent.extra.STREAM {stream_uri} -e jid {clean_num}@s.whatsapp.net --grant-read-uri-permission --grant-write-uri-permission",
                f"adb -s {device} shell am start -a android.intent.action.SEND -t {quoted_mime} -p {pkg} --eu android.intent.extra.STREAM {stream_uri} -e jid {clean_num}@s.whatsapp.net --grant-read-uri-permission --grant-write-uri-permission",
                f"adb -s {device} shell am start -a android.intent.action.SEND -t {quoted_mime} -n {pkg}/com.whatsapp.ContactPicker --eu android.intent.extra.STREAM {stream_uri} -e jid {clean_num}@s.whatsapp.net --grant-read-uri-permission --grant-write-uri-permission",
                f"adb -s {device} shell am start -a android.intent.action.SEND -t {quoted_mime} -n {pkg}/com.whatsapp.biz.ContactPicker --eu android.intent.extra.STREAM {stream_uri} -e jid {clean_num}@s.whatsapp.net --grant-read-uri-permission --grant-write-uri-permission",
                f"adb -s {device} shell am start -a android.intent.action.SEND -t {quoted_mime} -n {pkg}/com.whatsapp.ContactPickerActivity --eu android.intent.extra.STREAM {stream_uri} -e jid {clean_num}@s.whatsapp.net --grant-read-uri-permission --grant-write-uri-permission",
                f"adb -s {device} shell am start -a android.intent.action.SEND -t {quoted_mime} --eu android.intent.extra.STREAM {stream_uri} -e jid {clean_num}@s.whatsapp.net --grant-read-uri-permission --grant-write-uri-permission"
            ]
            
            is_foreground = False
            foreground_check = ""
            for idx, cmd in enumerate(intents_to_try):
                print(f"[*] Trying to open WhatsApp with media (Method {idx+1}/{len(intents_to_try)})...")
                result = run_cmd(cmd)
                print(f"[*] am start package-targeted result: {result}")
                if result and "Error" in result:
                    continue
                
                # Check foreground status for this method
                for attempt in range(3):
                    time.sleep(1.0)
                    foreground_check = run_cmd(f"adb -s {device} shell \"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'\"")
                    print(f"[*] Foreground window status (Method {idx+1}, attempt {attempt + 1}/3): {foreground_check}")
                    if pkg in foreground_check:
                        is_foreground = True
                        break
                    elif "ResolverActivity" in foreground_check:
                        print("[*] ResolverActivity detected, selecting WhatsApp Business automatically...")
                        run_cmd(f"adb -s {device} shell input keyevent 23")  # KEYCODE_ENTER
                        run_cmd(f"adb -s {device} shell input tap 540 1200")
                        time.sleep(1.0)
                        foreground_check = run_cmd(f"adb -s {device} shell \"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'\"")
                        if pkg in foreground_check:
                            is_foreground = True
                            break
                if is_foreground:
                    break
        else:
            print(f"[*] WhatsApp text. Prefilling chat: {clean_num}...")
            encoded_msg = urllib.parse.quote(message)
            url = f"https://wa.me/{clean_num}?text={encoded_msg}"
            result = run_cmd(f"adb -s {device} shell am start -a android.intent.action.VIEW -d '{url}' -p {pkg}")
            print(f"[*] am start (text) result: {result}")
            
            # Verify text open
            is_foreground = False
            foreground_check = ""
            for attempt in range(4):
                time.sleep(1.0)
                foreground_check = run_cmd(f"adb -s {device} shell \"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'\"")
                print(f"[*] Foreground window status (text check, attempt {attempt + 1}/4): {foreground_check}")
                if pkg in foreground_check:
                    is_foreground = True
                    break
                elif "ResolverActivity" in foreground_check:
                    print("[*] ResolverActivity detected, selecting WhatsApp Business automatically...")
                    run_cmd(f"adb -s {device} shell input keyevent 23")  # KEYCODE_ENTER
                    run_cmd(f"adb -s {device} shell input tap 540 1200")
                    time.sleep(1.0)
                    foreground_check = run_cmd(f"adb -s {device} shell \"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'\"")
                    if pkg in foreground_check:
                        is_foreground = True
                        break

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
        else:
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

        # After media is sent, send the text message as a second message in the same chat
        if media_filename and message:
            print(f"[*] Media sent. Now typing text message in same chat...")
            report('typing_text')
            time.sleep(2.0)

            # Tap the message input field to ensure it's focused
            input_coords = None
            run_cmd(f"adb -s {device} shell uiautomator dump /sdcard/w_dump.xml", timeout=8)
            temp_path_input = os.path.join(os.path.dirname(os.path.abspath(__file__)), "w_dump_input.xml")
            run_cmd(f"adb -s {device} pull /sdcard/w_dump.xml {temp_path_input}", timeout=8)
            run_cmd(f"adb -s {device} shell rm /sdcard/w_dump.xml", timeout=4)
            if os.path.exists(temp_path_input):
                try:
                    with open(temp_path_input, "r", encoding="utf-8", errors="ignore") as fi:
                        xml_input = fi.read()
                    os.remove(temp_path_input)
                    # Look for the message input entry field
                    m_input = re.search(r'resource-id="[^"]*id/entry"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml_input)
                    if m_input:
                        ix1, iy1, ix2, iy2 = int(m_input.group(1)), int(m_input.group(2)), int(m_input.group(3)), int(m_input.group(4))
                        input_coords = ((ix1 + ix2) // 2, (iy1 + iy2) // 2)
                except Exception as inp_ex:
                    print(f"⚠️ Error reading input field XML: {inp_ex}")

            if input_coords:
                print(f"[*] Tapping message input field at {input_coords}...")
                run_cmd(f"adb -s {device} shell input tap {input_coords[0]} {input_coords[1]}")
                time.sleep(0.5)
            else:
                print("[*] Message input field not found, tapping approximate center-bottom...")
                size_out2 = run_cmd(f"adb -s {device} shell wm size")
                size_m2 = re.search(r'(\d+)x(\d+)', size_out2)
                if size_m2:
                    run_cmd(f"adb -s {device} shell input tap {int(size_m2.group(1)) // 2} {int(size_m2.group(2)) - 120}")
                    time.sleep(0.5)

            # Shell-escape for ADB input text (spaces become %s)
            safe_input = message.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('\n', ' ').replace('$', '\\$').replace('`', '\\`').replace(' ', '%s')
            run_cmd(f"adb -s {device} shell input text '{safe_input}'")
            time.sleep(1.0)
            # Find and tap the send button for the text message
            text_send_coords = None
            for t_attempt in range(4):
                time.sleep(1.0)
                run_cmd(f"adb -s {device} shell uiautomator dump /sdcard/w_dump.xml", timeout=8)
                temp_path2 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "w_dump2.xml")
                run_cmd(f"adb -s {device} pull /sdcard/w_dump.xml {temp_path2}", timeout=8)
                run_cmd(f"adb -s {device} shell rm /sdcard/w_dump.xml", timeout=4)
                xml2 = ""
                if os.path.exists(temp_path2):
                    try:
                        with open(temp_path2, "r", encoding="utf-8", errors="ignore") as f2:
                            xml2 = f2.read()
                        os.remove(temp_path2)
                    except Exception:
                        pass
                m2 = re.search(r'resource-id="[^"]*id/send"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml2)
                if m2:
                    x1, y1, x2, y2 = int(m2.group(1)), int(m2.group(2)), int(m2.group(3)), int(m2.group(4))
                    text_send_coords = ((x1 + x2) // 2, (y1 + y2) // 2)
                    break
            if text_send_coords:
                print(f"[*] Text send button at {text_send_coords}. Tapping...")
                run_cmd(f"adb -s {device} shell input tap {text_send_coords[0]} {text_send_coords[1]}")
            else:
                print("[*] Text send button not found, using Enter keyevent...")
                run_cmd(f"adb -s {device} shell input keyevent 66")
            time.sleep(1.5)
            report('sent_text')
            print("[*] Text message sent as second message.")

        report("verified")
    except Exception as ex:
        print(f"⚠️ WhatsApp error: {ex}")
        report(f"error:{str(ex)}")
        raise ex

