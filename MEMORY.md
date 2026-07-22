# MEMORY.md

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

## Long-term Memory
- Project is a React/Vite web application connecting with a python backend daemon to automate adb tasks on devices.
- Uses Supabase as DB and state storage.
- Cloudflare Pages is used for frontend hosting.
