# API Contract

> **Source of truth for frontend ↔ backend communication.**
> Frontend should build mock data that matches this shape exactly.
> Backend must implement these endpoints before Day 8.

Base URL (dev): `http://localhost:8000`
Base URL (prod): `https://api.light-tracker.app` (TBD)

All timestamps in ISO 8601 with Africa/Lagos offset (+01:00).
All durations in seconds unless stated otherwise.

---

## Authentication

All endpoints except `/health` require a Bearer token.

```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### GET /health
Check API is alive. No auth required.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-09-04T14:00:00+01:00" }
```

---

### GET /homes/:homeId/current-status
Current power state for a home.

**Response:**
```json
{
  "homeId": "home_abc123",
  "state": "OFF",
  "confidence": "HIGH",
  "reasonCode": "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
  "since": "2026-09-04T11:42:00+01:00",
  "durationSeconds": 7320,
  "lastUpdated": "2026-09-04T14:00:00+01:00",
  "sensors": {
    "grid": { "id": "sensor_a", "online": false, "lastSeen": "2026-09-04T11:41:00+01:00" },
    "backup": { "id": "sensor_b", "online": true, "lastSeen": "2026-09-04T14:00:00+01:00" }
  }
}
```

**State values:** `"ON"` | `"OFF"` | `"UNKNOWN"` | `"SETUP_FAULT"`

---

### GET /homes/:homeId/events
Timeline of state-change events.

**Query params:**
- `from` (ISO 8601) — start of range. Default: start of current day
- `to` (ISO 8601) — end of range. Default: now
- `limit` (int) — max events to return. Default: 100

**Response:**
```json
{
  "homeId": "home_abc123",
  "from": "2026-09-04T00:00:00+01:00",
  "to": "2026-09-04T14:00:00+01:00",
  "events": [
    {
      "id": "evt_001",
      "state": "ON",
      "reasonCode": "GRID_RESTORED_AFTER_OUTAGE",
      "confidence": "HIGH",
      "recordedAt": "2026-09-04T08:15:00+01:00",
      "durationSeconds": 12420
    },
    {
      "id": "evt_002",
      "state": "OFF",
      "reasonCode": "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
      "confidence": "HIGH",
      "recordedAt": "2026-09-04T11:42:00+01:00",
      "durationSeconds": null
    }
  ]
}
```

---

### GET /homes/:homeId/summary
Aggregated metrics for a time period.

**Query params:**
- `period` — `"today"` | `"yesterday"` | `"week"` | `"month"`
- `date` (ISO 8601 date) — specific date, used with `period=today`

**Response:**
```json
{
  "homeId": "home_abc123",
  "period": "today",
  "date": "2026-09-04",
  "gridOnSeconds": 34200,
  "gridOffSeconds": 25200,
  "unknownSeconds": 28800,
  "outageCount": 3,
  "longestOutageSeconds": 18000,
  "avgOutageDurationSeconds": 8400,
  "availabilityPercent": 57.6,
  "coveragePercent": 66.7,
  "hourlyBreakdown": [
    { "hour": 0, "state": "ON", "availabilityPercent": 100 },
    { "hour": 1, "state": "ON", "availabilityPercent": 100 },
    { "hour": 11, "state": "OFF", "availabilityPercent": 0 },
    { "hour": 12, "state": "UNKNOWN", "availabilityPercent": null }
  ]
}
```

---

### GET /homes/:homeId/device-health
Status of all sensors registered to a home.

**Response:**
```json
{
  "homeId": "home_abc123",
  "sensors": [
    {
      "id": "sensor_a",
      "role": "GRID",
      "deviceId": "tuya_device_xyz",
      "online": false,
      "lastSeenAt": "2026-09-04T11:41:00+01:00",
      "staleSince": "2026-09-04T11:41:00+01:00",
      "isStale": true,
      "staleThresholdSeconds": 180
    },
    {
      "id": "sensor_b",
      "role": "BACKUP",
      "deviceId": "tuya_device_abc",
      "online": true,
      "lastSeenAt": "2026-09-04T14:00:00+01:00",
      "staleSince": null,
      "isStale": false,
      "staleThresholdSeconds": 180
    }
  ]
}
```

---

### GET /homes/:homeId/weekly-chart
Data for the 7-day bar chart on the dashboard.

**Response:**
```json
{
  "homeId": "home_abc123",
  "days": [
    {
      "date": "2026-08-29",
      "gridOnHours": 9.5,
      "gridOffHours": 7.2,
      "unknownHours": 7.3,
      "availabilityPercent": 57.0,
      "coveragePercent": 69.6
    }
  ]
}
```

---

## Error Responses

```json
{
  "error": "HOME_NOT_FOUND",
  "message": "No home found with ID home_xyz",
  "statusCode": 404
}
```

Common error codes:
- `HOME_NOT_FOUND` — 404
- `UNAUTHORIZED` — 401
- `FORBIDDEN` — 403 (authenticated but not your home)
- `INVALID_DATE_RANGE` — 400
- `INTERNAL_ERROR` — 500
