import os
import re
import time
import urllib.request
import urllib.parse

def handle_whatsapp(device, command, run_cmd):
    parts = command.split('|')
    phone = parts[1]
    message = parts[2]
    file_url = parts[3] if len(parts) > 3 else ''
    file_name = parts[4] if len(parts) > 4 else ''
    _execute_whatsapp(device, phone, message, file_url, file_name, run_cmd)

def handle_whatsapp_json(device, data, run_cmd):
    phone = data.get('phone', '')
    message = data.get('message', '')
    file_url = data.get('file_url', '')
    file_name = data.get('file_name', '')
    _execute_whatsapp(device, phone, message, file_url, file_name, run_cmd)

def handle_push_template(device, command, run_cmd):
    parts = command.split('|')
    file_url = parts[1]
    file_name = parts[2]
    _execute_push_template(device, file_url, file_name, run_cmd)

def handle_push_template_json(device, data, run_cmd):
    file_url = data.get('file_url', '')
    file_name = data.get('file_name', '')
    _execute_push_template(device, file_url, file_name, run_cmd)

def _execute_whatsapp(device, phone, message, file_url, file_name, run_cmd):
    try:
        clean_num = re.sub(r'\D', '', phone)
        if not clean_num.startswith('91') and len(clean_num) == 10:
            clean_num = '91' + clean_num
            
        if file_url:
            rpath = f"/sdcard/Download/{file_name}"
            if file_url != 'local_file':
                print(f"[*] WhatsApp media. Downloading: {file_name}...")
                ddir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
                os.makedirs(ddir, exist_ok=True)
                lpath = os.path.join(ddir, file_name)
                urllib.request.urlretrieve(file_url, lpath)
                
                print(f"[*] Pushing {file_name} to phone...")
                run_cmd(f"adb -s {device} push \"{lpath}\" \"{rpath}\"")
                run_cmd(f"adb -s {device} shell \"am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://{rpath}\"")
            else:
                print(f"[*] Using local template media: {file_name}...")

            ext = os.path.splitext(file_name)[1].lower()
            mime = "*/*"
            if ext in ['.jpg', '.jpeg', '.png']: mime = "image/*"
            elif ext in ['.mp4', '.mkv', '.3gp']: mime = "video/*"
            elif ext in ['.pdf']: mime = "application/pdf"
            elif ext in ['.mp3', '.wav', '.ogg']: mime = "audio/*"
            
            print("[*] Opening WhatsApp Business sharing screen...")
            escaped_msg = message.replace("'", "'\\''")
            run_cmd(f"adb -s {device} shell \"am start -a android.intent.action.SEND -t {mime} --eu android.intent.extra.STREAM file://{rpath} --es android.intent.extra.TEXT '{escaped_msg}' com.whatsapp.w4b\"")
        else:
            print(f"[*] WhatsApp text. Prefilling chat: {clean_num}...")
            url = f"https://api.whatsapp.com/send?phone={clean_num}&text={urllib.parse.quote(message)}"
            run_cmd(f"adb -s {device} shell \"am start -a android.intent.action.VIEW -d '{url}' com.whatsapp.w4b\"")
            
            # Wait for WhatsApp and keyboard to fully load, polling for send button
            send_btn_coords = None
            for attempt in range(5):
                time.sleep(1.0)
                print(f"[*] Polling for send button (attempt {attempt + 1}/5)...")
                run_cmd(f"adb -s {device} shell uiautomator dump /sdcard/w_dump.xml", timeout=6)
                xml = run_cmd(f"adb -s {device} shell cat /sdcard/w_dump.xml", timeout=6)
                run_cmd(f"adb -s {device} shell rm /sdcard/w_dump.xml", timeout=4)
                
                # Check for send button
                m = re.search(r'resource-id="[^"]*id/send"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
                if m:
                    x1, y1, x2, y2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
                    send_btn_coords = ((x1 + x2) // 2, (y1 + y2) // 2)
                    break
            
            if send_btn_coords:
                cx, cy = send_btn_coords
                print(f"[*] Send button found at ({cx}, {cy}). Tapping...")
                run_cmd(f"adb -s {device} shell input tap {cx} {cy}")
                time.sleep(0.5)
                run_cmd(f"adb -s {device} shell input tap {cx} {cy}")
            else:
                print("⚠️ Send button not detected in UI dump. Attempting fallback tap / keyevent...")
                size_out = run_cmd(f"adb -s {device} shell wm size")
                size_match = re.search(r'(\d+)x(\d+)', size_out)
                if size_match:
                    width = int(size_match.group(1))
                    height = int(size_match.group(2))
                    cx = width - 70
                    cy = height - 70
                    print(f"[*] Tapping fallback bottom-right coordinates ({cx}, {cy})...")
                    run_cmd(f"adb -s {device} shell input tap {cx} {cy}")
                else:
                    run_cmd(f"adb -s {device} shell input keyevent 22")
                    time.sleep(0.2)
                    run_cmd(f"adb -s {device} shell input keyevent 66")
    except Exception as ex:
        print(f"⚠️ WhatsApp error: {ex}")

def _execute_push_template(device, file_url, file_name, run_cmd):
    try:
        print(f"[*] Pre-caching template file to phone: {file_name}...")
        ddir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
        os.makedirs(ddir, exist_ok=True)
        lpath = os.path.join(ddir, file_name)
        urllib.request.urlretrieve(file_url, lpath)
        
        rpath = f"/sdcard/Download/{file_name}"
        run_cmd(f"adb -s {device} push \"{lpath}\" \"{rpath}\"")
        run_cmd(f"adb -s {device} shell \"am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://{rpath}\"")
        print(f"✅ Pre-cached template file: {file_name}")
    except Exception as ex:
        print(f"⚠️ Push template error: {ex}")
