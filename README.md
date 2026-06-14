# AeroDial CRM & Calling SAAS

A high-fidelity CRM designed to automate outbound calling and lead management using rooted Android ADB SIM switching.

## 🚀 Overview
AeroDial CRM connects directly to a rooted Android device over ADB to automate dials using specific SIM cards (Airtel SIM 2 default), monitors talk duration in real-time, and log metrics onto a high-performance Supabase database.

## 📦 Features
See [FEATURES.md](file:///home/drone/Programming/aerodial-crm/FEATURES.md) for a detailed breakdown of all application features and capabilities.

## 🛠️ Getting Started
1. **Database Setup**: Run queries inside [supbase_queries.sql](file:///home/drone/Programming/aerodial-crm/supbase_queries.sql) in your Supabase SQL editor.
2. **Daemon Setup**: Sourced virtual environment, install requirements, and execute the daemon:
   ```bash
   cd daemon
   pip install -r requirements.txt
   python listener.py
   ```
3. **Frontend Development**: Install dependencies and start Vite dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📄 Licensing & Intellectual Property
**Proprietary Software - Copyright (c) 2026 Yash Haldiya. All Rights Reserved.**

This software is confidential and proprietary. No license is granted to copy, distribute, or modify this software. Any unauthorized copying of functions, code blocks, methods, layouts, or schemas from this software constitutes copyright infringement and will result in copyright claim lawsuits, statutory damages, and legal action. 

For full terms, see the [LICENSE](file:///home/drone/Programming/aerodial-crm/LICENSE) file.
