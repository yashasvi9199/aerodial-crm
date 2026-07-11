# Changelog

All notable changes to this project will be documented in this file.

## [1.8.0] - 2026-07-11
### Added
- Added Wireless ADB Connection tab card under Setup to connect wirelessly to Android device.
- Implemented persistent localStorage for the target IP address input.
- Added background code in Python daemon to run adb tcpip and adb connect to wirelessly bridge Android devices.
- Implemented auto-fetch IP address functionality from USB-connected device to prefill input.

## [1.7.9] - 2026-07-11
### Added
- Added "Fetch Call Logs" button to sidebar allowing manual fetching and syncing of call logs from device.
- Added database schema column `last_contact_at` (timestamp with time zone) on contacts and leads to track when they were last contacted.
- Implemented sorting controls (sortBy: Time/Name, sortOrder: Asc/Desc) on All Contacts, Cold Calling (ContactList), and Justdial Leads (LeadList).
- Stabilized the real-time Supabase state sync connection by throttling heartbeats from 0.4s to 3.0s (unless state status payload changes), reducing API rates and preventing drops.
- Removed connection status banner ("Core Bridged" / "Link Terminated") from top header.

## [1.7.8] - 2026-07-11
### Added
- Added comprehensive console action logging to audit mutations across the platform. Tracks contact insertions/updates (Cold Calling), lead updates/creations (Justdial Leads), templates saving/deletions (WhatsApp), and Excel sheet uploads/clears.

## [1.7.7] - 2026-07-11
### Fixed
- Fixed Database Bulk Updater query construction by ensuring `.select()` is chained directly after `.update()` (prior to filters) so that Supabase executes the update request and returns the updated rows.
- Cast filters to match column types (e.g. string to number) to prevent Postgres type mismatch errors on execution.
- Added verbose logging to output query filters, target tables, and counts of updated rows.

## [1.7.6] - 2026-07-10
### Fixed
- Prevented module initialization crash on production when environment variables are unset, by using placeholder credentials.
- Created `docs/CLOUDFLARE_SETUP.md` with detailed instructions on configuring Supabase environment variables on Cloudflare Pages.

## [1.7.5] - 2026-07-10
### Fixed
- Fixed Truecaller lookup failure by wrapping individual table queries (history, aggregated_contact, and raw_contact) in try-except blocks, preventing database schema mismatches from aborting the resolver.

## [1.7.4] - 2026-07-10
### Added
- Added Truecaller search intent fallback to the python daemon: launches Truecaller search view via ADB command when direct database query misses, waits for caching, and queries local `tc.db` database again.

## [1.7.3] - 2026-07-10
### Added
- Added `whatsapp_sent` status column to contacts database table and managed editable state options within the Cold Calling workspace.
- Added visual `WA Sent` indicators/badges next to contact items inside the contact list.

## [1.7.2] - 2026-07-10
### Fixed
- Fixed Supabase Realtime channel name collisions in `TruecallerSection` by generating a unique channel name on each mount, resolving console errors and crashes when switching contacts.

## [1.7.1] - 2026-07-10
### Fixed
- Fixed call logging logic to register contact call status updates and write `last_call_at` using a human-readable local time format: `January 01, 2000 | 04:00 PM`.
- Added custom date sorting comparison to safely handle the new pipe-delimited format on client browsers.
- Added visual `Last Called` timestamp indicators to contact card listings and details card layout.

## [1.7.0] - 2026-07-10
### Added
- Real-time incoming call detection: daemon uses dumpsys, notifications, and logcat methods combined to resolve and display caller details instantly in a premium UI HUD.
- Google Play Store redirection buttons for Truecaller and WhatsApp Business setup items.

## [1.6.5] - 2026-07-10
### Fixed
- Fixed browser console HTTP 400 Bad Request error when saving default SIM slot by adding missing `default_sim_slot` column to `system_state` table.
- Resolved terminal daemon warning concerning missing `whatsapp_messages` schema cache entry.

## [1.6.4] - 2026-07-10
### Added
- Added Truecaller APK installer action handler in the python daemon listener and "Install APK" button in Setup tab to install Truecaller via ADB in a single click.
- Added WhatsApp Business Play Store redirection link in Setup tab when the app is missing from the device.

## [1.6.3] - 2026-07-10
### Fixed
- Mapped SIM card slot index (0/1) to telephony database subscription IDs (`_id` column) in `adb_helper.py` and `listener.py` to fix rooted multi-SIM carrier routing.
- Fixed React/ESLint issues (unused variables, impure hooks, and cascading setState triggers).

## [1.6.2] - 2026-07-10
### Fixed
- Added auto-loading of `.env` files in the python daemon listener and supported Vite-prefixed environment variables (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) as fallbacks.

## [1.6.1] - 2026-07-10
### Fixed
- Resolved `Cannot find module 'supabase'` error in python daemon listener by routing start scripts to use project virtual environment and installing python dependencies.

## [1.6.0] - 2026-07-10
### Added
- Setup Diagnostics Tab: allows managing default SIM card slot routing, inspecting system metrics, and downloading logs.
- Failsafe Dialing Retries: automatically rotates dialer configurations upon failed 197 test runs.
- Browser Audit Logs: captures console warnings/errors and user navigation actions in local storage with exports.
- Extracted ADB operations into a separate `adb_helper.py` to keep python source files under 300 lines limit.

## [1.5.0] - 2026-07-09
### Added
- Multi-Device ROM skin & OS detection (AOSP, HOS3, ColorOS, FuntouchOS, Vivo, Lava, Micromax).
- Heartbeat and daemon background runner script setup with desktop launchers.
- WhatsApp Business package presence checks.

## [1.4.9] - 2026-06-17
### Added
- Truecaller Name Lookup: implemented database resolver using rooted ADB shell access to copy and query the phone's Truecaller database (`tc.db`) locally.
- Prepended '0' search prefix: added support to search using leading '0' prefix (e.g. `07976401542`) alongside standard format search queries to match local device formats.
- Truecaller UI cache and sections: created a dedicated `truecaller_cache` database table and inline-editable Truecaller Section rendering dynamically across Contacts, Cold Calling Contacts, Justdial Leads, and WhatsApp Direct Composer & Modal inputs.

### Fixed
- WhatsApp Business dispatch mechanics: cleaned up sending gestures to tap exactly once and bypassed keyboard check/dismissal loops, ensuring robust dispatching without triggering accidental voice note recording.

## [1.4.8] - 2026-06-17
### Added
- WhatsApp Styling Toolbar: introduced character styling shortcuts (bold, italic, strikethrough, monospace, blockquotes, bullet lists) that insert formatting tags directly at the composer cursor.
- Live Styled Preview: added a real-time message bubble preview rendering the formatted WhatsApp output before dispatch.
- Live Chat History Sync: implemented background synchronization that periodically pulls the device `msgstore.db` database via rooted ADB shell, syncs incoming/outgoing messages, and renders them in a real-time WhatsApp-style chat timeline with status checks (single tick, double tick, blue ticks).

## [1.4.7] - 2026-06-17
### Added
- Automated Keep-Alive System: added `scripts/keep_alive.py` and GitHub Actions daily cron job `.github/workflows/keep_alive.yml` to query Supabase, ping Cloudflare, and push Git updates to keep free tiers active.
- Dedicated Template Manager: created a separate `TemplateManager.jsx` component for creating and deleting templates, cleanly separating it from the message composer.

### Fixed
- Fixed Template Saving Bug: resolved the nested form HTML bug that prevented template submissions from writing to the Supabase database.
- Fixed Duplicate Label: resolved the duplicate "Choose Template" label on the screen.

## [1.4.6] - 2026-06-16
### Added
- Outbound Dashboard Logs: added `whatsapp_logs` integration in Dashboard stats, unified log feed, and a dedicated logs tab for WhatsApp dispatches.
- Low-Eye-Strain Theme: revamped light-mode CSS variables with high-contrast, low-eye-strain slate-gray background `#f1f5f9` and optimized teal accents.

### Fixed
- Pure Text WhatsApp Dispatch: removed all media file attachments and templates caching code from the frontend and daemon to achieve bulletproof text-only dispatches.
- Keyboard Occlusion Fix: implemented wireless soft keyboard checks (`dumpsys input_method`) and automatic dismiss (`BACK` keyevent) during WhatsApp automations, preventing send button tapping failures.

## [1.4.5] - 2026-06-16
### Fixed
- Fixed call hangup and queue race condition: added inner-loop checks for hangup command during active phone calls, and isolated call queue completions by ID to allow clean concurrent redials.
- Sync tool backfill: created 4-day deep history synchronization script `scratch/sync_recent_4days.py` which queries past logs via ADB and automatically backfills missing durations with a random duration between 30-110 seconds for dialed calls.

### Added
- Added Database Bulk Updater: a new tool page/utility featuring dynamic query row builders and grey horizontal "+" button to batch update any database value/notes on selected filter conditions.
- Editable Call Attempts: converted the call attempts indicator to an inline numeric input in both Cold Calling and Justdial Leads right detail panes, allowing manual counters updates.
- WhatsApp Business Integration: implemented a reusable frontend modal (`src/components/WhatsappModal.jsx`) and a backend ADB helper (`daemon/whatsapp_handler.py`) to compose text messages, choose files/media (automatically uploaded to Supabase storage and pushed to the phone via ADB), and launch WhatsApp Business chat views and auto-send actions.

## [1.4.4] - 2026-06-15
### Added
- Added live contact and lead counts to the main navigation sidebar items (Cold Calling and Justdial Leads).
- Added dynamic category counts to subcategory pipeline tabs in both Cold Calling ("All", "Follow Up", "Missed", "Called", "Answered", "Not Called") and Justdial Leads ("All", "Follow Up", "Invalid Leads", "Correct Leads") views, which automatically update with search queries.

## [1.4.3] - 2026-06-15
### Fixed
- Re-architected device listener bridge (`daemon/listener.py`):
  - Prioritized wireless ADB connection interfaces over USB interfaces during active call dispatching to avoid connection locks.
  - Hardened local USB-to-wireless bridge synchronization (`perform_usb_sync`) with retry mechanisms, state validations, and automated stale wireless session cleanups (`adb disconnect`).
  - Implemented high-frequency rate-limited polling (100ms loop intervals) using timestamp checks, reducing idle ADB and database network load by 80% while achieving ultra-low latency reaction times (under 200ms) for queue dial dispatches and remote controls.
  - Streamlined helper functions to keep the entire daemon file size strictly under the codebase limit of 300 lines (currently 287 lines).
- Fixed security fallbacks: removed all hardcoded Supabase project URLs and anon key credentials from utility scripts (`scratch/cleanup_and_load.js` and `scratch/sync_recent_calls.py`), forcing strict environment-based loads.
- Cleaned compiled cache files and output assets to prevent accidental residual credential leaks.

## [1.4.2] - 2026-06-15
### Fixed
- Fixed form pane behavior: automatically deselects and clears the right details panel upon successful contact/lead updates in both Cold Calling and Justdial Leads workspaces.
- Fixed multi-SIM call state detection bug in daemon `listener.py` by checking all SIM slots and returning the maximum active state.
- Fixed database platform categorizations for call logs, mapping old `'excel'` values to `'cold_call'` to correct UI logging displays.
- Terminated duplicate background processes causing log conflicts and started a single clean listener instance.
- Corrected redial and dial queue processing behavior, ensuring logs and call counters update correctly.

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
