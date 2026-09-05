// Fixed demonstration snapshot. No simulated values are presented as live readings.
// Field names follow docs/api-contract.md. UNKNOWN is excluded from availability.
export type PowerState = 'ON' | 'OFF' | 'UNKNOWN' | 'SETUP_FAULT';
export const snapshot = '2026-09-05T18:00:00+01:00';
export const states = {
  ON: { title: 'There’s light at home.', label: 'Grid is on', description: 'Both sensors are online. Your home is receiving grid power.', grid: true, backup: true, confidence: 'HIGH', reason: 'GRID_SENSOR_REACHABLE' },
  OFF: { title: 'Grid power is off.', label: 'Grid is off', description: 'Your backup sensor is online, so this is a confirmed grid outage.', grid: false, backup: true, confidence: 'HIGH', reason: 'GRID_SENSOR_OFFLINE_BACKUP_ONLINE' },
  UNKNOWN: { title: 'Let’s not guess.', label: 'Status unknown', description: 'Both sensors are unreachable. This may be an internet issue, not a power outage.', grid: false, backup: false, confidence: 'LOW', reason: 'BOTH_SENSORS_OFFLINE' },
  SETUP_FAULT: { title: 'Your setup needs a look.', label: 'Setup fault', description: 'Grid is detected, but your backup sensor is offline. Check its socket and connection.', grid: true, backup: false, confidence: 'MEDIUM', reason: 'BACKUP_SENSOR_OFFLINE_GRID_ONLINE' },
} as const;
export const weeklyChart = { homeId: 'home_abc123', days: [
  { date: '2026-08-30', gridOnHours: 14, gridOffHours: 9, unknownHours: 1 },
  { date: '2026-08-31', gridOnHours: 17, gridOffHours: 6, unknownHours: 1 },
  { date: '2026-09-01', gridOnHours: 11.5, gridOffHours: 11, unknownHours: 1.5 },
  { date: '2026-09-02', gridOnHours: 18, gridOffHours: 5.5, unknownHours: .5 },
  { date: '2026-09-03', gridOnHours: 15, gridOffHours: 8, unknownHours: 1 },
  { date: '2026-09-04', gridOnHours: 16, gridOffHours: 7, unknownHours: 1 },
  { date: '2026-09-05', gridOnHours: 13.5, gridOffHours: 4, unknownHours: .5 },
].map(d => ({ ...d, availabilityPercent: d.gridOnHours / (d.gridOnHours + d.gridOffHours) * 100, coveragePercent: (d.gridOnHours + d.gridOffHours) / (d.gridOnHours + d.gridOffHours + d.unknownHours) * 100 })) };
export const segments = [
  { start: 0, end: 5.5, state: 'ON' }, { start: 5.5, end: 7.5, state: 'OFF' },
  { start: 7.5, end: 10, state: 'ON' }, { start: 10, end: 10.5, state: 'UNKNOWN' },
  { start: 10.5, end: 12, state: 'ON' }, { start: 12, end: 14, state: 'OFF' },
  { start: 14, end: 18, state: 'ON' },
] as const;
export const recentEvents = { homeId: 'home_abc123', from: '2026-09-05T00:00:00+01:00', to: snapshot,
  events: segments.map((s, i) => ({ id: `evt_${i}`, state: s.state, reasonCode: states[s.state].reason,
    confidence: states[s.state].confidence, recordedAt: `2026-09-05T${String(Math.floor(s.start)).padStart(2, '0')}:${s.start % 1 ? '30' : '00'}:00+01:00`, durationSeconds: (s.end - s.start) * 3600 })).reverse() };
export function summary(period: 'today' | 'week') {
  const days = period === 'today' ? weeklyChart.days.slice(-1) : weeklyChart.days;
  const on = days.reduce((a, d) => a + d.gridOnHours, 0), off = days.reduce((a, d) => a + d.gridOffHours, 0), unknown = days.reduce((a, d) => a + d.unknownHours, 0);
  return { homeId: 'home_abc123', period, date: '2026-09-05', gridOnSeconds: on * 3600, gridOffSeconds: off * 3600, unknownSeconds: unknown * 3600, availabilityPercent: 100 * on / (on + off), coveragePercent: 100 * (on + off) / (on + off + unknown) };
}
export function duration(seconds: number) { const h = Math.floor(seconds / 3600), m = Math.round(seconds % 3600 / 60); return `${h ? `${h}h` : ''}${m ? ` ${m}m` : ''}`.trim() || '0m'; }
export function time(iso: string) { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }); }
