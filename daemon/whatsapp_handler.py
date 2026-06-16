import os
import re
import time
import urllib.request
import urllib.parse

def handle_whatsapp(device, command, run_cmd):
    try:
        parts = command.split('|')
        phone = parts[1]
        message = parts[2]
        file_url = parts[3] if len(parts) > 3 else ''
        file_name = parts[4] if len(parts) > 4 else ''
        
        clean_num = re.sub(r'\D', '', phone)
        if not clean_num.startswith('91') and len(clean_num) == 10:
            clean_num = '91' + clean_num
            
        if file_url:
            print(f"[*] WhatsApp media. Downloading: {file_name}...")
            ddir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
            os.makedirs(ddir, exist_ok=True)
            lpath = os.path.join(ddir, file_name)
            urllib.request.urlretrieve(file_url, lpath)
            
            rpath = f"/sdcard/Download/{file_name}"
            run_cmd(f"adb -s {device} push \"{lpath}\" \"{rpath}\"")
            run_cmd(f"adb -s {device} shell \"am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://{rpath}\"")
            
            ext = os.path.splitext(file_name)[1].lower()
            mime = "*/*"
            if ext in ['.jpg', '.jpeg', '.png']: mime = "image/*"
            elif ext in ['.mp4', '.mkv', '.3gp']: mime = "video/*"
            elif ext in ['.pdf']: mime = "application/pdf"
            elif ext in ['.mp3', '.wav', '.ogg']: mime = "audio/*"
            
            print("[*] Opening WhatsApp Business sharing screen...")
            run_cmd(f"adb -s {device} shell \"am start -a android.intent.action.SEND -t {mime} --eu android.intent.extra.STREAM file://{rpath} com.whatsapp.w4b\"")
        else:
            print(f"[*] WhatsApp text. Prefilling chat: {clean_num}...")
            url = f"https://api.whatsapp.com/send?phone={clean_num}&text={urllib.parse.quote(message)}"
            run_cmd(f"adb -s {device} shell \"am start -a android.intent.action.VIEW -d '{url}' com.whatsapp.w4b\"")
            time.sleep(3.5)
            size_out = run_cmd(f"adb -s {device} shell wm size")
            m = re.search(r'(\d+)x(\d+)', size_out)
            if m:
                w, h = int(m.group(1)), int(m.group(2))
                run_cmd(f"adb -s {device} shell input tap {int(w * 0.92)} {int(h * 0.95)}")
    except Exception as ex:
        print(f"⚠️ WhatsApp error: {ex}")
