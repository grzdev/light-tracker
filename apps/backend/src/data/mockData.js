const HOME_ID = "home_abc123";

const snapshot = "2026-09-11T14:00:00+01:00";

const events = [
  {
    id: "evt_001",
    state: "ON",
    reasonCode: "GRID_RESTORED_AFTER_OUTAGE",
    confidence: "HIGH",
    recordedAt: "2026-09-11T06:00:00+01:00",
    durationSeconds: 7200
  },
  {
    id: "evt_002",
    state: "OFF",
    reasonCode: "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
    confidence: "HIGH",
    recordedAt: "2026-09-11T08:00:00+01:00",
    durationSeconds: 5400
  },
  {
    id: "evt_003",
    state: "UNKNOWN",
    reasonCode: "BOTH_SENSORS_OFFLINE",
    confidence: "LOW",
    recordedAt: "2026-09-11T09:30:00+01:00",
    durationSeconds: 1800
  },
  {
    id: "evt_004",
    state: "ON",
    reasonCode: "GRID_SENSOR_REACHABLE",
    confidence: "HIGH",
    recordedAt: "2026-09-11T10:00:00+01:00",
    durationSeconds: 3600
  },
  {
    id: "evt_005",
    state: "OFF",
    reasonCode: "GRID_SENSOR_OFFLINE_BACKUP_ONLINE",
    confidence: "HIGH",
    recordedAt: "2026-09-11T11:00:00+01:00",
    durationSeconds: 7200
  },
  {
    id: "evt_006",
    state: "ON",
    reasonCode: "GRID_RESTORED_AFTER_OUTAGE",
    confidence: "HIGH",
    recordedAt: "2026-09-11T13:00:00+01:00",
    durationSeconds: null
  }
];

const currentStatus = {
  homeId: HOME_ID,
  state: "ON",
  confidence: "HIGH",
  reasonCode: "GRID_SENSOR_REACHABLE",
  since: "2026-09-11T13:00:00+01:00",
  durationSeconds: 3600,
  lastUpdated: snapshot,
  sensors: {
    grid: {
      id: "sensor_a",
      online: true,
      lastSeen: snapshot
    },
    backup: {
      id: "sensor_b",
      online: true,
      lastSeen: snapshot
    }
  }
};

const dailySummary = {
  homeId: HOME_ID,
  period: "today",
  date: "2026-09-11",
  gridOnSeconds: 32400,
  gridOffSeconds: 14400,
  unknownSeconds: 3600,
  outageCount: 2,
  longestOutageSeconds: 7200,
  avgOutageDurationSeconds: 7200,
  availabilityPercent: 69.23,
  coveragePercent: 92.31,
  hourlyBreakdown: [
    {
      hour: 0,
      state: "ON",
      availabilityPercent: 100
    },
    {
      hour: 1,
      state: "ON",
      availabilityPercent: 100
    },
    {
      hour: 2,
      state: "ON",
      availabilityPercent: 100
    },
    {
      hour: 8,
      state: "OFF",
      availabilityPercent: 0
    },
    {
      hour: 9,
      state: "UNKNOWN",
      availabilityPercent: null
    },
    {
      hour: 10,
      state: "ON",
      availabilityPercent: 100
    },
    {
      hour: 11,
      state: "OFF",
      availabilityPercent: 0
    },
    {
      hour: 13,
      state: "ON",
      availabilityPercent: 100
    }
  ]
};

export {
  HOME_ID,
  snapshot,
  events,
  currentStatus,
  dailySummary
};