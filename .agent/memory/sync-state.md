# sync-state.md

- 2026-07-09: Initialized compliance memory files, implemented background launcher scripts, multi-device fallbacks, Truecaller local storage caching, and WhatsApp Business tester panel. Remodeled repository to single-layer layout, promoted frontend to root, unified package.json, consolidated scripts, and verified clean build. Added env fallbacks in supabase.js for Cloudflare integration.
- 2026-07-10: Restructured python daemon into adb_helper.py to maintain file limit guidelines; added brand/ROM skin identification and SIM cards reader; created Setup tab in frontend to configure outbound SIM cards, diagnostic console audits, and interactive failsafe dialing retries on test call 197. Bumped version to 1.6.0.
- 2026-07-10 (Fixes): Fixed missing 'supabase' module error in the daemon listener by implementing a local virtual environment (.venv) and updating the npm start script. Added an automated .env file loader in listener.py supporting both Vite-prefixed and standard Supabase environment keys. Bumped version to 1.6.2.

