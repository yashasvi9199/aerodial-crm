# AeroDial CRM - Beginner Setup Guide

## Overview
AeroDial CRM coordinates dial actions and WhatsApp Business messaging tasks triggered from a React dashboard by controlling local Android phones via ADB bridge interface.

## Requirements
- Python 3.8+
- Node.js 18+
- ADB (Android Debug Bridge) tools installed in the system PATH.
- A rooted or non-rooted Android device. (Rooted is recommended for automated SIM selector queries).

## Setup Instructions
1. Install Python backend requirements:
   ```bash
   pip install -r daemon/requirements.txt
   ```
2. Install frontend dependencies:
   ```bash
   npm install --prefix frontend
   ```
3. Initialize the desktop background launcher:
   ```bash
   python3 scripts/setup_launcher.py
   ```

## Running the Application
- Run the daemon using shortcut desktop icon or:
  ```bash
  npm run start:daemon
  ```
- Run the frontend dashboard development environment:
  ```bash
  npm run dev
  ```

## Feature Matrix: Rooted vs. Non-Rooted Devices

AeroDial CRM automatically detects your device's root capability and unlocks advanced features accordingly.

| Feature | Non-Rooted Mode | Rooted Mode |
| :--- | :--- | :--- |
| **Outbound Calling** | Yes (via AOSP intent fallback) | Yes (fully automated) |
| **ROM-specific Dialers** | Supported via intent routing | Supported via intent routing |
| **Heartbeat & State Sync** | Yes | Yes |
| **Sim Card Detection** | Slot index & carrier via `dumpsys` | Carrier, phone number, and slot info |
| **Default SIM Choice** | Appended to dial intent extras | Auto-backs up on connection & restores on call end |
| **Call Duration Logs** | Read from caller database | Read from caller database |
| **Failsafe Dial Retries** | Supported (up to 4 methods) | Supported (includes root service override) |
| **WhatsApp Message Dispatch**| Yes (via local automation) | Yes (via local automation) |

