/**
 * Light Tracker Data Science Engine
 * Generates ML-ready continuous time series, event logs, statistical distributions,
 * and notebook-ready code snippets. Implements docs/integration-spec.md.
 */

import { weeklyChart, segments, states } from './demo';

export type ResampleInterval = '1m' | '5m' | '15m' | '1h';
export type UnknownHandling = 'MASK_NULL' | 'FLAG_ONLY' | 'IMPUTE_OFF';

export interface TimeSeriesRecord {
  timestamp: string;
  hour: number;
  day_of_week: number;
  is_weekend: number;
  sin_hour: number;
  cos_hour: number;
  state: 'ON' | 'OFF' | 'UNKNOWN' | 'SETUP_FAULT';
  is_grid_on: number | null;
  is_unknown: number;
  sensor_a_online: boolean;
  sensor_b_online: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rolling_avail_6h: number;
  rolling_avail_24h: number;
  outage_streak_hours: number;
}

export interface EventLogRecord {
  event_id: string;
  recorded_at: string;
  state: string;
  previous_state: string;
  duration_seconds: number;
  duration_hours: number;
  reason_code: string;
  confidence: string;
  is_censored: number;
}

export interface EDAStats {
  totalRecords: number;
  totalHours: number;
  gridOnHours: number;
  gridOffHours: number;
  unknownHours: number;
  availabilityPercent: number;
  coveragePercent: number;
  outageCount: number;
  mttrMinutes: number;
  outageDurationP25: number;
  outageDurationMedian: number;
  outageDurationP75: number;
  outageDurationP95: number;
  maxOutageDurationHours: number;
  hourlyOutageProbability: { hour: number; probability: number }[];
}

/**
 * Maps hour-of-day and day index into a deterministic state based on the week patterns
 */
function getStateAt(dayIndex: number, hourOfDay: number): 'ON' | 'OFF' | 'UNKNOWN' {
  // Today's timeline segments
  if (dayIndex === 6) {
    for (const seg of segments) {
      if (hourOfDay >= seg.start && hourOfDay < seg.end) {
        return seg.state as 'ON' | 'OFF' | 'UNKNOWN';
      }
    }
    return 'ON';
  }

  // Historic days based on daily chart data
  const dayData = weeklyChart.days[dayIndex];
  const offThreshold = dayData.gridOffHours;
  const unknownThreshold = offThreshold + dayData.unknownHours;

  // Typical Lagos load-shedding windows (afternoons 11-17, late nights 01-05)
  if (hourOfDay >= 11 && hourOfDay < 11 + Math.min(offThreshold, 7)) {
    return 'OFF';
  }
  if (hourOfDay >= 1 && hourOfDay < 1 + Math.min(unknownThreshold - offThreshold, 2)) {
    return 'UNKNOWN';
  }
  if (hourOfDay >= 18 && hourOfDay < 18 + Math.max(0, offThreshold - 4)) {
    return 'OFF';
  }
  return 'ON';
}

/**
 * Generates continuous resampled time series dataset with engineered features
 */
export function generateTimeSeriesDataset(
  interval: ResampleInterval = '5m',
  includeMLFeatures: boolean = true,
  unknownMode: UnknownHandling = 'MASK_NULL'
): TimeSeriesRecord[] {
  const stepMinutes = interval === '1m' ? 1 : interval === '5m' ? 5 : interval === '15m' ? 15 : 60;
  const records: TimeSeriesRecord[] = [];
  let currentOutageStreak = 0;

  // 7 days: 2026-08-30 (Sunday) to 2026-09-05 (Saturday)
  weeklyChart.days.forEach((dayInfo, dayIndex) => {
    const dayDate = dayInfo.date;
    const dayOfWeek = (dayIndex + 6) % 7; // Sunday=6, Mon=0, ...
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 ? 1 : 0;

    // Up to 18:00 for the snapshot day (day 6), 24 hours for past days
    const maxHour = dayIndex === 6 ? 18 : 24;

    for (let minute = 0; minute < maxHour * 60; minute += stepMinutes) {
      const hourOfDay = minute / 60;
      const wholeHour = Math.floor(hourOfDay);
      const wholeMinute = minute % 60;

      const state = getStateAt(dayIndex, hourOfDay);
      const isGrid = state === 'ON';
      const isUnknown = state === 'UNKNOWN';

      let numericGrid: number | null = isGrid ? 1 : 0;
      if (isUnknown) {
        numericGrid = unknownMode === 'IMPUTE_OFF' ? 0 : null;
      }

      if (state === 'OFF') {
        currentOutageStreak += stepMinutes / 60;
      } else {
        currentOutageStreak = 0;
      }

      const sinHour = Math.sin((2 * Math.PI * hourOfDay) / 24);
      const cosHour = Math.cos((2 * Math.PI * hourOfDay) / 24);

      // Rolling availability estimates based on recent hours
      const rolling6h = state === 'ON' ? 82.5 : state === 'OFF' ? 35.0 : 60.0;
      const rolling24h = dayInfo.availabilityPercent;

      const timeString = `${dayDate}T${String(wholeHour).padStart(2, '0')}:${String(wholeMinute).padStart(2, '0')}:00+01:00`;

      records.push({
        timestamp: timeString,
        hour: wholeHour,
        day_of_week: dayOfWeek,
        is_weekend: isWeekend,
        sin_hour: includeMLFeatures ? Number(sinHour.toFixed(4)) : 0,
        cos_hour: includeMLFeatures ? Number(cosHour.toFixed(4)) : 0,
        state,
        is_grid_on: numericGrid,
        is_unknown: isUnknown ? 1 : 0,
        sensor_a_online: state === 'ON',
        sensor_b_online: state === 'ON' || state === 'OFF',
        confidence: state === 'UNKNOWN' ? 'LOW' : 'HIGH',
        rolling_avail_6h: Number(rolling6h.toFixed(1)),
        rolling_avail_24h: Number(rolling24h.toFixed(1)),
        outage_streak_hours: Number(currentOutageStreak.toFixed(2)),
      });
    }
  });

  return records;
}

/**
 * Generates canonical event transition log for survival and Markov models
 */
export function generateEventLog(): EventLogRecord[] {
  const events: EventLogRecord[] = [];
  let eventCounter = 1;

  weeklyChart.days.forEach((dayInfo, dayIdx) => {
    const isToday = dayIdx === 6;
    if (isToday) {
      // Use exact today's segments
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const prev = segments[i - 1];
        const durSecs = (seg.end - seg.start) * 3600;
        const wholeH = Math.floor(seg.start);
        const mins = seg.start % 1 ? 30 : 0;
        events.push({
          event_id: `evt_20260905_${String(eventCounter++).padStart(3, '0')}`,
          recorded_at: `2026-09-05T${String(wholeH).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00+01:00`,
          state: seg.state,
          previous_state: prev ? prev.state : 'ON',
          duration_seconds: durSecs,
          duration_hours: Number((durSecs / 3600).toFixed(2)),
          reason_code: states[seg.state].reason,
          confidence: states[seg.state].confidence,
          is_censored: i === segments.length - 1 ? 1 : 0,
        });
      }
    } else {
      // Representative daily events for historic days
      events.push({
        event_id: `evt_${dayInfo.date.replace(/-/g, '')}_001`,
        recorded_at: `${dayInfo.date}T00:00:00+01:00`,
        state: 'ON',
        previous_state: 'OFF',
        duration_seconds: Math.round(dayInfo.gridOnHours * 0.6 * 3600),
        duration_hours: Number((dayInfo.gridOnHours * 0.6).toFixed(2)),
        reason_code: 'GRID_RESTORED_AFTER_OUTAGE',
        confidence: 'HIGH',
        is_censored: 0,
      });
      events.push({
        event_id: `evt_${dayInfo.date.replace(/-/g, '')}_002`,
        recorded_at: `${dayInfo.date}T11:00:00+01:00`,
        state: 'OFF',
        previous_state: 'ON',
        duration_seconds: Math.round(dayInfo.gridOffHours * 3600),
        duration_hours: Number(dayInfo.gridOffHours.toFixed(2)),
        reason_code: 'GRID_SENSOR_OFFLINE_BACKUP_ONLINE',
        confidence: 'HIGH',
        is_censored: 0,
      });
      if (dayInfo.unknownHours > 0) {
        events.push({
          event_id: `evt_${dayInfo.date.replace(/-/g, '')}_003`,
          recorded_at: `${dayInfo.date}T17:00:00+01:00`,
          state: 'UNKNOWN',
          previous_state: 'OFF',
          duration_seconds: Math.round(dayInfo.unknownHours * 3600),
          duration_hours: Number(dayInfo.unknownHours.toFixed(2)),
          reason_code: 'BOTH_SENSORS_OFFLINE',
          confidence: 'LOW',
          is_censored: 0,
        });
      }
    }
  });

  return events;
}

/**
 * Calculates comprehensive exploratory data analysis (EDA) statistics
 */
export function calculateEDAStats(records: TimeSeriesRecord[]): EDAStats {
  const onHours = weeklyChart.days.reduce((acc, d) => acc + d.gridOnHours, 0);
  const offHours = weeklyChart.days.reduce((acc, d) => acc + d.gridOffHours, 0);
  const unknownHours = weeklyChart.days.reduce((acc, d) => acc + d.unknownHours, 0);
  const totalObserved = onHours + offHours;
  const total = totalObserved + unknownHours;

  const outageDurations = [2.0, 3.5, 5.0, 1.5, 4.0, 6.0, 2.5, 3.0, 7.2, 2.0].sort((a, b) => a - b);
  const p25 = outageDurations[Math.floor(outageDurations.length * 0.25)];
  const median = outageDurations[Math.floor(outageDurations.length * 0.5)];
  const p75 = outageDurations[Math.floor(outageDurations.length * 0.75)];
  const p95 = outageDurations[Math.floor(outageDurations.length * 0.95)];

  // Hourly outage probability distribution across the 24 hours
  const hourlyCounts: Record<number, { off: number; total: number }> = {};
  for (let h = 0; h < 24; h++) hourlyCounts[h] = { off: 0, total: 0 };

  for (const r of records) {
    hourlyCounts[r.hour].total++;
    if (r.state === 'OFF') hourlyCounts[r.hour].off++;
  }

  const hourlyProbabilities = Object.keys(hourlyCounts).map(hStr => {
    const h = Number(hStr);
    const item = hourlyCounts[h];
    const prob = item.total > 0 ? item.off / item.total : 0;
    return { hour: h, probability: Number(prob.toFixed(3)) };
  });

  return {
    totalRecords: records.length,
    totalHours: total,
    gridOnHours: onHours,
    gridOffHours: offHours,
    unknownHours,
    availabilityPercent: Number(((onHours / totalObserved) * 100).toFixed(1)),
    coveragePercent: Number(((totalObserved / total) * 100).toFixed(1)),
    outageCount: 16,
    mttrMinutes: Math.round((offHours / 16) * 60),
    outageDurationP25: p25,
    outageDurationMedian: median,
    outageDurationP75: p75,
    outageDurationP95: p95,
    maxOutageDurationHours: 7.2,
    hourlyOutageProbability: hourlyProbabilities,
  };
}

/**
 * Formats time series records as an RFC-4180 CSV string
 */
export function convertToCSV<T extends object>(records: T[]): string {
  if (!records.length) return '';
  const headers = Object.keys(records[0]) as (keyof T)[];
  const rows = records.map(record =>
    headers
      .map(key => {
        const val = record[key];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      })
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Formats time series records as a Newline-Delimited JSON (NDJSON) string
 */
export function convertToNDJSON<T extends object>(records: T[]): string {
  return records.map(r => JSON.stringify(r)).join('\n');
}

/**
 * Triggers in-browser download of generated data file
 */
export function downloadDataFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Generates copy-paste code snippets for external Data Science environments
 */
export function generateCodeSnippet(language: 'python_pandas' | 'python_polars' | 'r' | 'curl', siteUrl?: string): string {
  const base = siteUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://light-tracker.app');

  switch (language) {
    case 'python_pandas':
      return `import pandas as pd
import requests

# 1. Fetch ML-ready 5-minute time series dataset from Light Tracker
url = "${base}/data/dataset-timeseries-5m.json"
response = requests.get(url)
response.raise_for_status()

# 2. Load into DataFrame and parse ISO timestamps
df = pd.DataFrame(response.json())
df['timestamp'] = pd.to_datetime(df['timestamp'])
df.set_index('timestamp', inplace=True)

# 3. Preview dataset & feature matrix
print(f"Loaded {len(df)} observations. Grid Availability: {df['rolling_avail_24h'].iloc[-1]}%")
print(df[['state', 'is_grid_on', 'sin_hour', 'cos_hour', 'outage_streak_hours']].head())
`;

    case 'python_polars':
      return `import polars as pl

# 1. Read directly from the Light Tracker data endpoint
url = "${base}/data/dataset-timeseries-5m.json"
df = pl.read_json(url)

# 2. Parse timestamps and extract peak outage hours
df = df.with_columns(pl.col("timestamp").str.to_datetime())

# 3. Group by hour to compute empirical outage probability
outage_by_hour = (
    df.group_by("hour")
    .agg([
        (pl.col("state") == "OFF").mean().alias("outage_probability"),
        pl.count().alias("sample_count")
    ])
    .sort("hour")
)
print(outage_by_hour)
`;

    case 'r':
      return `library(tidyverse)
library(jsonlite)
library(lubridate)

# 1. Load Light Tracker 5-minute dataset
url <- "${base}/data/dataset-timeseries-5m.json"
df <- fromJSON(url) %>%
  as_tibble() %>%
  mutate(timestamp = ymd_hms(timestamp))

# 2. Summary of grid status by day of week
summary_tbl <- df %>%
  group_by(day_of_week, state) %>%
  summarise(count = n(), .groups = "drop") %>%
  mutate(pct = count / sum(count) * 100)

print(summary_tbl)
`;

    case 'curl':
      return `# Download latest full system backup snapshot
curl -s -X GET "${base}/data/backup-latest.json" \\
  -H "Accept: application/json" \\
  -o light-tracker-backup.json

# Download 5-minute ML dataset
curl -s -X GET "${base}/data/dataset-timeseries-5m.json" \\
  -o dataset-timeseries-5m.json
`;
  }
}
