# Light Tracker — Backup & Data Science Integration Specification

> **Version:** 1.0.0  
> **Status:** Canonical Specification  
> **Audience:** Frontend Developers, Backend Developers, Data Scientists, DevOps

---

## 1. Overview & Objectives

The Light Tracker platform measures residential grid availability across Nigerian households using a two-sensor verification architecture:
- **Sensor A (Grid Socket):** Connected to grid-only power.
- **Sensor B (Inverter/UPS Socket):** Connected to backup power alongside the Wi-Fi router.

To support robust disaster recovery, automated cloud syncing, cross-household research, and machine learning models, this specification defines the canonical interfaces for:
1. **Full System Backup Snapshots** (portable, immutable state snapshots with SHA-256 cryptographic checksums).
2. **Data Science & ML Datasets** (continuous resampled time-series with engineered temporal features, event transition logs, and daily aggregations).
3. **Outbound Webhooks & Cloud Integration Contracts** (automated synchronization to Supabase, AWS S3/Cloudflare R2, n8n, Zapier, or private storage).
4. **Public/Local Data Endpoints** for direct notebook ingestion (Python, R, Julia).

---

## 2. Backup Snapshot Specification (`LightTrackerBackupV1`)

A backup snapshot represents the complete state of a household tracker at a point in time. It is exported as a single JSON document.

### 2.1 Envelope Schema

```json
{
  "$schema": "https://light-tracker.app/schemas/backup-v1.json",
  "version": "1.0.0",
  "exportedAt": "2026-09-05T18:00:00+01:00",
  "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "generator": "light-tracker-web/0.1.0",
  "home": {
    "id": "home_abc123",
    "name": "Alex D. Home",
    "location": "Yaba, Lagos, Nigeria",
    "timezone": "Africa/Lagos",
    "createdAt": "2026-08-20T00:00:00+01:00"
  },
  "sensors": [
    {
      "id": "sensor_a",
      "role": "GRID",
      "name": "Grid Sensor (Living Room)",
      "deviceId": "tuya_device_xyz",
      "online": true,
      "lastSeenAt": "2026-09-05T18:00:00+01:00"
    },
    {
      "id": "sensor_b",
      "role": "BACKUP",
      "name": "Inverter Sensor (Study)",
      "deviceId": "tuya_device_abc",
      "online": true,
      "lastSeenAt": "2026-09-05T18:00:00+01:00"
    }
  ],
  "rawObservations": [
    {
      "timestamp": "2026-09-05T17:59:00+01:00",
      "sensorAOnline": true,
      "sensorBOnline": true,
      "state": "ON",
      "reasonCode": "GRID_SENSOR_REACHABLE"
    }
  ],
  "gridEvents": [
    {
      "id": "evt_001",
      "recordedAt": "2026-09-05T14:00:00+01:00",
      "state": "ON",
      "previousState": "OFF",
      "reasonCode": "GRID_RESTORED_AFTER_OUTAGE",
      "confidence": "HIGH",
      "durationSeconds": 14400
    }
  ],
  "dailySummaries": [
    {
      "date": "2026-09-05",
      "gridOnHours": 13.5,
      "gridOffHours": 4.0,
      "unknownHours": 0.5,
      "availabilityPercent": 77.1,
      "coveragePercent": 97.2,
      "outageCount": 2,
      "longestOutageSeconds": 7200
    }
  ],
  "integrationsConfig": {
    "autoBackupEnabled": true,
    "cadence": "DAILY",
    "webhookUrl": "https://api.example.com/webhooks/light-tracker-backup",
    "lastBackupAt": "2026-09-05T02:00:00+01:00"
  }
}
```

### 2.2 Checksum Calculation
The `checksumSha256` is calculated over the canonical JSON string of the backup payload **excluding** the `checksumSha256` property itself. This ensures unambiguous verification upon restoration.

---

## 3. Data Science & ML Dataset Specifications

### 3.1 Continuous Resampled Time Series (`dataset_timeseries`)
For time-series modeling, survival analysis, and outage prediction (e.g. XGBoost, Prophet, LSTM), discrete events must be resampled onto a continuous regular grid (e.g., 1-minute, 5-minute, 15-minute, or 1-hour intervals).

#### Column Schema

| Column Name | Type | Description | ML Notes |
|:---|:---|:---|:---|
| `timestamp` | string (ISO 8601) | Sample timestamp with `+01:00` offset | Primary time index |
| `hour` | int (0–23) | Hour of the day in West Africa Time | Local circadian feature |
| `day_of_week` | int (0–6) | Day index (0 = Monday, 6 = Sunday) | Weekly load shedding patterns |
| `is_weekend` | int (0 or 1) | Binary weekend indicator | Residential demand shift |
| `sin_hour` | float [-1.0, 1.0] | $\sin(2\pi \cdot \text{hour} / 24)$ | Cyclical diurnal continuous feature |
| `cos_hour` | float [-1.0, 1.0] | $\cos(2\pi \cdot \text{hour} / 24)$ | Cyclical diurnal continuous feature |
| `state` | string | `"ON" \| "OFF" \| "UNKNOWN" \| "SETUP_FAULT"` | Categorical ground truth |
| `is_grid_on` | int (1, 0, null) | 1 = ON, 0 = OFF, null = UNKNOWN | Numeric label for binary classification |
| `is_unknown` | int (0 or 1) | 1 if unconfirmed / connection lost | Masking flag for loss functions |
| `confidence` | string | `"HIGH" \| "MEDIUM" \| "LOW"` | Quality weighting |
| `rolling_avail_6h` | float (0–100) | Grid availability % in previous 6 hours | Short-term momentum feature |
| `rolling_avail_24h`| float (0–100) | Grid availability % in previous 24 hours | Daily baseline feature |
| `outage_streak_hours`| float | Hours since grid turned off (0 if ON) | Continuous target for survival analysis |

### 3.2 Canonical Event Transition Log (`dataset_events`)
Optimized for Markov state transition matrices, Weibull survival estimation, and reliability engineering.

#### Column Schema

| Column Name | Type | Description |
|:---|:---|:---|
| `event_id` | string | Unique event identifier |
| `recorded_at` | string (ISO 8601) | Timestamp state began |
| `state` | string | `"ON" \| "OFF" \| "UNKNOWN"` |
| `previous_state`| string | Previous state before this transition |
| `duration_seconds`| int | Duration this state persisted |
| `duration_hours` | float | Duration in hours |
| `reason_code` | string | Diagnostic code explaining assignment |
| `confidence` | string | High, Medium, or Low |
| `is_censored` | int (0 or 1) | 1 if event was still active at export (censored) |

---

## 4. Webhook & Cloud Storage Integration

### 4.1 Webhook Dispatch Format
When an automated or manual backup occurs, the platform sends an HTTP POST request:

```http
POST /webhooks/light-tracker-backup HTTP/1.1
Host: api.example.com
Content-Type: application/json
X-LightTracker-Event: backup.snapshot.created
X-LightTracker-Version: 1.0.0
X-LightTracker-Home: home_abc123
X-LightTracker-Checksum: <sha256>
Authorization: Bearer <user_configured_secret>

{ ... LightTrackerBackupV1 JSON payload ... }
```

### 4.2 Expected Response
- **Status `200 OK` or `201 Created`:** Successfully persisted.
- **Status `4xx / 5xx`:** Trigger failure logged in the local audit log for retry.

---

## 5. Public Static Dataset Endpoints

For static site deployments (e.g. Netlify), data endpoints are served directly under `/data/`:
- `GET /data/backup-latest.json` — Latest portable full snapshot.
- `GET /data/dataset-timeseries-5m.json` — 5-minute resampled ML-ready dataset.
- `GET /data/dataset-events.json` — Event transition log.
- `GET /data/dataset-daily.json` — 7-day daily summary metrics.
- `GET /data/schema.json` — JSON schema validator for ingestion pipelines.

External tools (Python, R, Pandas, Polars) can query these static URLs without server execution overhead.
