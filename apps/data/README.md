# Data — Analytics, State Machine & Validation

Owner: Data Scientist

## Stack
- Python 3.11+
- pandas / polars for analysis
- SQL (Postgres queries via Supabase)

## Folder Structure

```
apps/data/
├── README.md
├── requirements.txt
├── state_machine/
│   ├── decision_engine.py   # The two-sensor ON/OFF/UNKNOWN logic
│   ├── debounce.py          # Anti-flap: ignore transitions < 3 min
│   └── session_grouper.py   # Convert raw_observations -> grid_events
├── metrics/
│   ├── availability.py      # Availability % and Coverage % formulas
│   ├── summaries.py         # Daily, weekly, monthly aggregations
│   └── profiles.py          # Hour-of-day patterns, best/worst days
├── validation/
│   ├── compare.py           # Compare paper log vs database events
│   ├── paper_log_template.csv
│   └── accuracy_report.py   # Generate validation summary
└── notebooks/
    └── simulation.ipynb     # 48h simulated data for testing logic
```

## Day-by-Day Build Guide

| Day | Task |
|:---:|:---|
| 1 | Define state machine rules, debounce threshold, Coverage formula |
| 2 | Model edge cases in spreadsheet |
| 3 | Sign off on event-spec.md with team |
| 4 | Write session_grouper.py with unit tests |
| 5 | Write availability.py and coverage formula |
| 6 | Write summaries.py (daily/weekly/hourly) |
| 7 | Peer review backend decision engine, validate test cases |
| 8 | Watch live data from first home, check for anomalies |
| 9 | Tune debounce if needed |
| 10 | Preliminary accuracy report for Home 1 |
| 11–14 | Full paper-log validation, final accuracy report |

## Core Formulas

```python
def availability_percent(on_seconds: float, observed_seconds: float) -> float:
    """What % of observed time was grid available?"""
    if observed_seconds == 0:
        return None
    return (on_seconds / observed_seconds) * 100

def coverage_percent(observed_seconds: float, total_seconds: float) -> float:
    """What % of total time could we actually observe?"""
    if total_seconds == 0:
        return None
    return (observed_seconds / total_seconds) * 100

# Where:
# on_seconds      = sum of grid_events WHERE state = 'ON'
# observed_seconds = total_seconds - unknown_seconds
# unknown_seconds  = sum of grid_events WHERE state = 'UNKNOWN'
# total_seconds    = end of period - start of period
```

## Debounce Rule

A new state is only committed if it persists for >= 3 consecutive polls (3 minutes at 60s interval).

```python
DEBOUNCE_POLLS = 3  # number of consecutive polls required

def should_commit_transition(poll_history: list[str], new_state: str) -> bool:
    """
    poll_history: last N poll results for this sensor pair
    Returns True only if the last DEBOUNCE_POLLS results are all new_state
    """
    if len(poll_history) < DEBOUNCE_POLLS:
        return False
    return all(s == new_state for s in poll_history[-DEBOUNCE_POLLS:])
```

## Session Grouper

Converts a stream of raw_observations into confirmed grid_events.

Input:
```
timestamp, sensor_a_online, sensor_b_online
2026-09-04T08:00, True, True    -> ON
2026-09-04T08:01, True, True    -> ON (same state, no event)
2026-09-04T08:02, False, True   -> potential OFF (1/3 polls)
2026-09-04T08:03, False, True   -> potential OFF (2/3 polls)
2026-09-04T08:04, False, True   -> COMMIT OFF (3/3 polls — debounce passed)
```

Output event:
```json
{ "state": "OFF", "recordedAt": "2026-09-04T08:02", "reasonCode": "GRID_SENSOR_OFFLINE_BACKUP_ONLINE" }
```

Note: `recordedAt` is the timestamp of the FIRST poll showing the new state, not the commit time.
