# AeroDial CRM - System Features

## 1. Outbound Dialing Engine
- **Rooted SIM Routing**: Programmatically binds outgoing voice calls to Airtel (SIM 2) subscription using root-level Android shell commands (`telecom set-user-selected-outgoing-phone-account`).
- **SIM Preference Restoration**: Automatically backs up original default SIM configurations (telecom account and settings DB values) on connection, and restores them after call completion or dialing timeouts.
- **Short-Code Routing**: Native support for carrier short codes (like `197` or `121`) by avoiding dialing format prepends.

## 2. Local Bridge Daemon
- **Real-Time Call Queueing**: Monitors Supabase `call_queue` changes via real-time hooks to trigger outgoing calls automatically.
- **SIM Preference Backup**: Local JSON-based storage of device default SIM configurations for persistence across daemon restarts.
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
- **Pipeline Filters with Live Counts**: Double-row sidebar filters supporting `All`, `Follow Up`, `Missed`, `Called`, `Answered`, and `Not Called`, each displaying real-time contact counts matching that filter.
- **Excel Bulk Import**: Merges and normalizes contact sheets, formats dates, and safely upserts records.
- **Purge Contacts**: Integrated UI button to clean the active contact table for fresh workspace imports.
- **Form Dismissal**: Automatically deselects records and empties the details panel upon successful updates.

## 5. JustDial Leads Management
- **Pipeline Filters with Live Counts**: Sidebar filters supporting `All`, `Follow Up`, `Invalid Leads`, and `Correct Leads`, each displaying real-time lead counts matching that filter.
- **Unified details panel**: Integrated Direct Dialer card on top (10-digit text input) with lead form below.
- **Lead Quality Classification**: Classifies leads into `Correct Leads` and `Invalid Leads` with corresponding sidebar tabs.
- **Form Dismissal**: Automatically deselects records and empties the details panel upon successful updates.

## 6. Unified Search Engine (All Contacts)
- **Fuzzy Subsequence Matching**: Real-time fuzzy query over all records including names, business names, phone numbers, location, and profession.
- **Debounced Inputs**: Leverages React input debouncing to prevent search lags and heavy database queries.
- **Card-Based Visual Layout**: Display cards styled dynamically based on origin (Green borders and tags for Cold Calling, Blue borders and tags for Justdial Leads).
- **Inline Card Editing**: Click the Edit icon on a card to render inputs directly within the card, removing sidebars and popups.

## 7. Telemetry & Activity Counters
- **Call Attempts Tracking & Manual Override**: Automatically increments `call_count` for contacts and leads during active call completions, with support for manual overrides via inline numeric inputs in form panels.
- **Dually-Functional Logging**: Automatically registers incoming and outgoing calls and links them to database CRM records.
- **History Sync Tooling**: ADB-based python sync tools to query past device call logs (supporting 7-day depth and a specialized 4-day depth tool with random 30-110s duration backfilling for dialed calls).

## 8. Database Bulk Updater
- **Multi-Query Builder**: Visual builder to edit and run multiple batch updates in parallel across contacts or leads.
- **Custom Filters and Operators**: Clean dropdown interfaces supporting table fields, target values, operators, and match filters.
- **Dynamic Input Typing**: Automatically adapts inputs (text inputs, numeric, select dropdowns) based on selected database schema columns.

## 9. WhatsApp Business Dispatcher & Live Sync
- **Composition Modal & Sidebar Hub**: Easily compose direct text messages using pre-loaded templates with dynamic `{name}` placeholder resolution.
- **Dedicated Template Manager**: Fully separated component to create and delete templates, preventing form interference and ensuring reliable database saves.
- **Editable Phone and Name Fields**: Allows full recipient input overrides when launching dispatches from any contact detail cards or workspace menus.
- **ADB Automation Engine**: Automatically launches the WhatsApp Business chat view, checks soft keyboard visibility, automatically dismisses the keyboard if active, and simulates send tap gestures.
- **Outbound Telemetry Log**: Registers sent messages in Supabase real-time `whatsapp_logs`, tracking recipient numbers, contact names, message text, and timestamp details.
- **Rich Text Formatting Toolbar**: Interactive styling toolbar buttons (Bold `*`, Italic `_`, Strikethrough `~`, Monospace ` ``` `, Blockquote `>`, Bullet List `-`) wrapping selection or inserting tags at cursor.
- **Real-Time Message Previews**: Inline chat bubble rendering styled message output dynamically using custom HTML text format parsers.
- **Rooted ADB Conversation History Sync**: Daemon-level worker copying and pulling WhatsApp Business local `msgstore.db` using root privileges (`su -c`) to sync actual message logs, delivery ticks, and timelines in real-time.
- **Auto-Send Mechanics**: Automatically launches the WhatsApp Business chat view and simulates a single precise tap gesture on the Send button coordinates, bypassing keyboard dismissals to ensure stable delivery without triggering voice message recording.

## 10. Automated Keep-Alive Scheduler
- **Daily Cron Job**: A scheduled GitHub Actions workflow that executes every 24 hours to automatically ping all free tier deployment endpoints.
- **Database Query Activity**: Triggers light queries against the Supabase `system_state` table to keep the database project active and prevent pause/sleep timers.
- **Git Push Activity Trigger**: Automatically commits and pushes a timestamp log to `scripts/last_ping.txt` to trigger git commit history, keeping GitHub Actions scheduled workflows from being deactivated due to repository inactivity.
- **Web App Pings**: Hitting the Cloudflare Page URL regularly to refresh pages cache and verify live endpoints status.

## 11. Truecaller Name Lookup Cache & UI
- **Rooted SQLite DB Queries**: Copy and query Truecaller's local `tc.db` database directly on the connected phone using root privileges (`su -c`) without ever opening the Truecaller app on the screen.
- **Prepended '0' Search Prefix**: Automatically search using a leading '0' prefix (e.g. `07976401542`) as well as the standard 10-digit number to support matching local format variants on the device.
- **Supabase Cache Integration**: Lookups are cached inside a dedicated Supabase `truecaller_cache` table to enable instant lookup speeds on subsequent card loads.
- **Editable Resolved Profiles**: All resolved Truecaller names displayed in Contacts, Cold Calling Contacts, Justdial Leads, and WhatsApp composers are inline-editable. Editing updates the cached name in the database, preserving custom names for all future views.

## 12. Setup & Diagnostics Panel
- **Multi-Device Brand/OS Skin Detection**: Automatically checks and resolves system build parameters (AOSP, MIUI, HarmonyOS, ColorOS, FuntouchOS, etc.) to determine support status and dialer requirements.
- **SIM Card Scanner**: Reads available SIM slot index, carrier brand, and phone number using root query database fallbacks and non-root `dumpsys` methods.
- **Default SIM Selector**: Configure outbound dialing preference by default (saved in central settings and applied dynamically via ROM-specific intent extra parameters).
- **Failsafe Dialer Fallbacks**: Enhanced 197 test dialog prompts user on successful call. If "No" is chosen, loops through 5 independent dialing fallback formats (ROM slot intents, AOSP intent, and root direct service dialer overrides) to establish a successful connection.
- **Diagnostics Event & Error Logger**: Intercepts console logging and user actions, writing an audit list to `localStorage` (capped at 500 lines) with features to export as JSON or email developer.



