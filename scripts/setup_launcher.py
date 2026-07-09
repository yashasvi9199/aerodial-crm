import os
import stat
import subprocess

def create_desktop_icon():
    # Resolve absolute paths
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(current_dir)
    runner_path = os.path.join(current_dir, "run_daemon.sh")
    icon_path = os.path.join(project_dir, "frontend", "public", "favicon.svg")
    if not os.path.exists(icon_path):
        icon_path = "utilities-terminal"  # Fallback system icon

    desktop_content = f"""[Desktop Entry]
Version=1.0
Type=Application
Name=AeroDial CRM Daemon
Comment=Launch AeroDial Listener Daemon in background
Exec={runner_path}
Icon={icon_path}
Terminal=false
Categories=Utility;Development;
StartupNotify=true
"""

    # Target directories
    app_dir = os.path.expanduser("~/.local/share/applications")
    desktop_dir = os.path.expanduser("~/Desktop")

    os.makedirs(app_dir, exist_ok=True)
    app_desktop_path = os.path.join(app_dir, "aerodial-daemon.desktop")

    # Write to applications folder
    with open(app_desktop_path, "w") as f:
        f.write(desktop_content)
    
    # Make applications desktop file executable
    os.chmod(app_desktop_path, os.stat(app_desktop_path).st_mode | stat.S_IEXEC)
    print(f"✅ Desktop entry created at: {app_desktop_path}")

    # Write to Desktop if folder exists
    if os.path.exists(desktop_dir):
        desktop_icon_path = os.path.join(desktop_dir, "aerodial-daemon.desktop")
        with open(desktop_icon_path, "w") as f:
            f.write(desktop_content)
        os.chmod(desktop_icon_path, os.stat(desktop_icon_path).st_mode | stat.S_IEXEC)
        print(f"✅ Desktop shortcut created at: {desktop_icon_path}")

if __name__ == "__main__":
    create_desktop_icon()
