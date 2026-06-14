#!/usr/bin/env fish

# Ensure environment variables are loaded
source ~/.config/fish/config.fish

# Check if the listener is currently running
if pgrep -f "listener.py" > /dev/null
    # If running, kill it
    pkill -f "listener.py"
    notify-send -u normal -t 3000 "AeroDial" "🔴 Background Daemon Stopped."
else
    # Define absolute paths
    set VENV_PYTHON "/home/drone/Programming/aerodial-crm/daemon/.venv/bin/python"
    set LISTENER_SCRIPT "/home/drone/Programming/aerodial-crm/daemon/listener.py"
    
    # Use setsid to completely sever ties with the terminal
    setsid $VENV_PYTHON $LISTENER_SCRIPT > /dev/null 2>&1 &
    
    notify-send -u normal -t 3000 "AeroDial" "🟢 Background Daemon Started."
end
