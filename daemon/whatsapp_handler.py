import urllib.parse
import time
import re

def handle_whatsapp(device, command, run_cmd):
    parts = command.split('|')
    phone = parts[1]
    message = parts[2]
    _execute_whatsapp(device, phone, message, run_cmd)

def handle_whatsapp_json(device, data, run_cmd):
    phone = data.get('phone', '')
    message = data.get('message', '')
    _execute_whatsapp(device, phone, message, run_cmd)

def _execute_whatsapp(device, phone, message, run_cmd):
    try:
        clean_num = re.sub(r'\D', '', phone)
        if not clean_num.startswith('91') and len(clean_num) == 10:
            clean_num = '91' + clean_num
            
        print(f"[*] WhatsApp text. Prefilling chat: {clean_num}...")
        url = f"https://api.whatsapp.com/send?phone={clean_num}&text={urllib.parse.quote(message)}"
        run_cmd(f"adb -s {device} shell \"am start -a android.intent.action.VIEW -d '{url}' com.whatsapp.w4b\"")
        
        # Wait for WhatsApp and keyboard to fully load, polling for send button
        send_btn_coords = None
        for attempt in range(5):
            time.sleep(1.0)
            print(f"[*] Polling for send button (attempt {attempt + 1}/5)...")
            
            # Dismiss virtual keyboard if active to prevent button occlusion
            kbd_out = run_cmd(f"adb -s {device} shell \"dumpsys input_method | grep mInputShown\"")
            if "mInputShown=true" in kbd_out:
                print("[*] Soft keyboard is open. Sending BACK keyevent to dismiss...")
                run_cmd(f"adb -s {device} shell input keyevent 4")
                time.sleep(0.5)
                
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
                width, height = int(size_match.group(1)), int(size_match.group(2))
                cx, cy = width - 70, height - 70
                print(f"[*] Tapping fallback bottom-right coordinates ({cx}, {cy})...")
                run_cmd(f"adb -s {device} shell input tap {cx} {cy}")
            else:
                run_cmd(f"adb -s {device} shell input keyevent 22")
                time.sleep(0.2)
                run_cmd(f"adb -s {device} shell input keyevent 66")
    except Exception as ex:
        print(f"⚠️ WhatsApp error: {ex}")
