# Changelog

All notable changes to this project will be documented in this file.

## [1.4.1] - 2026-06-15
### Added
- Added custom hover tooltips on Dashboard charts showing numbers, call counts, and formatted time (seconds, minutes, and hours).
- Segmented the Detailed Outbound Logs table using inline date dividers (Today, Yesterday, This Week, This Month).
- Enhanced Outbound Logs to display both business/lead names and POC/individual names in a single field.
- Re-engineered the Python history sync script to use an optimized grouped query aggregation, reducing database network calls from 2000+ to under 40 requests.
- Resolved ADB content query shell quotation errors for device call log lookups.

## [1.4.0] - 2026-06-15
### Added
- Added a **Unified Search** tab ("All Contacts") featuring debounced subsequence fuzzy search and inline-editable cards (Green for Cold Calling, Blue for Justdial Leads).
- Implemented **History Sync Script** (`scratch/sync_recent_calls.py`) to manually pull the last 15 call logs from Android call logs via ADB and sync call counts, statuses, and durations.
- Added **Numeric Labels** above SVG bars on both Daily Call Frequency and Daily Duration Load charts on the Dashboard.
- Bifurcated Outbound Logs on Dashboard into three tabs: **All**, **Cold Calling**, and **Justdial Leads**, mapping `'cold_call'` as platform instead of `'excel'`.
- Added **Call Attempt Counters** to contacts/leads, incremented strictly during outgoing/incoming call events.
- Added fields **Reset** button to form panels.

### Fixed
- Replaced frontend manual call logging with dually-functional ADB state-based daemon tracking (incoming/outgoing) in `listener.py`.
- Refactored sidebar listings for Cold Calling and Justdial Leads into split files to maintain the < 300 lines codebase limit.

## [1.3.0] - 2026-06-15
### Added
- Created **Lead Quality** selection dropdown (`Correct Lead` vs. `Invalid Lead`) in Justdial Leads details form.
- Added sidebar filter tabs for `Invalid Leads` and `Correct Leads` on the Justdial Leads page.
- Added a **Test Call (197)** button to the sidebar sync panel.
- Appended `lead_quality` column alter migration query to `supbase_queries.sql`.

### Fixed
- Fixed number formatting in `listener.py` to prevent prepending `+91` to carrier short codes (like `197`), allowing them to dial successfully.

## [1.2.0] - 2026-06-15
### Added
- Integrated **Notes & Remarks** field to general contacts inside `ColdCalling.jsx` UI and update handler.
- Added a red **Clear Database Contacts** button to the Excel upload panel to purge entries easily.
- Appended `notes` column alter migration query to `supbase_queries.sql`.

### Fixed
- Fixed the Excel upload parser to normalize status columns, mapping unmatched text as `'Answered'` (called) and saving raw values in `notes`.
- Fixed CSS layout syntax bugs (`justifycontent` -> `justifyContent`) in `ColdCalling.jsx`.

## [1.1.0] - 2026-06-14
### Added
- Added rooted Android telecom SIM 2 switching mechanism for Airtel.
- Implemented real-time call logging daemon using ADB to monitor `mCallState` transitions and fetch exact talk durations.
- Created SVG charts mapping call totals and average duration frequencies on the Dashboard.
- Configured light (default) and dark theme custom layouts.

### Fixed
- Resolved Supabase 500 bulk import errors by introducing unique phone number deduplication during Excel uploads.
- Resolved Javascript date serialization issue for serial dates.

## [1.0.0] - 2026-06-14
### Added
- Initial CRM structure.
- Basic database tables (`contacts`, `call_queue`, `system_state`) and Supabase connections.
- Basic Excel sheet uploads.
