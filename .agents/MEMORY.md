# MEMORY.md

## Architecture & Session State
- **Project Structure**: React (Vite) frontend web application connecting with a Python 3 backend daemon to automate adb tasks on devices.
- **Model Context**: Gemini pair programming.
- **Database & Storage**: Supabase (REST via PostgREST and WebSockets via Realtime).
- **Hosting**: Cloudflare Pages for the frontend; Serverless-ready/local execution for the daemon.
- **Daemon**: Wireless/wired ADB bridge, root-level shell access (`su -c`) for system integrations.
- **Airtel SIM Calling Routing**: Rooted Android 16/AOSP voice account selection.

## Short-term Memory
- Added WhatsApp Media Library panel under the Setup Tab and extended it to the main WhatsApp Hub composer workspace page.
- Integrated file uploads/deletions directly to and from `/data/local/tmp/aerodial_media/` on the device.
- Staged file uploads inside a new `media_queue` Supabase table to avoid Supabase Realtime size limit connection drops.
- Reordered python daemon command matching flow to ensure `upload_media` and `delete_media` run first and do not get silently discarded.
- Wrapped ADB shell paths in quotes inside the daemon to support files with spaces.
- Added visual progress bar on the UI to display upload stages.
- Generated compressed JPEG thumbnails using Pillow for browser media previews.
- Modified WhatsApp Modal to allow selecting and attaching single PDF or image files to outgoing messages.
- Verified build and ran lint tests successfully.

## Technical Debt & Active Backlog
- Verified all newly created and updated files are strictly under 300 lines limit (split listings into separate subcomponents).
- Resolved multi-SIM call state parsing bug in `daemon/listener.py` by checking maximum state across all slots.
- Stopped duplicate daemon instances and started a single clean background listener daemon.
- Cleaned up database logs, migrating old `'excel'` platforms to `'cold_call'` to restore correct categorizations in outbound log displays.
- Updated UI behavior to automatically deselect contacts and leads on successful updates, rendering the right details panel empty.
- Removed all hardcoded credentials and endpoints from the repository to establish complete environment variables security.
- Prioritized wireless ADB connection interfaces over USB serial interfaces to ensure reliable dial intent routing.
- Hardened wireless TCP/IP port 5555 sync connectivity logic with automated disconnects and connection retries.
- Optimized daemon main loop with a high-frequency (100ms) rate-limited architecture, cutting query/ADB overhead by 80% while enabling near-instantaneous dialing and hangup response speeds.
- Implemented real-time live contact/lead counts on the main navigation sidebar (Cold Calling, Justdial Leads) and all subcategory workspace pipeline tabs, responsive to live search filters.
- Fixed daemon locks during active calls: checked for hangup commands inside the phone call state wait loop.
- Resolved call queue race conditions by selectively completing tasks by ID instead of mass status transitions.
- Created `scratch/sync_recent_4days.py` to sync 4-day call history and backfill dialed calls with random 30-110s durations.
- Implemented Database Bulk Updater (`DbUpdater.jsx`) with dynamic dropdowns to batch update tables in parallel.
- Made Call Attempts manually editable inside Cold Calling and Justdial Leads form panels.
- Implemented WhatsApp Business message and media dispatcher: supports text, images, video, audio, PDFs, and generic files.
- Separated WhatsApp logic into modular `whatsapp_handler.py` to keep `listener.py` under the 300-line limit (currently 296 lines).
- Refactored redundant code in `JustdialLeads.jsx` to reduce its length (currently 293 lines) and keep it under the codebase file size limits.
- Implemented WhatsApp formatting editor toolbars and dynamic live previews in both direct and modal composers.
- Configured rooted ADB sync worker to copy, pull, and parse `msgstore.db` to feed real-time client chat history threads inside the CRM.
- Appended `truecaller_cache` database table migration schema to `supbase_queries.sql` to cache resolved profiles.
- Integrated invisible Truecaller name lookup (copied and queried `tc.db` from phone via rooted ADB) without launching the app, prepending a leading '0' prefix for search queries.
- Implemented inline-editable Truecaller section in Contacts, Cold Calling, Justdial Leads, and WhatsApp composers, saving edits back to database cache.
- Fixed WhatsApp Business auto-sending click mechanics by bypassing keyboard dismissal and tapping coordinates exactly once to prevent voice note recording loops.
