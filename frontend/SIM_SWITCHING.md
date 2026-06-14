# Programmatic Android SIM Switching Architecture

This document explains the structure, logic, and commands used by AeroDial CRM to achieve automated, slot-specific outgoing SIM routing for phone calls on rooted dual-SIM Android devices.

---

## Technical Overview

Modern Android versions (Android 10+) utilize the **Telecom Framework** to route outgoing phone calls. Selecting a default calling SIM programmatically via standard `settings put global` calls does not propagate dynamically to the telephony subsystem. Instead, we use system-level shell commands to interact directly with the `telecom` service.

---

## Component Details

### 1. Subscription Info Resolution
Each SIM card is assigned a unique Subscription ID (`subId`) when registered in the Android system. We query the telephony database to identify the specific `subId` associated with the target carrier.

- **Source Database**: `content://telephony/siminfo`
- **Query Command**:
  ```bash
  adb shell "su -c 'content query --uri content://telephony/siminfo --projection _id:display_name:carrier_name'"
  ```
- **Parsing Logic**: The daemon parses each returned row and matches the `display_name` or `carrier_name` (e.g. `"Airtel"`) to extract its unique integer `_id` (Subscription ID).

### 2. Telephony Connection Service
Telephony accounts are managed by the Android system's Telephony connection component:
`com.android.phone/com.android.services.telephony.TelephonyConnectionService`

---

## Dialing & Reversion Sequence

When a call is initiated through the CRM interface:

### Step 1: Set Default SIM Preference
The daemon sets the user-selected default outgoing phone account to the Airtel Subscription ID (e.g. `1`) via the `telecom` manager:
```bash
adb shell "su -c 'telecom set-user-selected-outgoing-phone-account com.android.phone/com.android.services.telephony.TelephonyConnectionService <sub_id> 0'"
```
*Note: `0` represents the primary user serial number (UserHandle).*

### Step 2: Trigger Intent Dialing
The system places the call programmatically. Because the default account is explicitly locked to Airtel, the call goes through immediately without displaying any interactive SIM selection popups:
```bash
adb shell "su -c 'am start -a android.intent.action.CALL -d tel:<phone_number>'"
```

### Step 3: Monitor Call Lifecycle
The daemon monitors the device's call status by checking `mCallState` from the registry dumps:
```bash
adb shell "dumpsys telephony.registry | grep mCallState"
```
- `mCallState = 2` indicates a call is active (dialing/connected).
- The daemon loops while the call remains active.

### Step 4: Clear Selected Account (Reversion)
Once the call transitions back to idle (`mCallState = 0`), the daemon resets the default calling preference to **"Ask every time"** to preserve the user's manual preference for personal usage. This is achieved by running the set command with no arguments:
```bash
adb shell "su -c 'telecom set-user-selected-outgoing-phone-account'"
```
This nullifies the default voice SIM preference on the device.
