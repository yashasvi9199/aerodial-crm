# Android Telecom and Settings ADB Reference

This document compiles research on querying, setting, and resetting default SIM/calling configurations on Android (AOSP/LineageOS) devices via ADB.

## 1. Querying SIM Preferences and Telecom State

### Check Current Default Voice SIM
To retrieve the active voice subscription ID:
```bash
adb shell settings get global multi_sim_voice_call
adb shell settings get global multi_sim_voice_call_subscription
```
*Note: A returned value of `-1` indicates "Ask every time" (or no preference).*

### Get Selected Outgoing Phone Account
To inspect the system-wide default phone account:
```bash
adb shell dumpsys telecom | grep -E "mUserSelectedOutgoingPhoneAccount|UserSelectedOutgoingPhoneAccount"
```
#### Output Formats:
* **Ask every time / Unset:**
  `mUserSelectedOutgoingPhoneAccount: null`
* **Default Set:**
  `mUserSelectedOutgoingPhoneAccount: PhoneAccountHandle [ComponentInfo{com.android.phone/com.android.services.telephony.TelephonyConnectionService}, 1, UserHandle{0}]`
  - **Component Name:** `com.android.phone/com.android.services.telephony.TelephonyConnectionService`
  - **Subscription ID / Account ID:** `1`

---

## 2. Modifying SIM Preferences via Root

### Set Default Outgoing Account
To permanently override the default calling SIM for the device:
```bash
adb shell su -c "telecom set-user-selected-outgoing-phone-account <COMPONENT> <ID> 0"
```
*Example:*
```bash
adb shell su -c "telecom set-user-selected-outgoing-phone-account com.android.phone/com.android.services.telephony.TelephonyConnectionService 1 0"
```

### Set Default SIM Database Values
```bash
adb shell su -c "settings put global multi_sim_voice_call <SUB_ID>"
adb shell su -c "settings put global multi_sim_voice_call_subscription <SUB_ID>"
```

---

## 3. Resetting to "Ask Every Time"

### Clear/Reset Telecom Default Outgoing Account
Since there is no native `clear` command in `telecom set-user-selected-outgoing-phone-account`, we pass an invalid ID (`-1`) to force the Telecom framework to fall back to prompt:
```bash
adb shell su -c "telecom set-user-selected-outgoing-phone-account com.android.phone/com.android.services.telephony.TelephonyConnectionService -1 0"
```

### Clear/Reset Settings Database Values
```bash
adb shell su -c "settings put global multi_sim_voice_call -1"
adb shell su -c "settings put global multi_sim_voice_call_subscription -1"
```
Combining these resets triggers the "Ask every time" prompt on next call.
