# Frontend — Light Tracker Dashboard

Mobile-first web dashboard built with Next.js.

## Owner
Frontend / Product Lead

## Stack
- Next.js (App Router)
- Vanilla CSS
- Inter font (Google Fonts)
- Chart.js for bar charts

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_HOME_ID=home_abc123
```

## Folder Structure

```
apps/frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home dashboard
│   ├── layout.tsx          # Root layout with font/meta
│   └── globals.css         # Global styles and design tokens
├── components/
│   ├── StatusCard/         # The main ON/OFF/UNKNOWN card
│   ├── MetricsRow/         # Grid hours, outage hours, count
│   ├── EventTimeline/      # Today's event log
│   ├── WeeklyChart/        # 7-day bar chart
│   ├── TrackerHealth/      # Sensor A and B status
│   └── CoverageIndicator/  # Data confidence badge
├── lib/
│   ├── api.ts              # Real API calls (replace mock-data.js on Day 8)
│   ├── formatters.ts       # Duration, time, date formatting
│   └── constants.ts        # STATE_CONFIG, color tokens
└── mock-data.js            # Mock data matching API contract
```

## Day-by-Day Build Guide

| Day | Task |
|:---:|:---|
| 4 | Init app, build StatusCard with mock data |
| 5 | Build MetricsRow and CoverageIndicator |
| 6 | Build EventTimeline and WeeklyChart |
| 7 | Build TrackerHealth, empty/loading/error states |
| 8 | Wire to live API, install hardware in your home |
| 9 | Add auto-refresh, timezone handling, last-updated |
| 10 | Edge-case testing, error message copy |
| 11–14 | Pilot feedback, UI polish |

## Design Tokens

```css
--color-on: #22c55e;
--color-off: #ef4444;
--color-unknown: #f59e0b;
--color-bg: #0a0a0a;
--color-surface: #141414;
--color-border: #2a2a2a;
--color-text: #f5f5f5;
--color-text-muted: #888;
```
