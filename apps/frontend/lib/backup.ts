/**
 * Light Tracker Backup & Disaster Recovery Engine
 * Implements canonical specification docs/integration-spec.md
 */

import { recentEvents, segments, states, weeklyChart } from './demo';

export interface BackupHome {
  id: string;
  name: string;
  location: string;
  timezone: string;
  createdAt: string;
}

export interface BackupSensor {
  id: string;
  role: 'GRID' | 'BACKUP';
  name: string;
  deviceId: string;
  online: boolean;
  lastSeenAt: string;
}

export interface BackupRawObservation {
  timestamp: string;
  sensorAOnline: boolean;
  sensorBOnline: boolean;
  state: 'ON' | 'OFF' | 'UNKNOWN' | 'SETUP_FAULT';
  reasonCode: string;
}

export interface BackupGridEvent {
  id: string;
  recordedAt: string;
  state: 'ON' | 'OFF' | 'UNKNOWN' | 'SETUP_FAULT';
  previousState?: string;
  reasonCode: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  durationSeconds: number | null;
}

export interface BackupDailySummary {
  date: string;
  gridOnHours: number;
  gridOffHours: number;
  unknownHours: number;
  availabilityPercent: number;
  coveragePercent: number;
  outageCount: number;
  longestOutageSeconds: number;
}

export interface BackupIntegrationsConfig {
  autoBackupEnabled: boolean;
  cadence: 'DAILY' | 'WEEKLY' | 'MANUAL';
  webhookUrl: string;
  secretToken?: string;
  lastBackupAt?: string;
}

export interface LightTrackerBackup {
  $schema?: string;
  version: string;
  exportedAt: string;
  checksumSha256: string;
  generator: string;
  home: BackupHome;
  sensors: BackupSensor[];
  rawObservations: BackupRawObservation[];
  gridEvents: BackupGridEvent[];
  dailySummaries: BackupDailySummary[];
  integrationsConfig: BackupIntegrationsConfig;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: 'SNAPSHOT_EXPORT' | 'RESTORE_IMPORTED' | 'WEBHOOK_DISPATCH';
  status: 'SUCCESS' | 'FAILED';
  details: string;
  checksum?: string;
}

const AUDIT_LOG_KEY = 'lt-backup-audit-log';
const CONFIG_KEY = 'lt-backup-config';

/**
 * Calculates SHA-256 hash using the Web Crypto API
 */
export async function calculateSha256(str: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const msgUint8 = new TextEncoder().encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Web Crypto SHA-256 unavailable, falling back to simple hash', e);
  }
  // Simple fallback hash for SSR or environments without Web Crypto
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Loads current integrations configuration from local storage
 */
export function getStoredBackupConfig(): BackupIntegrationsConfig {
  const defaultConfig: BackupIntegrationsConfig = {
    autoBackupEnabled: true,
    cadence: 'DAILY',
    webhookUrl: '',
    secretToken: '',
    lastBackupAt: '2026-09-05T02:00:00+01:00',
  };
  if (typeof window === 'undefined') return defaultConfig;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig;
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return defaultConfig;
  }
}

/**
 * Saves integrations configuration to local storage
 */
export function saveBackupConfig(config: BackupIntegrationsConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save backup config', e);
  }
}

/**
 * Generates synthetic raw observations for demo continuity (60-second polls)
 */
function generateRawObservations(): BackupRawObservation[] {
  const observations: BackupRawObservation[] = [];
  const baseDate = '2026-09-05';
  
  // Sample every 15 minutes across the 18 active hours today
  for (const seg of segments) {
    const startMins = Math.floor(seg.start * 60);
    const endMins = Math.floor(seg.end * 60);
    for (let m = startMins; m < endMins; m += 15) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${baseDate}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+01:00`;
      const sensorA = seg.state === 'ON';
      const sensorB = seg.state === 'ON' || seg.state === 'OFF';
      observations.push({
        timestamp: timeStr,
        sensorAOnline: sensorA,
        sensorBOnline: sensorB,
        state: seg.state,
        reasonCode: states[seg.state].reason,
      });
    }
  }
  return observations;
}

/**
 * Generates a full system backup snapshot matching specs
 */
export async function generateBackupSnapshot(customHomeName?: string): Promise<LightTrackerBackup> {
  const homeName = customHomeName || (typeof window !== 'undefined' ? localStorage.getItem('lt-home') : null) || 'Alex D. Home';
  const config = getStoredBackupConfig();
  const rawObservations = generateRawObservations();

  const baseEvents: BackupGridEvent[] = recentEvents.events.map((e, index) => {
    const prev = recentEvents.events[index + 1];
    return {
      id: e.id,
      recordedAt: e.recordedAt,
      state: e.state,
      previousState: prev ? prev.state : 'ON',
      reasonCode: e.reasonCode,
      confidence: e.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
      durationSeconds: e.durationSeconds,
    };
  });

  const dailySummaries: BackupDailySummary[] = weeklyChart.days.map((d, index) => ({
    date: d.date,
    gridOnHours: d.gridOnHours,
    gridOffHours: d.gridOffHours,
    unknownHours: d.unknownHours,
    availabilityPercent: Number(d.availabilityPercent.toFixed(1)),
    coveragePercent: Number(d.coveragePercent.toFixed(1)),
    outageCount: index % 2 === 0 ? 3 : 2,
    longestOutageSeconds: index === 6 ? 7200 : Math.round((d.gridOffHours * 3600) / 2),
  }));

  const draft: Omit<LightTrackerBackup, 'checksumSha256'> = {
    $schema: 'https://light-tracker.app/schemas/backup-v1.json',
    version: '1.0.0',
    exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '+01:00'),
    generator: 'light-tracker-web/0.1.0',
    home: {
      id: 'home_abc123',
      name: homeName,
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
    rawObservations,
    gridEvents: baseEvents,
    dailySummaries,
    integrationsConfig: config,
  };

  const canonicalString = JSON.stringify(draft, Object.keys(draft).sort());
  const checksumSha256 = await calculateSha256(canonicalString);

  return {
    ...draft,
    checksumSha256,
  };
}

/**
 * Validates an uploaded or received backup JSON payload
 */
export async function validateBackupSnapshot(jsonContent: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  backup?: LightTrackerBackup;
  checksumVerified: boolean;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonContent);
  } catch (err) {
    return {
      valid: false,
      errors: ['File is not valid JSON: ' + (err instanceof Error ? err.message : String(err))],
      warnings: [],
      checksumVerified: false,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Snapshot payload must be a JSON object.'], warnings: [], checksumVerified: false };
  }

  const payload = parsed as Partial<LightTrackerBackup>;

  if (!payload.version) {
    errors.push("Missing required field 'version'.");
  } else if (!payload.version.startsWith('1.')) {
    warnings.push(`Snapshot version (${payload.version}) differs from current version (1.0.0). Migration logic may apply.`);
  }

  if (!payload.home?.id) errors.push("Missing 'home.id'.");
  if (!Array.isArray(payload.sensors) || payload.sensors.length === 0) {
    errors.push("Missing or empty 'sensors' array.");
  }
  if (!Array.isArray(payload.gridEvents)) {
    errors.push("Missing 'gridEvents' array.");
  }
  if (!Array.isArray(payload.dailySummaries)) {
    errors.push("Missing 'dailySummaries' array.");
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, checksumVerified: false };
  }

  // Checksum verification
  const claimedChecksum = payload.checksumSha256;
  let checksumVerified = false;

  if (claimedChecksum) {
    const copy = { ...payload };
    delete copy.checksumSha256;
    const canonicalString = JSON.stringify(copy, Object.keys(copy).sort());
    const recomputed = await calculateSha256(canonicalString);
    if (recomputed.toLowerCase() === claimedChecksum.toLowerCase()) {
      checksumVerified = true;
    } else {
      warnings.push(`SHA-256 checksum mismatch (claimed: ${claimedChecksum.slice(0, 8)}..., calculated: ${recomputed.slice(0, 8)}...). The file may have been modified.`);
    }
  } else {
    warnings.push("Snapshot did not provide a 'checksumSha256' integrity hash.");
  }

  return {
    valid: true,
    errors: [],
    warnings,
    backup: payload as LightTrackerBackup,
    checksumVerified,
  };
}

/**
 * Downloads a backup snapshot JSON file to the user's computer
 */
export function downloadBackupFile(backup: LightTrackerBackup, filename?: string): void {
  const jsonStr = JSON.stringify(backup, null, 2);
  const dateStr = backup.exportedAt.slice(0, 10);
  const actualFilename = filename || `light-tracker-backup-${backup.home.id}-${dateStr}.json`;

  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = actualFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  recordAuditLog({
    type: 'SNAPSHOT_EXPORT',
    status: 'SUCCESS',
    details: `Full snapshot exported (${backup.gridEvents.length} events, ${backup.dailySummaries.length} daily summaries).`,
    checksum: backup.checksumSha256.slice(0, 12),
  });
}

/**
 * Dispatches a backup snapshot to an external webhook URL
 */
export async function dispatchBackupWebhook(
  webhookUrl: string,
  secretToken?: string,
  backupData?: LightTrackerBackup
): Promise<{ success: boolean; statusCode?: number; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, message: 'Invalid webhook URL. Must start with http:// or https://' };
  }

  const snapshot = backupData || (await generateBackupSnapshot());
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-LightTracker-Event': 'backup.snapshot.created',
    'X-LightTracker-Version': snapshot.version,
    'X-LightTracker-Home': snapshot.home.id,
    'X-LightTracker-Checksum': snapshot.checksumSha256,
  };

  if (secretToken) {
    headers['Authorization'] = `Bearer ${secretToken}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(snapshot),
      signal: controller.signal,
      mode: 'cors',
    });
    clearTimeout(timeout);

    if (response.ok) {
      recordAuditLog({
        type: 'WEBHOOK_DISPATCH',
        status: 'SUCCESS',
        details: `Dispatched to ${webhookUrl} (HTTP ${response.status})`,
        checksum: snapshot.checksumSha256.slice(0, 12),
      });
      return {
        success: true,
        statusCode: response.status,
        message: `Backup successfully accepted by destination (HTTP ${response.status})`,
      };
    } else {
      const errText = `HTTP ${response.status} ${response.statusText}`;
      recordAuditLog({
        type: 'WEBHOOK_DISPATCH',
        status: 'FAILED',
        details: `Failed dispatch to ${webhookUrl}: ${errText}`,
        checksum: snapshot.checksumSha256.slice(0, 12),
      });
      return { success: false, statusCode: response.status, message: `Remote endpoint returned error: ${errText}` };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordAuditLog({
      type: 'WEBHOOK_DISPATCH',
      status: 'FAILED',
      details: `Network/CORS error reaching ${webhookUrl}: ${errorMsg}`,
      checksum: snapshot.checksumSha256.slice(0, 12),
    });
    return {
      success: false,
      message: `Failed to dispatch: ${errorMsg}. Note: Webhook must allow CORS headers if sent directly from browser.`,
    };
  }
}

/**
 * Gets audit log entries from local storage
 */
export function getBackupAuditLog(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) {
      // Seed default log entries for realism
      return [
        {
          id: 'log_001',
          timestamp: '2026-09-05T02:00:00+01:00',
          type: 'SNAPSHOT_EXPORT',
          status: 'SUCCESS',
          details: 'Scheduled automated snapshot generated (7 days, 168h window).',
          checksum: 'e3b0c44298fc',
        },
        {
          id: 'log_002',
          timestamp: '2026-09-04T02:00:00+01:00',
          type: 'SNAPSHOT_EXPORT',
          status: 'SUCCESS',
          details: 'Scheduled automated snapshot generated.',
          checksum: '8d969eef6ecad',
        },
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Records an entry to the audit log
 */
export function recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getBackupAuditLog();
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '+01:00'),
    };
    const updated = [newEntry, ...existing].slice(0, 25);
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to update audit log', e);
  }
}
