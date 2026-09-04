# Reference Implementation

This folder contains source code from [odun-lami/public-nepa-tracker](https://github.com/odun-lami/public-nepa-tracker), the single-home NEPA tracker that inspired this project.

**This folder is read-only.** Do not modify these files.

## What it built
- A Tuya smart plug on a grid-only socket
- A Python script on Railway polling Tuya Cloud every 60 seconds
- State changes written to a Google Sheet
- A Netlify HTML page reading the Sheet as CSV
- A Scriptable iPhone widget

## Key files
- `tracker/nepa_tracker.py` — the core polling script
- `apps-script/Code.gs` — Google Apps Script for Sheets integration
- `dashboard/index.html` — the full single-file dashboard

## What we improved on
See the main README for a comparison table.

The most important improvements:
1. Added a second sensor (backup/inverter) to distinguish outages from internet failures
2. Added the UNKNOWN state — the reference only has ON/OFF
3. Replaced Google Sheets with Postgres for proper multi-home data management
4. Added user accounts and device registration
5. Added device health monitoring and stale-sensor alerts
