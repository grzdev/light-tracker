# Light Tracker frontend

A responsive Next.js App Router prototype for the two-sensor Nigerian grid monitor. React, TypeScript, vanilla CSS, Lucide icons, and accessible CSS charts. No API, database, or credentials needed.

## Run locally

Requires Node.js 22+.

```bash
cd apps/frontend
npm ci
npm run dev
```

Open http://localhost:3000. `npm run build` creates the static site in `out/`. `npm run typecheck` checks TypeScript. Serve `out/` with a static host; `next start` does not support static export.

## Deploy on Netlify

Import this repository. Root `netlify.toml` configures:

- Base directory: `apps/frontend`
- Build command: `npm run build`
- Publish directory: `out` (relative to base)
- Node.js: 22

No environment variables or server adapter needed. Alternatively, build locally and drag the **out folder** into Netlify's manual deploy interface.

## Interactive prototype

- Overview, Power history, Insights, and Devices views.
- Today / This week summaries and selectable weekly bars.
- Tap timeline segments for state and duration details.
- Filter history by ON, OFF, or UNKNOWN.
- Export a seven-day CSV with availability and coverage.
- Preview ON, OFF, UNKNOWN, and SETUP_FAULT; sensor health follows.
- Settings save home name and alert preference locally. Actual alert delivery is not implemented.
- Help and notification dialogs with Escape and native focus trapping.
- Mobile drawer, keyboard focus states, and reduced-motion support.

## Data and backend handoff

`lib/demo.ts` is the prototype data source. It uses a fixed snapshot at **5 September 2026, 18:00 WAT**, not live readings. Today has 13.5 hours ON, 4 hours OFF, and 0.5 hours UNKNOWN: 18 elapsed hours. Future hours remain blank. Availability is ON / (ON + OFF); coverage is (ON + OFF) / elapsed time. Weekly figures are weighted by duration.

Scenario buttons change only the current-state preview and sensors. History and exports remain at the fixed snapshot. Original `mock-data.js` is retained but not imported because its sample totals and events disagree.

Integration points, following `docs/api-contract.md`:

| Endpoint | Replace |
| --- | --- |
| `/homes/:homeId/current-status` | `power` and scenario sensor state in Dashboard |
| `/homes/:homeId/summary` | `summary(period)` |
| `/homes/:homeId/events` | `recentEvents` and timeline segments |
| `/homes/:homeId/weekly-chart` | `weeklyChart` |
| `/homes/:homeId/device-health` | sensor rows in `health()` |

Add an authenticated API client, real home selection, loading/error/empty states, and stale-data handling before calling this a live tracker. Credentials must come from authentication, never committed files. Respect server confidence and SETUP_FAULT. Replace frozen dates and demo labels only after connecting the API.

`app/globals.css` holds the design system and breakpoints; `components/Dashboard.tsx` holds the interactive prototype. Google Fonts supplies DM Sans and Manrope with sans-serif fallbacks. Reference files are unchanged.
