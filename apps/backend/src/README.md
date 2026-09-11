# Light Tracker Backend

Node.js + Express backend for the Light Tracker application.

The backend connects to Supabase/PostgreSQL and provides authenticated
REST API endpoints for:

- Current power status
- Power events
- Daily/weekly/monthly summaries
- Sensor/device health
- Weekly availability chart
- API health checks

---

## Tech Stack

- Node.js
- Express.js
- Supabase
- PostgreSQL
- dotenv
- CORS

---

# Project Structure

```text
apps/backend/
├── .env
├── .env.example
├── package.json
├── src/
│   ├── server.js
│   ├── lib/
│   │   └── supabase.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   └── homeRoutes.js
│   ├── services/
│   │   └── homeService.js
│   ├── utils/
│   │   └── time.js
│   └── testSupabase.js
└── db/
    └── migrations/
        ├── 001_create_users.sql
        ├── 002_create_homes.sql
        ├── 003_create_sensors.sql
        ├── 004_create_raw_observations.sql
        ├── 005_create_grid_events.sql
        └── 006_create_daily_summaries.sql


        1. Installation

From the project root:

cd apps/backend

Install dependencies:

npm install
2. Environment Variables

Create:

apps/backend/.env

Add:

SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

PORT=8000

API_SECRET_KEY=your_local_api_secret

FRONTEND_URL=http://localhost:3000

STALE_SENSOR_THRESHOLD_SECONDS=180

3. Supabase Setup

Create a Supabase project.

Open:

Supabase Dashboard
→ SQL Editor

Run the migrations in this order:

001_create_users.sql
002_create_homes.sql
003_create_sensors.sql
004_create_raw_observations.sql
005_create_grid_events.sql
006_create_daily_summaries.sql

The migrations create the database tables required by the API.

4. Sample Home

The development sample home is:

Home ID: home_abc123
Name: Demo Home
Area: Lekki
City: Lagos
Timezone: Africa/Lagos

Sample sensors:

sensor_a → GRID
sensor_b → BACKUP

5. Start the Backend

Development:

npm run dev

Expected output:

Light Tracker backend running on http://localhost:8000

Production/start command:

npm start
6. Authentication

All /homes/... endpoints require a Bearer token.

The token is supplied using:

Authorization: Bearer YOUR_API_SECRET

Example:curl -H "Authorization: Bearer your_api_secret" \
http://localhost:8000/homes/home_abc123/current-status

The /health endpoint does not require authentication.

Unauthorized request

If the token is missing or invalid:

{
  "error": "UNAUTHORIZED",
  "message": "Bearer token is required",
  "statusCode": 401
}
API ENDPOINTS

Base URL:

http://localhost:8000
7. Health Check
GET /health

Checks whether the backend is running.

Authentication

Not required.

Request
curl http://localhost:8000/health
Response
{
  "status": "ok",
  "timestamp": "2026-09-11T21:29:04+01:00"
}
8. Current Power Status
GET /homes/:homeId/current-status

Returns the home's current electricity state and sensor status.

Authentication

Required.

Example
curl -H "Authorization: Bearer YOUR_API_SECRET" \
http://localhost:8000/homes/home_abc123/current-status
Response
{
  "homeId": "home_abc123",
  "state": "ON",
  "confidence": "HIGH",
  "reasonCode": "GRID_RESTORED_AFTER_OUTAGE",
  "since": "2026-09-11T13:00:00+01:00",
  "durationSeconds": 30401,
  "lastUpdated": "2026-09-11T14:00:00+01:00",
  "sensors": {
    "grid": {
      "id": "sensor_a",
      "online": true,
      "lastSeen": "2026-09-11T14:00:00+01:00"
    },
    "backup": {
      "id": "sensor_b",
      "online": true,
      "lastSeen": "2026-09-11T14:00:00+01:00"
    }
  }
}
Possible states
ON
OFF
UNKNOWN
SETUP_FAULT
Possible confidence levels
HIGH
MEDIUM
LOW
9. Power Events
GET /homes/:homeId/events

Returns power state transition events.

Authentication

Required.

Query parameters
Parameter	Required	Description
from	No	Start timestamp
to	No	End timestamp
limit	No	Maximum number of events

Default limit:

100
Example
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/events"
With date range
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/events?from=2026-09-11T00:00:00+01:00&to=2026-09-11T23:59:59+01:00&limit=100"
Response
{
  "homeId": "home_abc123",
  "from": "2026-09-11T00:00:00+01:00",
  "to": "2026-09-11T21:27:53+01:00",
  "events": [
    {
      "id": "0e6d4de2-b101-4a46-b3fa-3d87cf8c2e8b",
      "state": "ON",
      "reasonCode": "GRID_RESTORED_AFTER_OUTAGE",
      "confidence": "HIGH",
      "recordedAt": "2026-09-11T13:00:00+01:00",
      "durationSeconds": 7200
    }
  ]
}
10. Power Summary
GET /homes/:homeId/summary

Returns electricity statistics for a selected period.

Authentication

Required.

Query parameters

period is required.

Supported values:

today
yesterday
week
month

Optional:

date
Today
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/summary?period=today"
Yesterday
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/summary?period=yesterday"
Week
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/summary?period=week"
Month
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/summary?period=month"
Response
{
  "homeId": "home_abc123",
  "period": "today",
  "date": "2026-09-11",
  "gridOnSeconds": 32400,
  "gridOffSeconds": 14400,
  "unknownSeconds": 3600,
  "outageCount": 2,
  "longestOutageSeconds": 7200,
  "avgOutageDurationSeconds": 7200,
  "availabilityPercent": 64.3,
  "coveragePercent": 92.3,
  "hourlyBreakdown": [
    {
      "hour": 6,
      "state": "ON",
      "availabilityPercent": 100
    },
    {
      "hour": 8,
      "state": "OFF",
      "availabilityPercent": 0
    },
    {
      "hour": 9,
      "state": "UNKNOWN",
      "availabilityPercent": null
    }
  ]
}
11. Device Health
GET /homes/:homeId/device-health

Returns the health and freshness of the home's sensors.

Authentication

Required.

Example
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/device-health"
Response
{
  "homeId": "home_abc123",
  "sensors": [
    {
      "id": "sensor_a",
      "role": "GRID",
      "deviceId": "demo-grid-device",
      "online": true,
      "lastSeenAt": "2026-09-11T21:31:52+01:00",
      "staleSince": null,
      "isStale": false,
      "staleThresholdSeconds": 180
    },
    {
      "id": "sensor_b",
      "role": "BACKUP",
      "deviceId": "demo-backup-device",
      "online": true,
      "lastSeenAt": "2026-09-11T21:31:52+01:00",
      "staleSince": null,
      "isStale": false,
      "staleThresholdSeconds": 180
    }
  ]
}

A sensor becomes stale when its last observation is older than:

STALE_SENSOR_THRESHOLD_SECONDS

The development default is:

180 seconds
12. Weekly Chart
GET /homes/:homeId/weekly-chart

Returns daily electricity statistics for the previous seven days.

Authentication

Required.

Example
curl -H "Authorization: Bearer YOUR_API_SECRET" \
"http://localhost:8000/homes/home_abc123/weekly-chart"
Response
{
  "homeId": "home_abc123",
  "days": [
    {
      "date": "2026-09-05",
      "gridOnHours": 0,
      "gridOffHours": 0,
      "unknownHours": 0,
      "availabilityPercent": 0,
      "coveragePercent": 0
    },
    {
      "date": "2026-09-11",
      "gridOnHours": 9,
      "gridOffHours": 4,
      "unknownHours": 1,
      "availabilityPercent": 69.23,
      "coveragePercent": 92.31
    }
  ]
}

The endpoint returns seven daily entries.

13. Error Responses

The API uses a consistent error format.

Example:

{
  "error": "HOME_NOT_FOUND",
  "message": "No home found with ID home_xyz",
  "statusCode": 404
}
Common errors
Status	Error	Meaning
400	INVALID_DATE_RANGE	Invalid from/to range
401	UNAUTHORIZED	Missing/invalid Bearer token
403	FORBIDDEN	User is not allowed to access the home
404	HOME_NOT_FOUND	Home does not exist
500	INTERNAL_ERROR	Unexpected server error
14. Testing All Endpoints

Set your token:

TOKEN="YOUR_API_SECRET"

Health:

curl http://localhost:8000/health

Current status:

curl -H "Authorization: Bearer $TOKEN" \
http://localhost:8000/homes/home_abc123/current-status

Events:

curl -H "Authorization: Bearer $TOKEN" \
"http://localhost:8000/homes/home_abc123/events"

Today summary:

curl -H "Authorization: Bearer $TOKEN" \
"http://localhost:8000/homes/home_abc123/summary?period=today"

Device health:

curl -H "Authorization: Bearer $TOKEN" \
"http://localhost:8000/homes/home_abc123/device-health"

Weekly chart:

curl -H "Authorization: Bearer $TOKEN" \
http://localhost:8000/homes/home_abc123/weekly-chart
15. API Flow

The frontend should communicate with the backend like this:

Next.js Dashboard
       │
       │ HTTP + Bearer Token
       ▼
Express API
       │
       ▼
Supabase
       │
       ▼
PostgreSQL

The dashboard can call:

/current-status
/events
/summary
/device-health
/weekly-chart

and use the returned data to populate the dashboard.

16. Development Notes

All API timestamps use:

Africa/Lagos

and are returned in ISO 8601 format with:

+01:00

Durations are returned in seconds unless otherwise specified.

The current development authentication uses a server-side API secret.

Production authentication should use proper user authentication/JWT verification rather than a shared development secret.

17. Git

Before committing, make sure .env is ignored.

Example .gitignore:

.env
.env.*
!.env.example
node_modules/

Then:

git status
git add .
git commit -m "Implement Supabase-backed home endpoints"
git push origin feature/dashboard-backend
18. Available Endpoints
Method	Endpoint	Auth
GET	/health	No
GET	/homes/:homeId/current-status	Yes
GET	/homes/:homeId/events	Yes
GET	/homes/:homeId/summary	Yes
GET	/homes/:homeId/device-health	Yes
GET	/homes/:homeId/weekly-chart	Yes
Backend Status

The development backend currently supports all required home endpoints and connects to Supabase PostgreSQL.

Sample home:

home_abc123

Backend:

http://localhost:8000
