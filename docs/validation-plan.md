# Validation Plan — Ground Truth Test

> The entire credibility of the prototype rests on this.
> Owned by: Data Scientist
> Runs: Days 11–14

---

## Goal

Prove that the app accurately distinguishes between:
1. A real grid outage (Sensor A offline, Sensor B online)
2. An internet failure (both sensors offline)
3. Normal grid-on periods

Target: **Zero false outages recorded during the validation period.**

---

## Paper Log Template

Give this to each pilot household. Ask them to fill it in for 48 hours.

```
HOME: _______________
DATE START: _______________
Filled by: _______________

| Time | Event | How confirmed? | Router still on? |
|:-----|:------|:---------------|:----------------|
|      | Grid OFF / Grid ON / Not sure | Lights went off / Inverter kicked in / App showed | Yes / No / Don't know |
```

Print one sheet per household or send as a Google Form.

---

## Comparison Method

After 48 hours, the data scientist downloads the raw events from the database for each home and compares against the paper log.

For each paper-log entry, classify the app response as:

| App classification | Paper log says | Verdict |
|:---|:---|:---|
| OFF | Grid went off | ✅ Correct |
| ON | Grid came on | ✅ Correct |
| UNKNOWN | Router went offline | ✅ Correct |
| OFF | Both sensors went offline (internet died) | ❌ False outage |
| ON | Grid was off | ❌ Missed outage |
| UNKNOWN | Grid went off (but router stayed on) | ❌ Misclassified |

---

## Accuracy Metrics to Report

For each home:

```
Total observed period: X hours
Paper-log events: Y events

Confirmed outages (correctly captured): A
Missed outages: B
False outages (UNKNOWN period shown as OFF): C
Correct UNKNOWN periods: D
Coverage percentage: E%
```

Overall:
```
Precision = A / (A + C)
Recall = A / (A + B)
False outage rate = C / total logged outage events
```

---

## Acceptable Thresholds for MVP

| Metric | Target |
|:---|:---|
| False outage rate | 0% (every false OFF is a trust failure) |
| Recall (missed real outages) | > 90% |
| Coverage | > 60% of each day clearly observed |

If false outage rate is above 0%, stop expansion. Fix the two-sensor logic first.

---

## Reporting

After validation, the data scientist publishes a one-page report containing:
- Summary table per home
- Any patterns in errors (time of day, internet provider, etc.)
- Recommendation: ready to expand, or needs hardware/logic fixes

This report becomes the basis for all further pilot expansion decisions.
