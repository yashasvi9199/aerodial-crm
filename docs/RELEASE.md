# Release Notes

## [1.14.0] - 2026-07-23
### Added
- Restructured WhatsApp Business Hub to split functionality across 6 dedicated tabs: Composer, Media Library, Template, Groups, Greetings, and Broadcast.
- Implemented chunked file upload staging in frontend (1MB slices) and assembly in local daemon to support large attachments (e.g. 40MB PDF).
- Created a separate Media Library tab separating Images and PDF document listings.
- Enhanced Template Manager to support template editing and instant UI delete refresh.
- Enforced a 4-batch maximum limit per Group inside GroupManager.
- Built a Contact Picker Modal popup for staging batch contacts (max 20) with live search and category filters (Justdial Leads vs Cold Calls).
- Created Broadcast tab with split Date and Time picker inputs.
- Implemented error pausing inside the Python daemon: dispatches that fail pause the batch immediately and record the error message.
- Integrated auto-popup error alert modal in general English on the frontend when campaigns are paused, exposing a \"Resume Campaign\" button to reset targets back to pending.

## [1.13.0] - 2026-07-23
### Added
- Implemented WhatsApp Bulk Messaging scheduler and manager features.
- Created `GroupManager` UI for creating contact groups, importing saved contacts, uploading CSV files, and staging manual type-in numbers.
- Created `BatchScheduler` UI for batching contacts (up to 20 per batch), choosing template text with `{greetings}` tags, selecting media attachments, and scheduling sending times.
- Enforced a 60-minute gap constraint between batch executions in the same group and an 80-message daily rate limit.
- Created `GreetingsManager` UI for adding, editing, and deleting randomized message greetings.
- Integrated background scheduler in Python daemon (`whatsapp_bulk_handler.py`) to process pending batches with randomized message formatting (spacing obfuscations, single-character italics).
- Linked All Contacts search cards to display a "WA Sent" badge detailing recent bulk history details.

## [1.12.2] - 2026-07-22
### Fixed
- Fixed command processing order in the Python daemon to ensure `upload_media` and `delete_media` are parsed before the `is_connected` block is matched.
- Wrapped adb push/chmod/rm target paths in double quotes to support filenames with spaces.
- Added a visual progress bar indicating reading, uploading, and dispatching progress on file uploads.
- Configured Supabase postgrest client timeout to prevent network drop hangs.

## [1.12.0] - 2026-07-22
### Added
- Added full Media Library management panel (uploading, listing with previews, and deleting) inside the main WhatsApp Business Hub workspace interface (sidebar tab).
- Linked the `useSetup` hook media callbacks and Lucide icons directly in the hub layout.

## [1.11.0] - 2026-07-22
### Added
- Added WhatsApp Media Library panel under the Setup Tab.
- Integrated upload and delete commands to copy images/PDF files from the browser directly to the device directory `/data/local/tmp/aerodial_media/`.
- Implemented real-time synchronization of device media files to cache directories and generated compressed image base64 thumbnails using Pillow.
- Enhanced the WhatsApp modal to allow selecting an image or PDF attachment from the synced library, passing the correct `media_filename` in dispatcher payloads.

## [1.10.0] - 2026-07-22
### Added
- Added Outbound Calling Method selection dropdown in the Setup Tab.
- Integrated browser `localStorage` persistence (`aerodial_calling_method`) to save and restore the user's calling method choice.
- Configured all contact dial triggers (Cold Calling, JustDial leads, Contacts cards, and 197 test triggers) to append the chosen calling method suffix automatically.

## [1.9.0] - 2026-07-22
### Added
- Added automated SIM defaults backup and restore feature. Auto-detects original default SIM settings on rooted device connection and saves them in local storage.
- Auto-detects call disconnection to automatically switch back to the saved original default SIM card, reverting permanent slot overrides.
- Implemented a 5-second verification loop to restore SIM settings if the outgoing call fails to connect or starts and exits immediately.
- Saved ADB Telecom and Settings research in `docs/telecom_adb_reference.md` and mapped it as a customized agent skill.

## [1.8.0] - 2026-07-11
### Added
- Added Wireless ADB Connector interface block to Setup tab.
- Integrated persistent localStorage state to save entered IP addresses.
- Added background code to Python daemon to process adb tcpip switching and adb wireless connection calls.
- Added IP address extraction and transmission from active USB connections to allow Auto-Fetch.

## [1.7.9] - 2026-07-11
### Added
- Added manual "Fetch Call Logs" button and command triggers to update call counters and timing.
- Added database schema column `last_contact_at` to track timestamps and sort contacts/leads by last contact made.
- Implemented sorting controls (Time/Name, Asc/Desc) on All Contacts, Cold Calling, and Justdial Leads views.
- Throttled daemon status heartbeat from 0.4s to 3s to stabilize network connection and prevent Supabase rate drops.
- Removed connection status indicators from top header.

## [1.7.8] - 2026-07-11
### Added
- Added mutation console logging across Contacts (Cold Calling), Leads (Justdial), Templates (WhatsApp), and Excel Upload components to track and audit user actions.

## [1.7.7] - 2026-07-11
### Fixed
- Fixed Database Bulk Updater query construction to chain `.select()` correctly, ensuring database updates run and return updated records.
- Added filter type casting to prevent Postgres datatype mismatch errors.
- Added console logging of executed queries and actual updated counts.

## [1.7.6] - 2026-07-10
### Fixed
- Fixed module initialization crash on production when environment variables are missing.
- Added `docs/CLOUDFLARE_SETUP.md` configuration guide.

## [1.7.5] - 2026-07-10
### Fixed
- Wrapped Truecaller database sub-queries in individual try-except blocks to prevent schema mismatch crashes, ensuring search query name resolutions succeed.

## [1.7.4] - 2026-07-10
### Added
- Added Truecaller search intent fallback to launch app on device during lookup miss.

## [1.7.3] - 2026-07-10
### Added
- Added editable `whatsapp_sent` status indicators to contacts table and layout.
- Added visual `WA Sent` badge to contact list cards.

## [1.7.2] - 2026-07-10
### Fixed
- Fixed Supabase Realtime channel name collision error in Truecaller profile section.

## [1.7.1] - 2026-07-10
### Fixed
- Fixed call logging registration to correctly capture called history and format timestamps as `January 01, 2000 | 04:00 PM`.
- Added visible Last Called timestamp information to UI cards and list items.

## [1.7.0] - 2026-07-10
### Added
- Integrated universal incoming call detection (combines dumpsys, notifications, and logcat parsing) to show a real-time caller HUD.
- Swapped ADB installers with direct Google Play Store link actions for missing device apps.

## [1.6.5] - 2026-07-10
### Fixed
- Fixed 400 Bad Request error on system_state PATCH by adding the missing `default_sim_slot` column.
- Added missing `whatsapp_messages` schema to resolve local python daemon sync warning.

## [1.6.4] - 2026-07-10
### Added
- Created a single-click Truecaller APK installer via ADB (`adb install -r`) when the app is detected as missing from the active device.
- Integrated a direct Play Store link in Setup tab to easily download WhatsApp Business if not present on the phone.

## [1.6.3] - 2026-07-10
### Fixed
- Fixed rooted multi-SIM card choice routing by mapping the selected SIM slot (0/1) to the actual active database subscription ID (`_id` column) before calling `telecom set-user-selected-outgoing-phone-account`.
- Cleaned up React linter warnings and errors (render impurity, unused hooks, and cascading state triggers).

## [1.6.2] - 2026-07-10
### Fixed
- Configured python daemon to automatically parse and load environment variables from the root `.env` file, supporting both standard (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) and Vite-prefixed (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) variables.

## [1.6.1] - 2026-07-10
### Fixed
- Fixed python daemon module imports by creating a local virtual environment (`daemon/.venv`) and installing dependencies listed in `requirements.txt`.
- Swapped `npm run start:daemon` script to execute using the project's virtual environment python binary.

## [1.6.0] - 2026-07-10
### Added
- Setup & Diagnostics Tab in frontend to configure outbound SIM selection, view detailed ROM skin/dialer info, and inspect logs.
- Failsafe dialing retries mechanism for test calls (automatically attempts alternative intent/slot configurations).
- Client diagnostics logging system (capturing console outputs and user interaction clicks/types to local storage).
- Separated ADB helpers into modular `adb_helper.py` to keep python codes below the strict 300 line limit.

## [1.5.0] - 2026-07-09
### Added
- Multi-Device support: Added support for AOSP, HOS3, ColorOS, FuntouchOS, Vivo, Lava, Micromax.
- Dynamic root status check (`su -c` executed only if root privilege exists).
- Caching resolved Truecaller names in `localStorage`.
- WhatsApp Business package check and direct testing block in the UI.
- Desktop background daemon launcher scripts (`setup_launcher.py`, `run_daemon.sh`).
- Root `package.json` task configuration and Wrangler Cloudflare Pages deployment configuration.
- Converted project folders to standard docs structure.
