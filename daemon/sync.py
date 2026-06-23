import subprocess
import re
import time
import shlex

def run_cmd(command):
    if isinstance(command, str):
        command = shlex.split(command)
    result = subprocess.run(command, shell=False, capture_output=True, text=True)
    return result.stdout.strip()

def get_phone_ip():
    print("[*] Detecting phone IP via USB...")
    # Get all IP addresses from the phone
    output = run_cmd("adb -d shell ip addr")
    
    # Look for standard local network IPs (192.168.x.x or 10.x.x.x) attached to wlan0 or ap0
    matches = re.findall(r'inet\s+(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)', output)
    
    if matches:
        # Return the first valid local IP found
        return matches[0]
    return None

def main():
    print("--- AeroDial USB Sync ---")
    
    # 1. Check for USB device
    devices = run_cmd("adb devices")
    if "device\n" not in devices and "\tdevice" not in devices:
        print("❌ Error: No Android device found. Please plug in via USB and ensure USB Debugging is on.")
        return

    # 2. Extract IP
    ip_address = get_phone_ip()
    if not ip_address:
        print("❌ Error: Could not find a valid Wi-Fi or Hotspot IP on the phone.")
        print("Make sure the phone is connected to the office Wi-Fi or broadcasting its Hotspot.")
        return
        
    print(f"[+] Found Phone IP: {ip_address}")

    # 3. Restart ADB in TCP mode
    print("[*] Opening wireless port 5555...")
    run_cmd("adb -d tcpip 5555")
    time.sleep(2) # Give the phone daemon a second to restart
    
    # 4. Connect Wirelessly
    print(f"[*] Connecting to {ip_address}:5555...")
    connect_out = run_cmd(f"adb connect {ip_address}:5555")
    
    if "connected" in connect_out.lower():
        print(f"\n✅ SUCCESS! Wireless bridge established.")
        print("🔌 You can now unplug the USB cable.")
    else:
        print(f"\n⚠️ Connection failed: {connect_out}")

if __name__ == "__main__":
    main()
