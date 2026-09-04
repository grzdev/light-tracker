# ⚡ Light Tracker — Nigerian Grid Availability Monitor

> **A home-power reliability tracker that measures grid availability with transparent confidence levels — not just whether a smart plug is reachable.**

Built by a team of three for Nigerian households. Tracks whether NEPA/PHCN grid power is ON, OFF, or UNKNOWN (when we cannot tell the difference between an outage and internet failure).

---

## 📖 Table of Contents

- [What This Is](#what-this-is)
- [How It Works](#how-it-works)
- [The UNKNOWN State — Why It Matters](#the-unknown-state--why-it-matters)
- [Project Structure](#project-structure)
- [Team and Responsibilities](#team-and-responsibilities)
- [14-Day Sprint Roadmap](#14-day-sprint-roadmap)
- [Getting Started](#getting-started)
- [Reference Implementation](#reference-implementation)
- [MVP Success Criteria](#mvp-success-criteria)

---

## What This Is

Light Tracker answers these questions for Nigerian households:

- Is grid (NEPA/PHCN) power currently available at home?
- When did it go off or come on?
- How many hours of grid power did I receive today, this week, this month?
- What are my area's usual power patterns?
- Was the data trustworthy, or did our tracker lose internet too?

This is **not** a nationwide outage map. It is a **per-home reliability tracker** with honesty about data quality built in from day one.

---

## How It Works

Two smart plugs per home, not one.

```
Grid-only socket    -> Sensor A ---+
                                   +---> Backend API -> Postgres DB -> Web Dashboard
Inverter/UPS socket -> Sensor B ---+
           ^
      Wi-Fi Router (MUST be on Inverter/UPS power)
```

| Sensor A (Grid) | Sensor B (Backup) | Interpretation |
|:---:|:---:|:---|
| Online | Online | **ON** — Grid power is available |
| Offline | Online | **OFF** — Grid outage confirmed |
| Offline | Offline | **UNKNOWN** — Internet/router failure; do not log as outage |
| Online | Offline | **ALERT** — Setup fault; check backup circuit |

---

## The UNKNOWN State — Why It Matters

The reference implementation (see /reference) infers "grid power is on" from "the plug answered Tuya's cloud." Those are not the same thing. Any link in the chain — grid, plug, router, ISP, Tuya servers — can fail and look identical to NEPA cutting power.

**Our system never silently counts UNKNOWN time as either ON or OFF.**

```
Availability = confirmed grid-ON time / confirmed observed time
Coverage     = confirmed observed time / total time
```

The dashboard always shows both metrics.

---

## Project Structure

```
light-tracker/
├── apps/
│   ├── frontend/          # Next.js mobile-first web dashboard (Frontend Dev)
│   ├── backend/           # Python/Node API + device poller (Backend Dev)
│   └── data/              # Analytics logic, metrics, state machine (Data Scientist)
├── docs/
│   ├── architecture.md    # System design decisions
│   ├── event-spec.md      # Canonical event format and state machine
│   ├── api-contract.md    # API endpoints (source of truth for all three)
│   ├── install-runbook.md # Physical hardware installation guide
│   ├── sprint-tasks.md    # Detailed day-by-day tasks per team member
│   └── validation-plan.md # How we prove our data is accurate
├── reference/             # Original single-home tracker (odun-lami) — read-only
│   ├── tracker/           # Python polling script
│   ├── apps-script/       # Google Sheets integration
│   └── dashboard/         # Original HTML dashboard
├── .github/
│   └── ISSUE_TEMPLATE/    # Bug report and feature request templates
└── README.md
```

---

## Team and Responsibilities

| Role | Core Mandate |
|:---|:---|
| **Frontend / Product Lead** | User experience, dashboard UI, onboarding, pilot coordination, hardware procurement |
| **Backend Developer** | Device ingestion, database, API, dead man switch, alerts, deployment |
| **Data Scientist** | State machine logic, session grouping, metrics, coverage calculations, validation |

See detailed task breakdowns in [docs/sprint-tasks.md](docs/sprint-tasks.md).

---

## 14-Day Sprint Roadmap

### Phase 1 — Foundation and Specs (Days 1–3)
Goal: Hardware ordered, database provisioned, state machine agreed on paper.

### Phase 2 — Independent Builds (Days 4–7)
Goal: Frontend shell with mock data. Backend ingestion running. Data pipeline logic written.

### Phase 3 — Alpha Integration (Days 8–10)
Goal: All three pieces connected in one house. Live data on screen.

### Phase 4 — Pilot and Validation (Days 11–14)
Goal: Three homes instrumented. Ground-truth validation complete. False-outage rate measured.

See full breakdown in [docs/sprint-tasks.md](docs/sprint-tasks.md).

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Supabase project (free tier works for the pilot)
- Two Tuya-compatible or Sonoff smart plugs per home
- Router powered by inverter or UPS

### Quick Setup

```bash
# Clone this repo
git clone https://github.com/YOUR_ORG/light-tracker.git
cd light-tracker

# Frontend
cd apps/frontend
npm install
cp .env.example .env.local
npm run dev

# Backend
cd apps/backend
pip install -r requirements.txt
cp .env.example .env
python main.py
```

---

## Reference Implementation

The /reference folder contains source files from [odun-lami's public-nepa-tracker](https://github.com/odun-lami/public-nepa-tracker), which this project is inspired by.

**Key differences:**

| Feature | Reference | Light Tracker |
|:---|:---|:---|
| States | ON / OFF | **ON / OFF / UNKNOWN** |
| Data store | Google Sheets | Postgres (Supabase) |
| Sensor setup | Single plug | **Two plugs per home** |
| Multi-home support | No | Yes |
| Confidence indicator | No | Yes |
| Device health alerts | No | Yes |
| User accounts | No | Yes |

---

## MVP Success Criteria

The prototype is successful when:

- [ ] Three households can open the mobile web app and see current power status
- [ ] The system correctly shows UNKNOWN when internet fails (not a fake outage)
- [ ] 48-hour paper-log validation shows a false-outage rate near zero
- [ ] Data coverage percentage is shown alongside availability stats

---

*Built in Nigeria, for Nigeria.*
