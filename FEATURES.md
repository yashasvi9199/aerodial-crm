# AeroDial CRM - System Features

## 1. Outbound Dialing Engine
- **Rooted SIM Routing**: Programmatically binds outgoing voice calls to Airtel (SIM 2) subscription using root-level Android shell commands (`telecom set-user-selected-outgoing-phone-account`).
- **SIM Preference Restoration**: Automatically restores calling preferences to "Ask every time" upon call completion.
- **Short-Code Routing**: Native support for carrier short codes (like `197` or `121`) by avoiding dialing format prepends.

## 2. Local Bridge Daemon
- **Real-Time Call Queueing**: Monitors Supabase `call_queue` changes via real-time hooks to trigger outgoing calls automatically.
- **ADB Telemetry Logging**: Queries the device call log database after each call to retrieve talk duration, which is mapped back to contacts or leads.
- **Active Call Controls**: Remotely hang up active calls using `input keyevent 6` triggered from the web interface.

## 3. High-Fidelity Dashboard
- **Performance Metrics**: Direct insights into Total Calls, Connection Rate, Average Talk Time, and Total Records.
- **Dynamic Charts**: Interactive, SVG-based charts tracking call frequency and talk time distribution.
- **Real-Time Bridge Indicator**: Visual indicator showing whether the local Android device is successfully connected.

## 4. Cold Calling Workspace
- **Pipeline Filters**: Double-row sidebar filters supporting `All`, `Follow Up`, `Missed`, `Called`, `Answered`, and `Not Called`.
- **Excel Bulk Import**: Merges and normalizes contact sheets, formats dates, and safely upserts records.
- **Purge Contacts**: Integrated UI button to clean the active contact table for fresh workspace imports.

## 5. JustDial Leads Management
- **Unified details panel**: Integrated Direct Dialer card on top (10-digit text input) with lead form below.
- **Lead Quality Classification**: Classifies leads into `Correct Leads` and `Invalid Leads` with corresponding sidebar tabs.
