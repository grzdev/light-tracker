/**
 * MOCK DATA — matches the API contract exactly (see docs/api-contract.md)
 * Use this while the backend is not ready.
 * Replace imports of this file with real API calls on Day 8.
 *
 * Usage:
 *   import { currentStatus, todaySummary, recentEvents, deviceHealth, weeklyChart } from "./mock-data"
 */

export const currentStatus = {
  homeId: "home_abc123",
  state: "OFF", // "ON" | "OFF" | "UNKNOWN"
  confidence: "HIGH",
  reasonCode: "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
  since: "2026-09-04T11:42:00+01:00",
  durationSeconds: 7320,
  lastUpdated: "2026-09-04T14:00:00+01:00",
  sensors: {
    grid: {
      id: "sensor_a",
      online: false,
      lastSeen: "2026-09-04T11:41:00+01:00",
    },
    backup: {
      id: "sensor_b",
      online: true,
      lastSeen: "2026-09-04T14:00:00+01:00",
    },
  },
};

export const todaySummary = {
  homeId: "home_abc123",
  period: "today",
  date: "2026-09-04",
  gridOnSeconds: 34200,   // 9h 30m
  gridOffSeconds: 25200,  // 7h 00m
  unknownSeconds: 28800,  // 8h 00m
  outageCount: 3,
  longestOutageSeconds: 18000,       // 5h
  avgOutageDurationSeconds: 8400,    // 2h 20m
  availabilityPercent: 57.6,
  coveragePercent: 66.7,
  hourlyBreakdown: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    state: hour < 6 ? "ON" : hour < 11 ? "OFF" : hour < 12 ? "UNKNOWN" : "OFF",
    availabilityPercent:
      hour < 6 ? 100 : hour < 11 ? 0 : hour < 12 ? null : 0,
  })),
};

export const recentEvents = {
  homeId: "home_abc123",
  from: "2026-09-04T00:00:00+01:00",
  to: "2026-09-04T14:00:00+01:00",
  events: [
    {
      id: "evt_001",
      state: "ON",
      reasonCode: "GRID_RESTORED_AFTER_OUTAGE",
      confidence: "HIGH",
      recordedAt: "2026-09-04T00:05:00+01:00",
      durationSeconds: 21900,
    },
    {
      id: "evt_002",
      state: "OFF",
      reasonCode: "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
      confidence: "HIGH",
      recordedAt: "2026-09-04T06:10:00+01:00",
      durationSeconds: 18000,
    },
    {
      id: "evt_003",
      state: "ON",
      reasonCode: "GRID_RESTORED_AFTER_OUTAGE",
      confidence: "HIGH",
      recordedAt: "2026-09-04T11:10:00+01:00",
      durationSeconds: 1920,
    },
    {
      id: "evt_004",
      state: "UNKNOWN",
      reasonCode: "BOTH_SENSORS_OFFLINE",
      confidence: "LOW",
      recordedAt: "2026-09-04T11:42:00+01:00",
      durationSeconds: null,
    },
  ],
};

export const deviceHealth = {
  homeId: "home_abc123",
  sensors: [
    {
      id: "sensor_a",
      role: "GRID",
      deviceId: "tuya_device_xyz",
      online: false,
      lastSeenAt: "2026-09-04T11:41:00+01:00",
      staleSince: "2026-09-04T11:41:00+01:00",
      isStale: true,
      staleThresholdSeconds: 180,
    },
    {
      id: "sensor_b",
      role: "BACKUP",
      deviceId: "tuya_device_abc",
      online: true,
      lastSeenAt: "2026-09-04T14:00:00+01:00",
      staleSince: null,
      isStale: false,
      staleThresholdSeconds: 180,
    },
  ],
};

export const weeklyChart = {
  homeId: "home_abc123",
  days: [
    { date: "2026-08-29", gridOnHours: 9.5, gridOffHours: 7.2, unknownHours: 7.3, availabilityPercent: 57.0, coveragePercent: 69.6 },
    { date: "2026-08-30", gridOnHours: 6.0, gridOffHours: 12.0, unknownHours: 6.0, availabilityPercent: 33.3, coveragePercent: 75.0 },
    { date: "2026-08-31", gridOnHours: 11.5, gridOffHours: 5.0, unknownHours: 7.5, availabilityPercent: 69.7, coveragePercent: 68.8 },
    { date: "2026-09-01", gridOnHours: 4.0, gridOffHours: 14.0, unknownHours: 6.0, availabilityPercent: 22.2, coveragePercent: 75.0 },
    { date: "2026-09-02", gridOnHours: 8.0, gridOffHours: 8.0, unknownHours: 8.0, availabilityPercent: 50.0, coveragePercent: 66.7 },
    { date: "2026-09-03", gridOnHours: 12.0, gridOffHours: 6.0, unknownHours: 6.0, availabilityPercent: 66.7, coveragePercent: 75.0 },
    { date: "2026-09-04", gridOnHours: 9.5, gridOffHours: 7.0, unknownHours: 7.5, availabilityPercent: 57.6, coveragePercent: 69.0 },
  ],
};

// Helper: format duration in seconds as "Xh Ym"
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Helper: format ISO timestamp as "HH:MM AM/PM"
export function formatTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  });
}

// Helper: state label and colour
export const STATE_CONFIG = {
  ON: {
    label: "Grid power is available",
    shortLabel: "ON",
    color: "#22c55e",
    bg: "#052e16",
    icon: "⚡",
  },
  OFF: {
    label: "Grid power appears to be off",
    shortLabel: "OFF",
    color: "#ef4444",
    bg: "#450a0a",
    icon: "🔌",
  },
  UNKNOWN: {
    label: "We cannot confirm grid status. Your tracker or internet may be unavailable.",
    shortLabel: "UNKNOWN",
    color: "#f59e0b",
    bg: "#451a03",
    icon: "❓",
  },
  SETUP_FAULT: {
    label: "Setup issue detected. Check your backup sensor.",
    shortLabel: "FAULT",
    color: "#a855f7",
    bg: "#2e1065",
    icon: "⚠️",
  },
};
