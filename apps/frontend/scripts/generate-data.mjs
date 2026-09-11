import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const outputDir = path.resolve('apps/frontend/public/data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Daily stats
const days = [
  { date: '2026-08-30', gridOnHours: 14, gridOffHours: 9, unknownHours: 1 },
  { date: '2026-08-31', gridOnHours: 17, gridOffHours: 6, unknownHours: 1 },
  { date: '2026-09-01', gridOnHours: 11.5, gridOffHours: 11, unknownHours: 1.5 },
  { date: '2026-09-02', gridOnHours: 18, gridOffHours: 5.5, unknownHours: 0.5 },
  { date: '2026-09-03', gridOnHours: 15, gridOffHours: 8, unknownHours: 1 },
  { date: '2026-09-04', gridOnHours: 16, gridOffHours: 7, unknownHours: 1 },
  { date: '2026-09-05', gridOnHours: 13.5, gridOffHours: 4, unknownHours: 0.5 },
].map((d, i) => {
  const onSec = d.gridOnHours * 3600;
  const offSec = d.gridOffHours * 3600;
  const unkSec = d.unknownHours * 3600;
  return {
    date: d.date,
    gridOnHours: d.gridOnHours,
    gridOffHours: d.gridOffHours,
    unknownHours: d.unknownHours,
    availabilityPercent: Number(((onSec / (onSec + offSec)) * 100).toFixed(1)),
    coveragePercent: Number((((onSec + offSec) / (onSec + offSec + unkSec)) * 100).toFixed(1)),
    outageCount: i % 2 === 0 ? 3 : 2,
    longestOutageSeconds: i === 6 ? 7200 : Math.round(offSec / 2),
  };
});

fs.writeFileSync(path.join(outputDir, 'dataset-daily.json'), JSON.stringify(days, null, 2));

// Events
const events = [
  {
    event_id: 'evt_20260905_007',
    recorded_at: '2026-09-05T14:00:00+01:00',
    state: 'ON',
    previous_state: 'OFF',
    duration_seconds: 14400,
    duration_hours: 4.0,
    reason_code: 'GRID_RESTORED_AFTER_OUTAGE',
    confidence: 'HIGH',
    is_censored: 1,
  },
  {
    event_id: 'evt_20260905_006',
    recorded_at: '2026-09-05T12:00:00+01:00',
    state: 'OFF',
    previous_state: 'ON',
    duration_seconds: 7200,
    duration_hours: 2.0,
    reason_code: 'GRID_SENSOR_OFFLINE_BACKUP_ONLINE',
    confidence: 'HIGH',
    is_censored: 0,
  },
  {
    event_id: 'evt_20260905_005',
    recorded_at: '2026-09-05T10:30:00+01:00',
    state: 'ON',
    previous_state: 'UNKNOWN',
    duration_seconds: 5400,
    duration_hours: 1.5,
    reason_code: 'GRID_RESTORED_AFTER_UNKNOWN',
    confidence: 'HIGH',
    is_censored: 0,
  },
  {
    event_id: 'evt_20260905_004',
    recorded_at: '2026-09-05T10:00:00+01:00',
    state: 'UNKNOWN',
    previous_state: 'ON',
    duration_seconds: 1800,
    duration_hours: 0.5,
    reason_code: 'BOTH_SENSORS_OFFLINE',
    confidence: 'LOW',
    is_censored: 0,
  },
  {
    event_id: 'evt_20260905_003',
    recorded_at: '2026-09-05T07:30:00+01:00',
    state: 'ON',
    previous_state: 'OFF',
    duration_seconds: 9000,
    duration_hours: 2.5,
    reason_code: 'GRID_RESTORED_AFTER_OUTAGE',
    confidence: 'HIGH',
    is_censored: 0,
  },
  {
    event_id: 'evt_20260905_002',
    recorded_at: '2026-09-05T05:30:00+01:00',
    state: 'OFF',
    previous_state: 'ON',
    duration_seconds: 7200,
    duration_hours: 2.0,
    reason_code: 'GRID_SENSOR_OFFLINE_BACKUP_ONLINE',
    confidence: 'HIGH',
    is_censored: 0,
  },
  {
    event_id: 'evt_20260905_001',
    recorded_at: '2026-09-05T00:00:00+01:00',
    state: 'ON',
    previous_state: 'OFF',
    duration_seconds: 19800,
    duration_hours: 5.5,
    reason_code: 'GRID_RESTORED_AFTER_OUTAGE',
    confidence: 'HIGH',
    is_censored: 0,
  },
];

fs.writeFileSync(path.join(outputDir, 'dataset-events.json'), JSON.stringify(events, null, 2));

// 5-minute continuous dataset
const timeseries = [];
const todaySegments = [
  { start: 0, end: 5.5, state: 'ON' },
  { start: 5.5, end: 7.5, state: 'OFF' },
  { start: 7.5, end: 10, state: 'ON' },
  { start: 10, end: 10.5, state: 'UNKNOWN' },
  { start: 10.5, end: 12, state: 'ON' },
  { start: 12, end: 14, state: 'OFF' },
  { start: 14, end: 18, state: 'ON' },
];

function getSampleState(dayIdx, h) {
  if (dayIdx === 6) {
    for (const s of todaySegments) {
      if (h >= s.start && h < s.end) return s.state;
    }
    return 'ON';
  }
  if (h >= 12 && h < 18) return 'OFF';
  if (h >= 2 && h < 3) return 'UNKNOWN';
  return 'ON';
}

days.forEach((d, dayIdx) => {
  const maxH = dayIdx === 6 ? 18 : 24;
  let streak = 0;
  for (let m = 0; m < maxH * 60; m += 5) {
    const hOfDay = m / 60;
    const wholeH = Math.floor(hOfDay);
    const wholeM = m % 60;
    const state = getSampleState(dayIdx, hOfDay);
    if (state === 'OFF') streak += 5 / 60;
    else streak = 0;

    const isGrid = state === 'ON';
    const isUnk = state === 'UNKNOWN';
    const sinH = Math.sin((2 * Math.PI * hOfDay) / 24);
    const cosH = Math.cos((2 * Math.PI * hOfDay) / 24);

    timeseries.push({
      timestamp: `${d.date}T${String(wholeH).padStart(2, '0')}:${String(wholeM).padStart(2, '0')}:00+01:00`,
      hour: wholeH,
      day_of_week: (dayIdx + 6) % 7,
      is_weekend: dayIdx === 0 || dayIdx === 6 ? 1 : 0,
      sin_hour: Number(sinH.toFixed(4)),
      cos_hour: Number(cosH.toFixed(4)),
      state,
      is_grid_on: isGrid ? 1 : isUnk ? null : 0,
      is_unknown: isUnk ? 1 : 0,
      sensor_a_online: state === 'ON',
      sensor_b_online: state === 'ON' || state === 'OFF',
      confidence: isUnk ? 'LOW' : 'HIGH',
      rolling_avail_6h: state === 'ON' ? 82.5 : 35.0,
      rolling_avail_24h: d.availabilityPercent,
      outage_streak_hours: Number(streak.toFixed(2)),
    });
  }
});

fs.writeFileSync(path.join(outputDir, 'dataset-timeseries-5m.json'), JSON.stringify(timeseries, null, 2));

// Latest full backup snapshot
const backupDraft = {
  $schema: 'https://light-tracker.app/schemas/backup-v1.json',
  version: '1.0.0',
  exportedAt: '2026-09-05T18:00:00+01:00',
  generator: 'light-tracker-web/0.1.0',
  home: {
    id: 'home_abc123',
    name: 'Alex D. Home',
    location: 'Yaba, Lagos, Nigeria',
    timezone: 'Africa/Lagos',
    createdAt: '2026-08-20T00:00:00+01:00',
  },
  sensors: [
    {
      id: 'sensor_a',
      role: 'GRID',
      name: 'Grid Sensor (Main Inflow)',
      deviceId: 'tuya_device_xyz',
      online: true,
      lastSeenAt: '2026-09-05T18:00:00+01:00',
    },
    {
      id: 'sensor_b',
      role: 'BACKUP',
      name: 'Inverter Sensor (Router Backup)',
      deviceId: 'tuya_device_abc',
      online: true,
      lastSeenAt: '2026-09-05T18:00:00+01:00',
    },
  ],
  rawObservations: timeseries.slice(-72).map(r => ({
    timestamp: r.timestamp,
    sensorAOnline: r.sensor_a_online,
    sensorBOnline: r.sensor_b_online,
    state: r.state,
    reasonCode: r.state === 'ON' ? 'GRID_SENSOR_REACHABLE' : r.state === 'OFF' ? 'GRID_SENSOR_OFFLINE_BACKUP_ONLINE' : 'BOTH_SENSORS_OFFLINE',
  })),
  gridEvents: events.map(e => ({
    id: e.event_id,
    recordedAt: e.recorded_at,
    state: e.state,
    previousState: e.previous_state,
    reasonCode: e.reason_code,
    confidence: e.confidence,
    durationSeconds: e.duration_seconds,
  })),
  dailySummaries: days,
  integrationsConfig: {
    autoBackupEnabled: true,
    cadence: 'DAILY',
    webhookUrl: '',
    lastBackupAt: '2026-09-05T02:00:00+01:00',
  },
};

const canonicalStr = JSON.stringify(backupDraft, Object.keys(backupDraft).sort());
const checksumSha256 = crypto.createHash('sha256').update(canonicalStr).digest('hex');

const fullBackup = {
  ...backupDraft,
  checksumSha256,
};

fs.writeFileSync(path.join(outputDir, 'backup-latest.json'), JSON.stringify(fullBackup, null, 2));

console.log('Successfully generated public dataset endpoints in apps/frontend/public/data/');
