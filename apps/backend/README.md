# Backend — Light Tracker API & Device Poller

Owner: Backend Developer

## Stack
- Python 3.11+ with FastAPI
- Supabase (Postgres)
- tinytuya (Tuya device integration)
- Railway (deployment)

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
python main.py
```

## Environment Variables

```
DATABASE_URL=postgresql://...
TUYA_ACCESS_ID=...
TUYA_ACCESS_SECRET=...
TUYA_REGION=eu
POLL_INTERVAL_SECONDS=60
DEBOUNCE_MINUTES=3
STALE_SENSOR_THRESHOLD_SECONDS=300
```

## Folder Structure

```
apps/backend/
├── main.py                 # Entry point — starts API and polling worker
├── requirements.txt
├── .env.example
├── api/
│   ├── routes/
│   │   ├── homes.py        # /homes/:id/current-status, /summary, /events
│   │   └── health.py       # /health
│   └── middleware/
│       └── auth.py         # JWT validation
├── db/
│   ├── migrations/         # SQL migration files (run in order)
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_homes.sql
│   │   ├── 003_create_sensors.sql
│   │   ├── 004_create_raw_observations.sql
│   │   ├── 005_create_grid_events.sql
│   │   └── 006_create_daily_summaries.sql
│   └── client.py           # DB connection
├── polling/
│   ├── worker.py           # Main polling loop (runs every 60s)
│   ├── tuya_client.py      # Wrapper around tinytuya
│   └── decision_engine.py  # ON/OFF/UNKNOWN logic
└── watchdog/
    └── dead_mans_switch.py # Alert if sensor B goes stale
```

## Day-by-Day Build Guide

| Day | Task |
|:---:|:---|
| 1 | Provision Supabase, design schema |
| 2 | Device registry API (register sensor to home) |
| 3 | Schema migrations, seed data |
| 4 | Tuya polling worker (raw_observations) |
| 5 | Decision engine + grid_events |
| 6 | All 5 API endpoints from api-contract.md |
| 7 | Dead man switch, stale sensor detection |
| 8 | Deploy to Railway, connect frontend |
| 9 | Error monitoring, rate limit handling |
| 10 | Reconnection testing |
| 11–14 | Pilot monitoring, bug fixes |

## The Decision Engine

```python
def determine_state(sensor_a_online: bool, sensor_b_online: bool) -> tuple[str, str]:
    """
    Returns (state, reason_code)
    """
    if sensor_a_online and sensor_b_online:
        return "ON", "GRID_SENSOR_REACHABLE"
    elif not sensor_a_online and sensor_b_online:
        return "OFF", "GRID_SENSOR_OFFLINE_BACKUP_ONLINE"
    elif not sensor_a_online and not sensor_b_online:
        return "UNKNOWN", "BOTH_SENSORS_OFFLINE"
    else:  # A online, B offline
        return "SETUP_FAULT", "BACKUP_SENSOR_OFFLINE_GRID_ONLINE"
```

## Database Schema (Summary)

See /db/migrations/ for full SQL.

```sql
-- Key tables
raw_observations  -- every 60-second poll (never delete)
grid_events       -- confirmed state transitions only
sensors           -- sensor registry (role: GRID or BACKUP)
homes             -- home registry
users             -- user accounts
daily_summaries   -- pre-computed daily stats (optional cache)
```
