# AeroDial CRM & Calling SAAS

A high-fidelity CRM designed to automate outbound calling and lead management using rooted Android ADB SIM switching.

## 🚀 Overview
AeroDial CRM connects directly to a rooted Android device over ADB to automate dials using specific SIM cards (Airtel SIM 2 default), monitors talk duration in real-time, and logs metrics onto a high-performance Supabase database.

---

## 📦 System Features
*For the standalone document, see [FEATURES.md](file:///home/drone/Programming/aerodial-crm/FEATURES.md).*

### 1. Outbound Dialing Engine
- **Rooted SIM Routing**: Programmatically binds outgoing voice calls to Airtel (SIM 2) subscription using root-level Android shell commands (`telecom set-user-selected-outgoing-phone-account`).
- **SIM Preference Restoration**: Automatically restores calling preferences to "Ask every time" upon call completion.
- **Short-Code Routing**: Native support for carrier short codes (like `197` or `121`) by avoiding dialing format prepends.

### 2. Local Bridge Daemon
- **Real-Time Call Queueing**: Monitors Supabase `call_queue` changes via real-time hooks to trigger outgoing calls automatically.
- **ADB Telemetry Logging**: Queries the device call log database after each call to retrieve talk duration, which is mapped back to contacts or leads. Also registers incoming calls and increments call counters on the database.
- **Active Call Controls**: Remotely hang up active calls using `input keyevent 6` triggered from the web interface.

### 3. High-Fidelity Dashboard
- **Performance Metrics**: Direct insights into Total Calls, Connection Rate, Average Talk Time, and Total Records.
- **Dynamic Charts**: Interactive, SVG-based charts tracking call frequency and talk time distribution with clear numerical labels.
- **Bifurcated Outbound Logs**: Logs table split into three tabs (All, Cold Calling, Justdial Leads) for cleaner auditing.

### 4. Cold Calling Workspace
- **Pipeline Filters & Sorting**: Double-row sidebar filters supporting `All` (alphabetically sorted), `Follow Up`, `Missed`, `Called`, `Answered`, and `Not Called` (sorted by last called descending).
- **Excel Bulk Import**: Merges and normalizes contact sheets, formats dates, and safely upserts records.
- **Deselection & Reset**: Added fields reset and avoided auto-selection on tab load or updates.

### 5. JustDial Leads Management
- **Unified details panel**: Integrated Direct Dialer card on top with lead form below.
- **Lead Quality Classification**: Classifies leads into `Correct Leads` and `Invalid Leads` with corresponding sidebar tabs.

### 6. Unified Search Engine
- **Fuzzy Search**: Real-time debounced subsequence fuzzy search over all contacts and leads in a single interface.
- **Inline Card Editing**: Responsive green (Cold Call) and blue (Justdial) cards that transition into inline form editors in-place.

---

## 🛠️ Getting Started
1. **Database Setup**: Run queries inside [supbase_queries.sql](file:///home/drone/Programming/aerodial-crm/supbase_queries.sql) in your Supabase SQL editor.
2. **Daemon Setup**: Source virtual environment, install requirements, and execute the daemon:
   ```bash
   cd daemon
   pip install -r requirements.txt
   python listener.py
   ```
3. **History Sync Script**: Sync calls made directly from the phone manually:
   ```bash
   python scratch/sync_recent_calls.py
   ```
4. **Frontend Development**: Install dependencies and start Vite dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 📅 Changelog
*For the standalone document, see [CHANGELOG.md](file:///home/drone/Programming/aerodial-crm/CHANGELOG.md).*

### [1.4.0] - 2026-06-15
- Added a **Unified Search** tab ("All Contacts") featuring debounced subsequence fuzzy search and inline-editable cards (Green for Cold Calling, Blue for Justdial Leads).
- Implemented **History Sync Script** (`scratch/sync_recent_calls.py`) to manually pull the last 15 call logs from Android call logs via ADB and sync call counts, statuses, and durations.
- Added **Numeric Labels** above SVG bars on both Daily Call Frequency and Daily Duration Load charts on the Dashboard.
- Bifurcated Outbound Logs on Dashboard into three tabs: **All**, **Cold Calling**, and **Justdial Leads**, mapping `'cold_call'` as platform instead of `'excel'`.
- Added **Call Attempt Counters** to contacts/leads, incremented strictly during outgoing/incoming call events.
- Replaced frontend manual call logging with dually-functional ADB state-based daemon tracking (incoming/outgoing) in `listener.py`.
- Refactored sidebar listings for Cold Calling and Justdial Leads into split files to maintain the < 300 lines codebase limit.
- Added fields **Reset** button to form panels.

### [1.3.0] - 2026-06-15
- Created **Lead Quality** selection dropdown (`Correct Lead` vs. `Invalid Lead`) in Justdial Leads details form.
- Added sidebar filter tabs for `Invalid Leads` and `Correct Leads` on the Justdial Leads page.
- Added a **Test Call (197)** button to the sidebar sync panel.
- Appended `lead_quality` column alter migration query to `supbase_queries.sql`.
- Fixed number formatting in `listener.py` to prevent prepending `+91` to carrier short codes (like `197`), allowing them to dial successfully.

### [1.2.0] - 2026-06-15
- Integrated **Notes & Remarks** field to general contacts inside `ColdCalling.jsx` UI and update handler.
- Added a red **Clear Database Contacts** button to the Excel upload panel to purge entries easily.
- Appended `notes` column alter migration query to `supbase_queries.sql`.
- Fixed the Excel upload parser to normalize status columns, mapping unmatched text as `'Answered'` (called) and saving raw values in `notes`.
- Fixed CSS layout syntax bugs (`justifycontent` -> `justifyContent`) in `ColdCalling.jsx`.

### [1.1.0] - 2026-06-14
- Added rooted Android telecom SIM 2 switching mechanism for Airtel.
- Implemented real-time call logging daemon using ADB to monitor `mCallState` transitions and fetch exact talk durations.
- Created SVG charts mapping call totals and average duration frequencies on the Dashboard.
- Configured light (default) and dark theme custom layouts.
- Resolved Supabase 500 bulk import errors by introducing unique phone number deduplication during Excel uploads.
- Resolved Javascript date serialization issue for serial dates.

### [1.0.0] - 2026-06-14
- Initial CRM structure.
- Basic database tables (`contacts`, `call_queue`, `system_state`) and Supabase connections.
- Basic Excel sheet uploads.

---

## 📄 Licensing & Intellectual Property
**Proprietary Software - Copyright (c) 2026 Yash Haldiya. All Rights Reserved.**

This software is confidential and proprietary. No license is granted to copy, distribute, or modify this software. Any unauthorized copying of functions, code blocks, methods, layouts, or schemas from this software constitutes copyright infringement and will result in copyright claim lawsuits, statutory damages, and legal action. 

For full terms, see the [LICENSE](file:///home/drone/Programming/aerodial-crm/LICENSE) file.
