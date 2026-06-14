import os
import time
import subprocess
import re
from supabase import create_client, Client

# --- SETUP SUPABASE ---
# Grabs the keys from your fish config environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase Environment Variables.")
    print("Make sure you ran 'source ~/.config/fish/config.fish'")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- ADB FUNCTIONS ---
def run_cmd(command):
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

def check_adb_status():
    """Returns True if a device is connected wirelessly or via USB"""
    out = run_cmd("adb devices")
    return "device\n" in out or "\tdevice" in out

def perform_usb_sync():
    print("\n[*] Remote Command Received: EXECUTING USB SYNC...")
    ip_out = run_cmd("adb -d shell ip addr")
    # Look for standard local network IPs attached to wlan0 or ap0
    matches = re.findall(r'inet\s+(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)', ip_out)
    
    if matches:
        ip = matches[0]
        run_cmd("adb -d tcpip 5555")
        time.sleep(2)
        connect_out = run_cmd(f"adb connect {ip}:5555")
        if "connected" in connect_out.lower():
            print(f"✅ Sync Successful: {ip}")
            return True
    print("❌ Sync Failed. Is USB plugged in?")
    return False

def make_call(number):
    print(f"[*] Dialing: {number}...")
    # Clean the number
    clean_num = str(number).replace(" ", "").replace("-", "")
    clean_num = "+" + clean_num if (clean_num.startswith("91") and len(clean_num) > 10) else "+91" + clean_num if not clean_num.startswith("+91") else clean_num
    
    run_cmd(f'adb shell su -c "am start -a android.intent.action.CALL -d tel:{clean_num}"')

# --- MAIN DAEMON LOOP ---
def main():
    print("🚀 AeroDial Local Daemon Started.")
    print("Listening to Supabase for calls and sync commands...\n")

    while True:
        try:
            # 1. THE HEARTBEAT
            is_connected = check_adb_status()
            current_status = 'connected' if is_connected else 'disconnected'
            
            # 2. CHECK SYSTEM STATE
            state_res = supabase.table('system_state').select('*').eq('id', 1).execute()
            if state_res.data:
                state = state_res.data[0]
                
                if state['adb_status'] != current_status:
                    supabase.table('system_state').update({'adb_status': current_status}).eq('id', 1).execute()

                if state['command'] == 'run_sync':
                    success = perform_usb_sync()
                    supabase.table('system_state').update({
                        'command': 'idle', 
                        'adb_status': 'connected' if success else 'disconnected'
                    }).eq('id', 1).execute()

            # 3. CHECK FOR CALLS
            call_res = supabase.table('call_queue').select('*').eq('status', 'dialing').limit(1).execute()
            if call_res.data:
                call_task = call_res.data[0]
                
                if is_connected:
                    make_call(call_task['number'])
                    supabase.table('call_queue').update({'status': 'call_active'}).eq('id', call_task['id']).execute()
                else:
                    print("⚠️ Missed Call Trigger: Phone is disconnected!")
                    supabase.table('call_queue').update({'status': 'failed_no_connection'}).eq('id', call_task['id']).execute()

            time.sleep(2)

        except Exception as e:
            print(f"⚠️ Network/DB Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()