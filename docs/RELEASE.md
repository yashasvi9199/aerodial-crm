# Release Notes

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
