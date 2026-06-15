# AeroDial CRM - System Features

## 1. Outbound Dialing Engine
- **Rooted SIM Routing**: Programmatically binds outgoing voice calls to Airtel (SIM 2) subscription using root-level Android shell commands (`telecom set-user-selected-outgoing-phone-account`).
- **SIM Preference Restoration**: Automatically restores calling preferences to "Ask every time" upon call completion.
- **Short-Code Routing**: Native support for carrier short codes (like `197` or `121`) by avoiding dialing format prepends.

## 2. Local Bridge Daemon
- **Real-Time Call Queueing**: Monitors Supabase `call_queue` changes via real-time hooks to trigger outgoing calls automatically.
- **ADB Telemetry Logging**: Queries the device call log database after each call to retrieve talk duration, which is mapped back to contacts or leads. Fully supports multi-SIM devices by aggregating states across all slots.
- **Active Call Controls**: Remotely hang up active calls using `input keyevent 6` triggered from the web interface.
- **Environment Security Isolation**: Strict isolation of credentials with zero hardcoded API endpoints or tokens in code files, relying solely on runtime environment configurations.
- **Wireless Connection Prioritization**: Automatically prioritizes wireless TCP/IP interfaces over USB to prevent connection lockups during dial dispatches.
- **Low-Latency Polling**: High-frequency 100ms listener execution utilizing timestamp checks, rendering latency negligible while cutting idle database/ADB resources by 80%.

## 3. High-Fidelity Dashboard
- **Performance Metrics**: Direct insights into Total Calls, Connection Rate, Average Talk Time, and Total Records.
- **Dynamic Charts**: Interactive, SVG-based charts tracking call frequency and talk time distribution.
- **Real-Time Bridge Indicator**: Visual indicator showing whether the local Android device is successfully connected.

## 4. Cold Calling Workspace
- **Pipeline Filters**: Double-row sidebar filters supporting `All`, `Follow Up`, `Missed`, `Called`, `Answered`, and `Not Called`.
- **Excel Bulk Import**: Merges and normalizes contact sheets, formats dates, and safely upserts records.
- **Purge Contacts**: Integrated UI button to clean the active contact table for fresh workspace imports.
- **Form Dismissal**: Automatically deselects records and empties the details panel upon successful updates.

## 5. JustDial Leads Management
- **Unified details panel**: Integrated Direct Dialer card on top (10-digit text input) with lead form below.
- **Lead Quality Classification**: Classifies leads into `Correct Leads` and `Invalid Leads` with corresponding sidebar tabs.
- **Form Dismissal**: Automatically deselects records and empties the details panel upon successful updates.

## 6. Unified Search Engine (All Contacts)
- **Fuzzy Subsequence Matching**: Real-time fuzzy query over all records including names, business names, phone numbers, location, and profession.
- **Debounced Inputs**: Leverages React input debouncing to prevent search lags and heavy database queries.
- **Card-Based Visual Layout**: Display cards styled dynamically based on origin (Green borders and tags for Cold Calling, Blue borders and tags for Justdial Leads).
- **Inline Card Editing**: Click the Edit icon on a card to render inputs directly within the card, removing sidebars and popups.

## 7. Telemetry & Activity Counters
- **Call Attempts Tracking**: Automatically increments `call_count` for contacts and leads.
- **Dually-Functional Logging**: Automatically registers incoming and outgoing calls and links them to database CRM records.
- **History Sync Tool**: ADB-based python sync tool to pull past calls and batch update records.
