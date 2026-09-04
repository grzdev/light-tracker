# Event Specification & State Machine

> **This is the source of truth.** All three team members must agree on this before writing any code.
> Last updated: 2026-09-04

---

## Canonical Event Object

Every state change produces one event object stored in the database.

```json
{
  "id": "uuid-v4",
  "homeId": "home_abc123",
  "sensorId": "sensor_grid_a",
  "sensorRole": "GRID",
  "recordedAt": "2026-09-04T14:30:00+01:00",
  "state": "OFF",
  "reasonCode": "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
  "confidence": "HIGH",
  "rawPingResult": "TIMEOUT",
  "previousState": "ON",
  "durationInPreviousStateMs": 7200000
}
```

### Field Definitions

| Field | Type | Description |
|:---|:---|:---|
| `id` | UUID | Unique event ID |
| `homeId` | string | Which home this event belongs to |
| `sensorId` | string | Which physical sensor generated this |
| `sensorRole` | enum | `GRID` or `BACKUP` |
| `recordedAt` | ISO 8601 | Always in Africa/Lagos timezone (+01:00) |
| `state` | enum | `ON`, `OFF`, or `UNKNOWN` |
| `reasonCode` | enum | Why we assigned this state (see below) |
| `confidence` | enum | `HIGH`, `MEDIUM`, or `LOW` |
| `rawPingResult` | string | Raw response from device API |
| `previousState` | enum | What the state was before this transition |
| `durationInPreviousStateMs` | number | How long the previous state lasted |

---

## State Machine

```
                    +------------------+
                    |      ON          |
                    | (Grid detected)  |
                    +--------+---------+
                             |
              +--------------+---------------+
              |                              |
   Sensor A offline        Sensor A offline
   Sensor B online         Sensor B offline
              |                              |
              v                              v
     +--------+---------+        +----------+---------+
     |       OFF         |        |      UNKNOWN        |
     | (Outage confirmed)|        | (Cannot determine)  |
     +-------------------+        +--------------------+
              |                              |
              +--------- Sensor A -----------+
                         comes back online
                              |
                              v
                    +------------------+
                    |      ON          |
                    +------------------+
```

---

## Reason Codes

| Code | State Assigned | Meaning |
|:---|:---:|:---|
| `GRID_SENSOR_REACHABLE` | ON | Sensor A responded; grid is present |
| `GRID_SENSOR_OFFLINE_BACKUP_ONLINE` | OFF | A offline, B online — confirmed outage |
| `BOTH_SENSORS_OFFLINE` | UNKNOWN | Both offline — internet/router issue |
| `BACKUP_SENSOR_OFFLINE_GRID_ONLINE` | ALERT | Likely hardware/wiring fault |
| `GRID_RESTORED_AFTER_OUTAGE` | ON | Sensor A came back, B was already online |
| `GRID_RESTORED_AFTER_UNKNOWN` | ON | Both came back — we log ON but data gap noted |
| `SENSOR_HEARTBEAT_MISSED` | UNKNOWN | No ping received in expected window |
| `FLAP_SUPPRESSED` | — | Transition ignored (under debounce threshold) |

---

## Debounce Rules (Anti-Flap)

A state change is not recorded until the new state persists for **3 minutes (180 seconds)**.

**Why:** Grid power sometimes blinks for a few seconds during switching. Logging every blink produces noise, not signal.

**Implementation:** The poller checks every 60 seconds. Only after 3 consecutive polls show the same new state does the backend commit a state-change event.

---

## Coverage Formula

```
Availability (%) = (confirmed ON seconds / confirmed observed seconds) × 100
Coverage (%)     = (confirmed observed seconds / total elapsed seconds) × 100
```

**Confirmed observed time** = total time minus UNKNOWN periods.

**UNKNOWN periods are never counted as ON or OFF.**

Example:
- Total time: 24 hours (86,400s)
- Confirmed ON: 9 hours (32,400s)
- Confirmed OFF: 7 hours (25,200s)
- UNKNOWN: 8 hours (28,800s)
- Confirmed observed: 16 hours (57,600s)

```
Availability = 32,400 / 57,600 = 56.3%   (of the time we could observe)
Coverage     = 57,600 / 86,400 = 66.7%   (we observed this much of the day)
```

The dashboard shows: "Grid available 56% of monitored time (66% of today monitored)"

---

## Raw Observations vs Events

The backend stores **two separate tables**:

1. **`raw_observations`** — every 60-second poll result. Never deleted. Used for debugging and reprocessing.
2. **`grid_events`** — only state transitions after debounce. Used for all metrics and the dashboard.

This means if the debounce logic is wrong, we can reprocess history from raw observations.
