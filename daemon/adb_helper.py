import subprocess
import re
import time

def run_cmd(command, timeout=15):
    """
    Executes a shell command and returns the stdout result.
    """
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        print(f"⚠️ Command timed out after {timeout}s: {command}")
        return ""

def get_connected_devices():
    """
    Lists currently active ADB devices.
    """
    lines = run_cmd("adb devices").splitlines()[1:]
    devices = [l.split()[0] for l in lines if l.strip() and "device" in l and l.split()[1] == "device"]
    devices.sort(key=lambda d: 0 if ":" in d else 1)
    return devices

def check_rooted(device):
    """
    Checks if the connected device is rooted.
    """
    try:
        test = run_cmd(f"adb -s {device} shell \"su -c id\"")
        if "uid=0" in test:
            return True
    except Exception:
        pass
    try:
        out = run_cmd(f"adb -s {device} shell which su")
        if out and "su" in out:
            return True
    except Exception:
        pass
    return False

def check_package(device, package_name):
    """
    Checks if a package is installed on the device.
    """
    try:
        out = run_cmd(f"adb -s {device} shell \"pm list packages {package_name}\"")
        return package_name in out
    except Exception:
        return False

def get_device_ip(device):
    """
    Attempts to resolve active IP address of the device.
    """
    ip = run_cmd(f"adb -s {device} shell getprop dhcp.wlan0.ipaddress")
    if ip and re.match(r'^\d+\.\d+\.\d+\.\d+$', ip):
        return ip
    out = run_cmd(f"adb -s {device} shell ip route")
    m = re.search(r'src\s+(\d+\.\d+\.\d+\.\d+)', out)
    if m:
        return m.group(1)
    out = run_cmd(f"adb -s {device} shell ip addr show wlan0")
    m = re.search(r'inet\s+(\d+\.\d+\.\d+\.\d+)', out)
    if m:
        return m.group(1)
    return ""

def get_device_details(device):
    """
    Determines device manufacturer, model, OS skin, dialer details, and support level.
    """
    brand = run_cmd(f"adb -s {device} shell getprop ro.product.brand").strip()
    model = run_cmd(f"adb -s {device} shell getprop ro.product.model").strip()
    android_ver = run_cmd(f"adb -s {device} shell getprop ro.build.version.release").strip()
    
    miui_ver = run_cmd(f"adb -s {device} shell getprop ro.miui.ui.version.name").strip()
    color_ver = run_cmd(f"adb -s {device} shell getprop ro.build.version.opporom").strip()
    vivo_ver = run_cmd(f"adb -s {device} shell getprop ro.vivo.os.version").strip()
    huawei_ver = run_cmd(f"adb -s {device} shell getprop ro.build.version.emui").strip()
    hos_ver = run_cmd(f"adb -s {device} shell getprop hw_sc.build.platform.version").strip()
    if not hos_ver:
        hos_ver = run_cmd(f"adb -s {device} shell getprop ro.huawei.build.version.security").strip()

    brand_lower = brand.lower()
    os_name = "AOSP"
    dialer_details = "AOSP Dialer"
    phone_support = "Fully Supported"

    if miui_ver or "xiaomi" in brand_lower or "redmi" in brand_lower or "poco" in brand_lower:
        os_name = "MIUI"
        dialer_details = "MIUI Dialer"
    elif color_ver or "oppo" in brand_lower or "realme" in brand_lower or "oneplus" in brand_lower:
        os_name = "ColorOS"
        dialer_details = "ColorOS Dialer"
    elif vivo_ver or "vivo" in brand_lower or "iqoo" in brand_lower:
        os_name = "FuntouchOS"
        dialer_details = "FuntouchOS Dialer"
    elif hos_ver or "huawei" in brand_lower or "honor" in brand_lower:
        if "1." in hos_ver or "10." in huawei_ver:
            os_name = "HarmonyOS 1"
        elif "2." in hos_ver or "11." in huawei_ver:
            os_name = "HarmonyOS 2"
        elif "3." in hos_ver or "12." in huawei_ver:
            os_name = "HarmonyOS 3"
        else:
            os_name = "HarmonyOS"
        dialer_details = "HarmonyOS Dialer"
    elif "lava" in brand_lower:
        os_name = "LavaOS"
        dialer_details = "Lava Dialer"
    elif "micromax" in brand_lower:
        os_name = "Micromax"
        dialer_details = "Micromax Dialer"

    return {
        "brand": brand,
        "model": model,
        "android_version": android_ver,
        "os_name": os_name,
        "dialer_details": dialer_details,
        "phone_support": phone_support
    }

def perform_usb_sync(device):
    """
    Enables wireless TCP/IP bridge for USB connected device.
    """
    if ":" in device:
        return True
    ip = get_device_ip(device)
    if ip:
        run_cmd(f"adb -s {device} tcpip 5555")
        time.sleep(3)
        run_cmd(f"adb disconnect {ip}:5555")
        for _ in range(2):
            if "connected" in run_cmd(f"adb connect {ip}:5555").lower():
                return True
            time.sleep(1.5)
    return False

def get_sim_cards(device, is_root=False):
    """
    Retrieves information on active SIM cards.
    """
    sims = []
    if is_root:
        try:
            out = run_cmd(f"adb -s {device} shell \"su -c 'content query --uri content://telephony/siminfo --projection _id:sim_id:display_name:number'\"")
            for line in out.splitlines():
                if "sim_id=" in line:
                    id_match = re.search(r'_id=(\d+)', line)
                    sim_id_match = re.search(r'sim_id=(\d+)', line)
                    display_name_match = re.search(r'display_name=([^,]+)', line)
                    number_match = re.search(r'number=([^,]+)', line)
                    if sim_id_match:
                        slot = int(sim_id_match.group(1))
                        sub_id = int(id_match.group(1)) if id_match else slot + 1
                        carrier = display_name_match.group(1) if display_name_match else f"SIM {slot+1}"
                        number = number_match.group(1) if number_match else "Unknown"
                        sims.append({"slot": slot, "sub_id": sub_id, "carrier": carrier.strip(), "number": number.strip()})
            if sims:
                return sims
        except Exception:
            pass

    try:
        out = run_cmd(f"adb -s {device} shell \"dumpsys subscription\"")
        blocks = re.findall(r'\{[^\}]+\}', out)
        for block in blocks:
            if "simSlotIndex" in block:
                slot_m = re.search(r'simSlotIndex=(\d+)', block)
                carrier_m = re.search(r'displayName=([^,\s]+)', block)
                if not carrier_m:
                    carrier_m = re.search(r'displayName=([^,]+)', block)
                num_m = re.search(r'number=([^,\s]+)', block)
                if not num_m:
                    num_m = re.search(r'number=([^,]+)', block)
                
                if slot_m:
                    slot = int(slot_m.group(1))
                    carrier = carrier_m.group(1) if carrier_m else f"SIM {slot+1}"
                    number = num_m.group(1) if num_m else "Unknown"
                    if number == "null" or not number.strip():
                        number = "Unknown"
                    sims.append({"slot": slot, "carrier": carrier.strip(), "number": number.strip()})
        if sims:
            seen_slots = set()
            dedup_sims = []
            for s in sims:
                if s["slot"] not in seen_slots:
                    seen_slots.add(s["slot"])
                    dedup_sims.append(s)
            return dedup_sims
    except Exception:
        pass

    try:
        state = run_cmd(f"adb -s {device} shell getprop gsm.sim.state").strip()
        operators = run_cmd(f"adb -s {device} shell getprop gsm.operator.alpha").strip().split(',')
        if state:
            states = state.split(',')
            for idx, st in enumerate(states):
                if st == "READY":
                    carrier = operators[idx] if idx < len(operators) and operators[idx] else f"SIM {idx+1}"
                    sims.append({"slot": idx, "carrier": carrier, "number": "Unknown"})
    except Exception:
        pass

    return sims

def get_dialer_intent_extras(skin_name, sim_slot):
    """
    Returns intent extra arguments to route the call through the chosen SIM slot.
    """
    extras = f" --ei simId {sim_slot} --ei slot {sim_slot} --ei com.android.phone.extra.slot {sim_slot}"
    skin = skin_name.lower()
    if "miui" in skin:
        extras += f" --ei slot_id {sim_slot} --ei subscription {sim_slot}"
    elif "color" in skin:
        extras += f" --ei subscription {sim_slot}"
    elif "funtouch" in skin:
        extras += f" --ei phone {sim_slot} --ei subscription {sim_slot}"
    elif "harmony" in skin:
        extras += f" --ei subscription {sim_slot}"
    return extras
