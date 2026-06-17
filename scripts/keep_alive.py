import os
import urllib.request
import urllib.error
from supabase import create_client, Client

def get_env_var(name, env_file_path="frontend/.env"):
    val = os.environ.get(name)
    if val:
        return val
    # Try reading from frontend/.env
    if os.path.exists(env_file_path):
        with open(env_file_path, "r") as f:
            for line in f:
                if line.startswith(f"VITE_{name}="):
                    return line.strip().split("=", 1)[1]
    return None

def main():
    print("[*] Starting Keep-Alive script...")
    
    # 1. Supabase Keep-Alive
    sb_url = get_env_var("SUPABASE_URL")
    sb_key = get_env_var("SUPABASE_ANON_KEY")
    
    if sb_url and sb_key:
        try:
            print(f"[*] Pinging Supabase: {sb_url}")
            supabase: Client = create_client(sb_url, sb_key)
            res = supabase.table('system_state').select('id').eq('id', 1).execute()
            print("✅ Supabase Ping Success:", res.data)
        except Exception as e:
            print("❌ Supabase Ping Failed:", e)
    else:
        print("⚠️ Supabase credentials not found. Skipping Supabase ping.")

    # 2. Cloudflare Keep-Alive
    cf_url = os.environ.get("CLOUDFLARE_URL")
    if not cf_url:
        cf_url = "https://aerodial.pages.dev" # Default placeholder
    
    if cf_url:
        try:
            print(f"[*] Pinging Cloudflare Page: {cf_url}")
            req = urllib.request.Request(cf_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as r:
                print(f"✅ Cloudflare Ping Success: HTTP {r.status}")
        except Exception as e:
            print("❌ Cloudflare Ping Failed:", e)

    # 3. GitHub Keep-Alive (Ping Repository API)
    repo = os.environ.get("GITHUB_REPOSITORY")
    if repo:
        try:
            gh_url = f"https://api.github.com/repos/{repo}"
            print(f"[*] Pinging GitHub Repository API: {gh_url}")
            req = urllib.request.Request(gh_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as r:
                print(f"✅ GitHub API Ping Success: HTTP {r.status}")
        except Exception as e:
            print("❌ GitHub API Ping Failed:", e)

    # 4. Write timestamp to trigger Git activity
    try:
        timestamp_path = "scripts/last_ping.txt"
        import datetime
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with open(timestamp_path, "w") as f:
            f.write(f"Last Keep-Alive Ping: {now_str}\n")
        print(f"✅ Updated {timestamp_path} with timestamp {now_str}")
    except Exception as e:
        print("❌ Failed to update timestamp file:", e)

if __name__ == "__main__":
    main()
