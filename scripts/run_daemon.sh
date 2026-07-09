#!/bin/bash
# Get the directory of this script (resolved even if symlinked)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$DIR" )"

cd "$PROJECT_DIR" || exit 1

# Check if the daemon is already running
PID=$(pgrep -f "[p]ython3.*daemon/listener.py")

if [ -n "$PID" ]; then
    echo "AeroDial Daemon is already running (PID: $PID)"
    # Send a notification if notify-send is available
    if command -v notify-send >/dev/null 2>&1; then
        notify-send "AeroDial CRM" "Daemon is already running."
    fi
else
    echo "Starting AeroDial Daemon in the background..."
    # Ensure dependencies are installed
    if [ -f "daemon/requirements.txt" ]; then
        python3 -m pip install -r daemon/requirements.txt --quiet
    fi
    
    # Run the listener in background redirecting logs
    nohup python3 daemon/listener.py > daemon/daemon.log 2>&1 &
    
    # Notify user of success
    if command -v notify-send >/dev/null 2>&1; then
        notify-send "AeroDial CRM" "Daemon started successfully."
    fi
fi
