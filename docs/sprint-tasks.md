# Sprint Tasks — 14-Day Prototype

> Detailed day-by-day task breakdown for all three team members.
> Update this file as tasks are completed.

---

## Phase 1 — Foundation & Specs (Days 1–3)

### Day 1

**Frontend / Product Lead**
- [ ] Order 10 Tuya/Sonoff smart plugs immediately (hardware procurement is the critical path)
- [ ] Create rough wireframe sketches for: Sign-in screen, Home dashboard (ON/OFF/UNKNOWN status card), Event timeline, Weekly view
- [ ] Write the exact UI copy for each state:
  - ON: "Grid power is available."
  - OFF: "Grid power appears to be off. (Last confirmed at HH:MM)"
  - UNKNOWN: "We cannot confirm grid status. Your tracker or internet connection may be unavailable."
- [ ] Open the reference dashboard at /reference/dashboard/index.html and note what works well and what is missing

**Backend Developer**
- [ ] Create Supabase project (free tier) and note the DB URL and anon key
- [ ] Design the database schema (see event-spec.md for field definitions):
  - `users` table
  - `homes` table
  - `sensors` table
  - `raw_observations` table
  - `grid_events` table
  - `daily_summaries` table
  - `device_heartbeats` table
- [ ] Set up local Postgres for development (or use Supabase dev branch)

**Data Scientist**
- [ ] Read event-spec.md carefully and raise any questions
- [ ] Define debounce rules: minimum time a new state must persist before being committed (proposed: 3 minutes / 3 consecutive polls)
- [ ] Define when UNKNOWN is assigned vs OFF — write the decision tree as a flowchart or pseudocode
- [ ] Define the Availability and Coverage formulas (see event-spec.md for proposed formulas)

---

### Day 2

**Frontend / Product Lead**
- [ ] Agree on the JSON shape of each API response with backend (use api-contract.md as base — propose changes if needed)
- [ ] Create a `mock-data.js` file in the frontend that exports objects matching the API contract exactly
- [ ] Sketch the "Tracker Health" section of the dashboard (shows sensor A and B status separately)

**Backend Developer**
- [ ] Implement the device registry: API to register a sensor (plug ID + role + homeId)
- [ ] Write the DB schema migrations (SQL files in /apps/backend/db/migrations/)
- [ ] Set up environment variable structure (.env.example)

**Data Scientist**
- [ ] Create a spreadsheet simulating 48 hours of 60-second polls for a two-plug home
- [ ] Validate the Coverage and Availability formulas against the simulated data
- [ ] Document all edge cases: simultaneous dropout, rapid reconnection, overnight internet outage

---

### Day 3

**All three — 1-hour sync meeting**
- [ ] Review and sign off on event-spec.md (everyone must agree before Day 4)
- [ ] Review and sign off on api-contract.md
- [ ] Confirm pilot home count: 3 homes
- [ ] Confirm hardware plan: 2 plugs + backup-powered router per home
- [ ] Assign pilot homes (who installs which)

---

## Phase 2 — Independent Builds (Days 4–7)

### Day 4

**Frontend / Product Lead**
- [ ] Initialize Next.js app: `npx create-next-app@latest apps/frontend --typescript --app --tailwind=false`
- [ ] Set up base styles: mobile-first, dark mode, Nigeria-friendly font (Inter from Google Fonts)
- [ ] Build the Status Card component using mock data (shows state, duration, last-updated)
- [ ] Build colour system: Green for ON, Red for OFF, Amber for UNKNOWN, Grey for data gaps

**Backend Developer**
- [ ] Write the Tuya polling worker (polls every 60 seconds)
- [ ] Store each poll result as a raw_observation (do not deduplicate at this stage)
- [ ] Test with one physical plug in your possession

**Data Scientist**
- [ ] Write the session-grouping function: converts a list of raw_observations into confirmed grid_events
- [ ] Implement the debounce logic (ignore transitions under 3 minutes)
- [ ] Write unit tests for the grouping logic using simulated data

---

### Day 5

**Frontend / Product Lead**
- [ ] Build Daily Metrics section: grid hours, outage hours, outage count, longest outage
- [ ] Build the Coverage indicator: "Data coverage: 94% — 1h 26m unconfirmed today"
- [ ] Ensure all numbers format correctly for Nigerian context (use 12h time with AM/PM)

**Backend Developer**
- [ ] Implement the ON/OFF/UNKNOWN decision logic using the two-sensor rule from event-spec.md
- [ ] Commit confirmed state transitions to grid_events (with reason codes)
- [ ] Prevent duplicate events: if state has not changed, do not insert a new event

**Data Scientist**
- [ ] Write SQL/Python queries for: daily grid hours, daily outage hours, outage count, longest outage, average outage duration
- [ ] Write the coverage query: observed time vs total elapsed time
- [ ] Test all queries against the simulated 48h dataset

---

### Day 6

**Frontend / Product Lead**
- [ ] Build the Event Timeline: scrollable list of today's ON/OFF/UNKNOWN transitions with times and durations
- [ ] Build the Weekly Bar Chart: 7-day view showing grid vs outage vs unknown hours per day
- [ ] Use the hourly_breakdown from the summary API to colour each hour

**Backend Developer**
- [ ] Implement all five API endpoints from api-contract.md using mock/seeded data in the DB
- [ ] Write the Dead Man's Switch: if sensor B has not reported in 3 minutes, the current-status endpoint returns UNKNOWN immediately
- [ ] Add a basic request log to track API calls

**Data Scientist**
- [ ] Write the hour-of-day availability profile: average availability for each hour across all days
- [ ] Write the weekly summary: best day, worst day, total grid hours this week
- [ ] Validate all aggregations produce sensible numbers with the simulated data

---

### Day 7

**Frontend / Product Lead**
- [ ] Build the Tracker Health section: shows sensor A and sensor B status separately with last-seen times
- [ ] Build empty states (new home with no data yet), loading states, and error states
- [ ] Do a full design review of the mock-data dashboard — is it clear enough for a non-technical user?

**Backend Developer**
- [ ] Implement device heartbeat logging: each poll writes a heartbeat timestamp per sensor
- [ ] Implement stale-sensor alert: if no heartbeat in 5 minutes, flag the sensor as stale in device-health endpoint
- [ ] Write a short internal test: simulate sensor dropout and verify UNKNOWN state is returned

**Data Scientist**
- [ ] Peer-review the backend session-grouping logic with the backend developer
- [ ] Final check of all formula implementations
- [ ] Prepare test assertions: 10 specific input scenarios with expected output values

---

## Phase 3 — Alpha Integration (Days 8–10)

### Day 8

**Frontend / Product Lead**
- [ ] Physically install two-plug setup in your own home (Sensor A: grid-only socket, Sensor B: inverter socket)
- [ ] Verify the router is plugged into the inverter/UPS
- [ ] Wire the Next.js frontend to the live backend API (replace mock-data.js with real fetch calls)
- [ ] Handle the Africa/Lagos timezone in all displayed timestamps

**Backend Developer**
- [ ] Expose all five live API endpoints (the frontend will connect today)
- [ ] Confirm CORS is configured for local frontend dev URL
- [ ] Monitor the database as your home installation starts sending data

**Data Scientist**
- [ ] Watch the first 4 hours of live data from your home
- [ ] Flag any unexpected events or misclassified states to backend developer
- [ ] Note actual vs expected debounce behaviour

---

### Day 9

**Frontend / Product Lead**
- [ ] Add automatic data refresh (poll every 60 seconds or use Supabase real-time)
- [ ] Show "Last updated: X seconds ago" on the status card
- [ ] Test loading states with real slow network conditions
- [ ] Test the UNKNOWN state by turning off the router briefly

**Backend Developer**
- [ ] Deploy backend API to Railway or Render (production URL)
- [ ] Deploy database to Supabase production project
- [ ] Add basic error monitoring (Sentry free tier or simple console log to a log table)

**Data Scientist**
- [ ] Compare Day 8 live data to your manual observations (write down actual on/off times)
- [ ] Calculate preliminary false-outage count from the first day
- [ ] Tune debounce threshold if needed (submit PR to backend)

---

### Day 10

**Frontend / Product Lead**
- [ ] Final edge-case pass: new home with zero data, SETUP_FAULT state, sensor coming back online
- [ ] Confirm all error messages are plain English (not technical error codes)
- [ ] Share a live demo link with backend developer and data scientist

**Backend Developer**
- [ ] Test full reconnection scenario: unplug both sensors, plug back in, verify state recovery
- [ ] Handle Tuya API rate limits gracefully (back off and retry, do not crash)
- [ ] Document the installation setup steps for pilot homes

**Data Scientist**
- [ ] Final validation of Day 8–9 data against manual log
- [ ] Write the preliminary accuracy report for Home 1

---

## Phase 4 — Pilot Deployment & Validation (Days 11–14)

### Day 11

**Frontend / Product Lead**
- [ ] Install two-plug setup in Pilot Home 2
- [ ] Walk the home's occupants through the app (5-minute demo)
- [ ] Give them the paper validation log template (see validation-plan.md)

**Backend Developer**
- [ ] Register Pilot Home 2 sensors in production
- [ ] Confirm data is flowing from Home 2
- [ ] Monitor all homes in the DB — check for stale sensors

**Data Scientist**
- [ ] Begin 48-hour paper-log validation period for Homes 1 and 2
- [ ] Set up the validation comparison spreadsheet

---

### Day 12

**Frontend / Product Lead**
- [ ] Install two-plug setup in Pilot Home 3
- [ ] Collect first verbal feedback from Pilot Home 2 occupants

**Backend Developer**
- [ ] Register Pilot Home 3 sensors in production
- [ ] Fix any real-world issues found in Homes 1 and 2

**Data Scientist**
- [ ] Extend paper-log validation to Home 3
- [ ] Flag any patterns in false-positives or missed outages

---

### Day 13

**Frontend / Product Lead**
- [ ] Collect feedback from all 3 pilot homes
- [ ] Fix top 3 UX issues found during feedback sessions
- [ ] Polish onboarding copy and installation instructions

**Backend Developer**
- [ ] Fix any backend bugs found from real usage
- [ ] Final deployment hardening

**Data Scientist**
- [ ] Compare all paper logs to database records
- [ ] Calculate final accuracy metrics:
  - Confirmed outages captured correctly
  - False outages recorded (A offline, B offline — should be UNKNOWN)
  - Missed outages
  - Average data coverage percentage

---

### Day 14

**All three**
- [ ] Review accuracy report together
- [ ] Decide: is the false-outage rate acceptable? (target: near zero)
- [ ] Write the pilot summary (what worked, what needs fixing)
- [ ] Post the demo link and pilot summary to the team

**Sprint is complete when:**
- Three homes have been running for at least 48 hours
- Paper-log validation is done
- False-outage rate is documented (not just claimed)
- The app shows UNKNOWN correctly (test this explicitly)
