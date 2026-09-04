# System Architecture

## High-Level Overview

```
+-----------------+       +-----------------+       +------------------+
|  Smart Plug A   |       |  Smart Plug B   |       |   Wi-Fi Router   |
| (Grid socket)   |       | (Inverter/UPS)  |       | (On Inverter!)   |
+-------+---------+       +-------+---------+       +------------------+
        |                         |                          |
        +------------+------------+                          |
                     |                               Internet
                     v
              Tuya Cloud API
                     |
                     v  (poll every 60s)
        +------------+------------+
        |    Backend Polling      |
        |    Worker (Python)      |
        +------------+------------+
                     |
                     v
        +------------+------------+
        |   Decision Engine       |
        |  ON / OFF / UNKNOWN     |
        +------------+------------+
                     |
           +---------+---------+
           |                   |
           v                   v
   raw_observations      grid_events
   (every poll)          (state changes only)
           |                   |
           +---------+---------+
                     |
                     v
        +------------+------------+
        |   REST API (FastAPI or  |
        |   Express.js)           |
        +------------+------------+
                     |
                     v
        +------------+------------+
        |  Next.js Web Dashboard  |
        |  (Mobile-first PWA)     |
        +-------------------------+
```

---

## Technology Choices

### Backend
- **Language:** Python (FastAPI) — aligns with Data Scientist workflow, easy async
- **Database:** Supabase (Postgres) — free tier, built-in auth, real-time subscriptions optional
- **Device polling:** tinytuya Python library (open source Tuya API client)
- **Deployment:** Railway (free tier, easy Python deploys, has cron support)

### Frontend
- **Framework:** Next.js (App Router)
- **Styling:** Vanilla CSS with CSS custom properties (no Tailwind for maximum control)
- **Font:** Inter (Google Fonts)
- **Charts:** Chart.js or Recharts (lightweight)
- **Deployment:** Vercel (free tier, instant Next.js deploys)

### Data Pipeline
- **Runtime:** Python scripts (can be invoked as Supabase Edge Functions or Railway cron jobs)
- **Format:** SQL queries stored in /apps/data/queries/ for transparency and reproducibility

---

## Key Design Decisions

### Two sensors, not one
The single biggest improvement over the reference implementation. Without Sensor B as a heartbeat for internet connectivity, every internet dropout looks like a power outage.

### Raw observations are never deleted
Every 60-second poll result is stored permanently. This allows the session-grouping logic to be corrected and history to be reprocessed without data loss.

### State machine is in the backend, not the device
The smart plug only reports "reachable" or "unreachable." The backend applies the two-sensor decision logic. This means switching hardware (e.g., from Tuya to ESP32) only requires changing the ingestion layer.

### Africa/Lagos timezone everywhere
All timestamps stored in UTC internally, displayed in Africa/Lagos (+01:00) in the API and frontend. Never mix timezones in a 24-hour power profile.

### No user-managed Tuya accounts
For the pilot, the team provisions and manages all devices under one Tuya account. Users do not need to create Tuya accounts. This avoids the OAuth complexity of multi-account Tuya integration.

---

## Future Architecture (Post-Pilot)

Once the pilot validates the concept:

1. **Custom ESP32 tracker** — device with battery backup that records events locally and syncs when internet returns. Eliminates the UNKNOWN problem almost entirely.
2. **Mobile app (React Native)** — after the mobile web proves the UX works.
3. **Neighbourhood aggregation** — anonymized area-level availability, opt-in only.
4. **WhatsApp notifications** — replace Telegram once volume justifies the cost.
