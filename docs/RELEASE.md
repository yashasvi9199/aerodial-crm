# Release Notes

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
