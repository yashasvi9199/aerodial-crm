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
  npm run dev:frontend
  ```
