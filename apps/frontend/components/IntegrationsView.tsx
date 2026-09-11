'use client';

import { useState, useMemo, useRef, ChangeEvent } from 'react';
import {
  Database,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileJson,
  Check,
  Copy,
  Upload,
  RefreshCw,
  Send,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Sliders,
  ExternalLink,
  Table,
  Layers,
  ChevronRight,
  HardDriveDownload,
  FileCheck2,
} from 'lucide-react';
import {
  generateTimeSeriesDataset,
  generateEventLog,
  calculateEDAStats,
  convertToCSV,
  convertToNDJSON,
  downloadDataFile,
  generateCodeSnippet,
  ResampleInterval,
  UnknownHandling,
  TimeSeriesRecord,
} from '@/lib/data-science';
import {
  generateBackupSnapshot,
  validateBackupSnapshot,
  downloadBackupFile,
  dispatchBackupWebhook,
  getStoredBackupConfig,
  saveBackupConfig,
  getBackupAuditLog,
  recordAuditLog,
  LightTrackerBackup,
  AuditLogEntry,
} from '@/lib/backup';

interface IntegrationsViewProps {
  onNotify: (msg: string) => void;
  homeName: string;
}

export default function IntegrationsView({ onNotify, homeName }: IntegrationsViewProps) {
  const [activeTab, setActiveTab] = useState<'data-science' | 'backup'>('data-science');

  // --- Data Science Hub State ---
  const [resampleInterval, setResampleInterval] = useState<ResampleInterval>('5m');
  const [includeMLFeatures, setIncludeMLFeatures] = useState(true);
  const [unknownHandling, setUnknownHandling] = useState<UnknownHandling>('MASK_NULL');
  const [selectedSnippetLang, setSelectedSnippetLang] = useState<'python_pandas' | 'python_polars' | 'r' | 'curl'>('python_pandas');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // --- Backup Hub State ---
  const [backupConfig, setBackupConfig] = useState(getStoredBackupConfig);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(getBackupAuditLog);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [restoreFileStatus, setRestoreFileStatus] = useState<{
    status: 'IDLE' | 'VALID' | 'INVALID';
    message: string;
    details?: {
      eventsCount: number;
      homeId: string;
      checksumVerified: boolean;
      claimedChecksum?: string;
    };
    backup?: LightTrackerBackup;
  }>({ status: 'IDLE', message: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute dataset & stats based on active controls
  const timeSeriesData = useMemo(() => {
    return generateTimeSeriesDataset(resampleInterval, includeMLFeatures, unknownHandling);
  }, [resampleInterval, includeMLFeatures, unknownHandling]);

  const edaStats = useMemo(() => {
    return calculateEDAStats(timeSeriesData);
  }, [timeSeriesData]);

  // Handle snippet copying
  function handleCopySnippet() {
    const code = generateCodeSnippet(selectedSnippetLang);
    navigator.clipboard.writeText(code).then(() => {
      setCopiedSnippet(true);
      onNotify('Code snippet copied to clipboard.');
      setTimeout(() => setCopiedSnippet(false), 3000);
    });
  }

  // Handle dataset downloads
  function handleExportTimeSeriesCSV() {
    const csv = convertToCSV(timeSeriesData);
    downloadDataFile(csv, `light-tracker-timeseries-${resampleInterval}-2026-09-05.csv`, 'text/csv;charset=utf-8;');
    onNotify(`Downloaded ${resampleInterval} time series CSV (${timeSeriesData.length} records).`);
  }

  function handleExportTimeSeriesJSON() {
    const jsonStr = JSON.stringify(timeSeriesData, null, 2);
    downloadDataFile(jsonStr, `light-tracker-timeseries-${resampleInterval}-2026-09-05.json`, 'application/json;charset=utf-8;');
    onNotify(`Downloaded ${resampleInterval} time series JSON.`);
  }

  function handleExportTimeSeriesNDJSON() {
    const ndjson = convertToNDJSON(timeSeriesData);
    downloadDataFile(ndjson, `light-tracker-timeseries-${resampleInterval}-2026-09-05.ndjson`, 'application/x-ndjson;charset=utf-8;');
    onNotify(`Downloaded ${resampleInterval} streaming NDJSON.`);
  }

  function handleExportEventLogCSV() {
    const events = generateEventLog();
    const csv = convertToCSV(events);
    downloadDataFile(csv, `light-tracker-event-log-2026-09-05.csv`, 'text/csv;charset=utf-8;');
    onNotify(`Downloaded event transition log (${events.length} events).`);
  }

  // --- Backup Handlers ---
  async function handleDownloadSnapshot() {
    setIsGeneratingBackup(true);
    try {
      const snapshot = await generateBackupSnapshot(homeName);
      downloadBackupFile(snapshot);
      setAuditLog(getBackupAuditLog());
      onNotify('Full system snapshot downloaded with SHA-256 checksum.');
    } catch (err) {
      console.error(err);
      onNotify('Error generating backup snapshot.');
    } finally {
      setIsGeneratingBackup(false);
    }
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const content = event.target?.result as string;
      const res = await validateBackupSnapshot(content);

      if (res.valid && res.backup) {
        setRestoreFileStatus({
          status: 'VALID',
          message: 'Valid Light Tracker v1.0.0 snapshot detected.',
          details: {
            eventsCount: res.backup.gridEvents.length,
            homeId: res.backup.home.id,
            checksumVerified: res.checksumVerified,
            claimedChecksum: res.backup.checksumSha256,
          },
          backup: res.backup,
        });
      } else {
        setRestoreFileStatus({
          status: 'INVALID',
          message: res.errors.join(' ') || 'Snapshot validation failed.',
        });
      }
    };
    reader.readAsText(file);
  }

  function handleApplyRestore() {
    if (!restoreFileStatus.backup) return;
    const b = restoreFileStatus.backup;
    try {
      localStorage.setItem('lt-home', b.home.name);
    } catch {}

    recordAuditLog({
      type: 'RESTORE_IMPORTED',
      status: 'SUCCESS',
      details: `Restored snapshot for ${b.home.name} (${b.gridEvents.length} events, ${b.dailySummaries.length} days).`,
      checksum: b.checksumSha256 ? b.checksumSha256.slice(0, 12) : undefined,
    });
    setAuditLog(getBackupAuditLog());
    onNotify(`Snapshot applied successfully: ${b.home.name}`);
    setRestoreFileStatus({ status: 'IDLE', message: '' });
  }

  async function handleTestWebhook() {
    if (!backupConfig.webhookUrl) {
      onNotify('Please enter a Webhook URL first.');
      return;
    }
    setIsDispatching(true);
    try {
      const result = await dispatchBackupWebhook(backupConfig.webhookUrl, backupConfig.secretToken);
      setAuditLog(getBackupAuditLog());
      if (result.success) {
        onNotify(result.message);
      } else {
        onNotify(result.message);
      }
    } finally {
      setIsDispatching(false);
    }
  }

  function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    saveBackupConfig(backupConfig);
    onNotify('Backup destination preferences saved.');
  }

  return (
    <div className="integrations-container">
      {/* Top Header & Tab Navigation */}
      <div className="integrations-header">
        <div className="integrations-title-block">
          <div className="badge-wrapper">
            <span className="tiny-badge green">
              <Database size={12} /> System Ready
            </span>
            <span className="spec-version">Spec v1.0.0</span>
          </div>
          <h2>Data Science & Backup Hub</h2>
          <p>
            Standardized interfaces for disaster recovery snapshots, data science pipelines, and continuous time-series modeling.
          </p>
        </div>

        <div className="integrations-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'data-science'}
            className={`tab-btn ${activeTab === 'data-science' ? 'active' : ''}`}
            onClick={() => setActiveTab('data-science')}
          >
            <Sparkles size={16} />
            <span>Data Science & ML</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'backup'}
            className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            <ShieldCheck size={16} />
            <span>Backup & Disaster Recovery</span>
          </button>
        </div>
      </div>

      {/* ================= DATA SCIENCE TAB ================= */}
      {activeTab === 'data-science' && (
        <div className="tab-content fade-in">
          {/* Summary Metrics Row */}
          <div className="ds-metrics-grid">
            <div className="ds-metric-card">
              <span className="metric-label">Resampled Points</span>
              <strong className="metric-val">{timeSeriesData.length.toLocaleString()}</strong>
              <small className="metric-sub">{resampleInterval} continuous intervals (7 days)</small>
            </div>
            <div className="ds-metric-card">
              <span className="metric-label">Engineered Features</span>
              <strong className="metric-val">{includeMLFeatures ? '13' : '8'}</strong>
              <small className="metric-sub">Cyclical sin/cos, rolling availability</small>
            </div>
            <div className="ds-metric-card">
              <span className="metric-label">Mean Outage Duration</span>
              <strong className="metric-val">{edaStats.outageDurationMedian.toFixed(1)}h</strong>
              <small className="metric-sub">Median · MTTR: {edaStats.mttrMinutes} mins</small>
            </div>
            <div className="ds-metric-card">
              <span className="metric-label">Data Coverage</span>
              <strong className="metric-val">{edaStats.coveragePercent.toFixed(1)}%</strong>
              <small className="metric-sub">{edaStats.unknownHours}h unknown masked</small>
            </div>
          </div>

          {/* Dataset Configuration & Export Toolbar */}
          <div className="panel ds-config-panel">
            <div className="panel-heading">
              <div>
                <h3>1. Dataset Configuration & Exporters</h3>
                <p>Configure time resolution and feature sets before downloading or fetching via API.</p>
              </div>
              <span className="spec-tag">Canonical Event Spec</span>
            </div>

            <div className="config-row">
              <div className="control-group">
                <label className="group-label">
                  <Clock size={14} /> Resampling Interval:
                </label>
                <div className="pill-selector">
                  {(['1m', '5m', '15m', '1h'] as ResampleInterval[]).map(res => (
                    <button
                      key={res}
                      className={`pill ${resampleInterval === res ? 'active' : ''}`}
                      onClick={() => setResampleInterval(res)}
                    >
                      {res === '1m' ? '1m (High Res)' : res === '5m' ? '5m (Standard ML)' : res === '15m' ? '15m' : '1h (Macro)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label className="group-label">
                  <Sliders size={14} /> UNKNOWN Masking:
                </label>
                <div className="pill-selector">
                  <button
                    className={`pill ${unknownHandling === 'MASK_NULL' ? 'active' : ''}`}
                    onClick={() => setUnknownHandling('MASK_NULL')}
                    title="Null values prevent confusing connection drops with outages in ML models"
                  >
                    Mask with Null (Recommended)
                  </button>
                  <button
                    className={`pill ${unknownHandling === 'FLAG_ONLY' ? 'active' : ''}`}
                    onClick={() => setUnknownHandling('FLAG_ONLY')}
                  >
                    Flag Only (1/0)
                  </button>
                </div>
              </div>

              <div className="control-group">
                <label className="group-label">
                  <Sparkles size={14} /> ML Features:
                </label>
                <label className="toggle-chip">
                  <input
                    type="checkbox"
                    checked={includeMLFeatures}
                    onChange={e => setIncludeMLFeatures(e.target.checked)}
                  />
                  <span>Sine/Cosine Cyclical Time & Streak</span>
                </label>
              </div>
            </div>

            <div className="export-actions-bar">
              <div className="export-buttons">
                <button className="button primary-export" onClick={handleExportTimeSeriesCSV}>
                  <FileSpreadsheet size={16} />
                  <span>Download Time-Series CSV</span>
                </button>
                <button className="button secondary-export" onClick={handleExportTimeSeriesJSON}>
                  <FileJson size={16} />
                  <span>Download JSON</span>
                </button>
                <button className="button secondary-export" onClick={handleExportTimeSeriesNDJSON}>
                  <Layers size={16} />
                  <span>Download NDJSON (Streaming)</span>
                </button>
                <button className="button outline-export" onClick={handleExportEventLogCSV}>
                  <FileCode2 size={16} />
                  <span>Download Event Transition Log</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Data Preview Table */}
          <div className="panel ds-preview-panel">
            <div className="panel-heading">
              <div>
                <h3>2. Live Feature Store Preview</h3>
                <p>First 6 rows of the transformed feature matrix ({timeSeriesData.length.toLocaleString()} total rows).</p>
              </div>
              <span className="live-pill"><i /> Live Memory</span>
            </div>

            <div className="table-responsive">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Timestamp (WAT)</th>
                    <th>State</th>
                    <th>is_grid_on</th>
                    <th>is_unknown</th>
                    <th>sin_hour</th>
                    <th>cos_hour</th>
                    <th>rolling_24h</th>
                    <th>outage_streak_h</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSeriesData.slice(0, 6).map((row, i) => (
                    <tr key={i}>
                      <td className="code-font">{row.timestamp.replace('+01:00', '')}</td>
                      <td>
                        <span className={`state-tag ${row.state.toLowerCase()}`}>{row.state}</span>
                      </td>
                      <td className="code-font">{row.is_grid_on !== null ? row.is_grid_on : 'null'}</td>
                      <td className="code-font">{row.is_unknown}</td>
                      <td className="code-font">{row.sin_hour.toFixed(3)}</td>
                      <td className="code-font">{row.cos_hour.toFixed(3)}</td>
                      <td className="code-font">{row.rolling_avail_24h}%</td>
                      <td className="code-font">{row.outage_streak_hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Connect Code Snippets */}
          <div className="panel ds-code-panel">
            <div className="panel-heading">
              <div>
                <h3>3. Notebook & Script Quick-Connect</h3>
                <p>Copy and paste directly into Jupyter, Google Colab, or automated ML pipelines.</p>
              </div>
              <button className="copy-btn" onClick={handleCopySnippet}>
                {copiedSnippet ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedSnippet ? 'Copied!' : 'Copy snippet'}</span>
              </button>
            </div>

            <div className="code-lang-selector">
              {(
                [
                  { id: 'python_pandas', label: 'Python (Pandas)' },
                  { id: 'python_polars', label: 'Python (Polars)' },
                  { id: 'r', label: 'R (tidyverse)' },
                  { id: 'curl', label: 'cURL / CLI' },
                ] as const
              ).map(l => (
                <button
                  key={l.id}
                  className={`lang-pill ${selectedSnippetLang === l.id ? 'active' : ''}`}
                  onClick={() => setSelectedSnippetLang(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <pre className="code-block">
              <code>{generateCodeSnippet(selectedSnippetLang)}</code>
            </pre>

            <div className="code-footer">
              <div className="endpoint-hint">
                <Info size={14} />
                <span>
                  Public endpoint: <code>/data/dataset-timeseries-5m.json</code>
                </span>
              </div>
              <span className="python-badge">Python 3.9+ compatible</span>
            </div>
          </div>

          {/* Exploratory Data Analysis (EDA) Insights */}
          <div className="panel ds-eda-panel">
            <div className="panel-heading">
              <div>
                <h3>4. Exploratory Data Analysis & Outage Distribution</h3>
                <p>Quantiles and hourly failure distribution for survival & load-shedding analysis.</p>
              </div>
            </div>

            <div className="eda-layout">
              <div className="eda-quantiles">
                <h4>Outage Duration Distribution</h4>
                <div className="quantile-list">
                  <div className="quantile-item">
                    <span>25th Percentile (p25):</span>
                    <strong>{edaStats.outageDurationP25.toFixed(1)} hours</strong>
                  </div>
                  <div className="quantile-item">
                    <span>Median (p50):</span>
                    <strong>{edaStats.outageDurationMedian.toFixed(1)} hours</strong>
                  </div>
                  <div className="quantile-item">
                    <span>75th Percentile (p75):</span>
                    <strong>{edaStats.outageDurationP75.toFixed(1)} hours</strong>
                  </div>
                  <div className="quantile-item">
                    <span>95th Percentile (p95):</span>
                    <strong>{edaStats.outageDurationP95.toFixed(1)} hours</strong>
                  </div>
                  <div className="quantile-item">
                    <span>Max Observed Outage:</span>
                    <strong>{edaStats.maxOutageDurationHours.toFixed(1)} hours</strong>
                  </div>
                </div>
              </div>

              <div className="eda-hourly">
                <h4>Diurnal Outage Probability by Hour (00:00 – 23:00 WAT)</h4>
                <div className="hourly-sparkbar">
                  {edaStats.hourlyOutageProbability.map(item => {
                    const heightPercent = Math.max(item.probability * 100, 6);
                    return (
                      <div key={item.hour} className="hour-col" title={`Hour ${item.hour}:00 — ${(item.probability * 100).toFixed(0)}% Outage Probability`}>
                        <div className="bar-wrapper">
                          <span
                            className={`hour-bar ${item.probability > 0.4 ? 'high-risk' : item.probability > 0 ? 'mid-risk' : 'zero'}`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                        <span className="hour-num">{item.hour % 4 === 0 ? `${item.hour}h` : ''}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="eda-caption">
                  <span>High probability load-shedding window: <strong>11:00 – 17:00 WAT</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= BACKUP & DISASTER RECOVERY TAB ================= */}
      {activeTab === 'backup' && (
        <div className="tab-content fade-in">
          {/* Full Snapshot Card */}
          <div className="panel backup-card">
            <div className="panel-heading">
              <div>
                <h3>1. System Snapshot Exporter</h3>
                <p>Generate a complete, self-contained backup containing all observations, confirmed grid events, sensor configs, and checksums.</p>
              </div>
              <span className="spec-tag">SHA-256 Verified</span>
            </div>

            <div className="snapshot-summary-box">
              <div className="summary-col">
                <span className="label">Target Home</span>
                <strong>{homeName}</strong>
                <small>Yaba, Lagos</small>
              </div>
              <div className="summary-col">
                <span className="label">Registered Sensors</span>
                <strong>2 Sensors</strong>
                <small>Grid (A) + Inverter (B)</small>
              </div>
              <div className="summary-col">
                <span className="label">Historical Span</span>
                <strong>7 Days (168h)</strong>
                <small>30 Aug – 5 Sep 2026</small>
              </div>
              <div className="summary-col">
                <span className="label">Format & Schema</span>
                <strong>JSON v1.0.0</strong>
                <small>Integrity Verified</small>
              </div>
            </div>

            <div className="snapshot-actions">
              <button
                className="button primary-export"
                onClick={handleDownloadSnapshot}
                disabled={isGeneratingBackup}
              >
                {isGeneratingBackup ? <RefreshCw className="spin" size={16} /> : <HardDriveDownload size={16} />}
                <span>{isGeneratingBackup ? 'Generating Snapshot...' : 'Download Full System Snapshot (.json)'}</span>
              </button>
              <div className="snapshot-note">
                <ShieldCheck size={15} />
                <span>Includes canonical JSON SHA-256 hash for tamper detection upon restoration.</span>
              </div>
            </div>
          </div>

          {/* Snapshot Restore & Validator */}
          <div className="panel restore-panel">
            <div className="panel-heading">
              <div>
                <h3>2. Snapshot Restore & Schema Inspector</h3>
                <p>Inspect, validate, and restore a Light Tracker snapshot file to recover historical records or verify third-party datasets.</p>
              </div>
              <span className="spec-tag">Validation Engine</span>
            </div>

            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const input = fileInputRef.current;
                  if (input) {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <Upload size={32} className="dropzone-icon" />
              <h4>Click or drag & drop a backup snapshot JSON file here</h4>
              <p>Supports Light Tracker Backup Schema v1.0.0</p>
            </div>

            {restoreFileStatus.status === 'VALID' && restoreFileStatus.details && (
              <div className="restore-preview-box valid">
                <div className="status-title">
                  <FileCheck2 size={20} className="green-text" />
                  <strong>{restoreFileStatus.message}</strong>
                </div>
                <div className="preview-meta-row">
                  <div>
                    <span>Home ID:</span>
                    <strong>{restoreFileStatus.details.homeId}</strong>
                  </div>
                  <div>
                    <span>Events in file:</span>
                    <strong>{restoreFileStatus.details.eventsCount} events</strong>
                  </div>
                  <div>
                    <span>SHA-256 Hash:</span>
                    <strong className="code-font">
                      {restoreFileStatus.details.claimedChecksum
                        ? `${restoreFileStatus.details.claimedChecksum.slice(0, 16)}...`
                        : 'None'}
                    </strong>
                  </div>
                  <div>
                    <span>Checksum Status:</span>
                    <strong className={restoreFileStatus.details.checksumVerified ? 'green-text' : 'amber-text'}>
                      {restoreFileStatus.details.checksumVerified ? '✓ Verified Matching' : '⚠ Hash Mismatch'}
                    </strong>
                  </div>
                </div>

                <div className="apply-bar">
                  <button className="button primary" onClick={handleApplyRestore}>
                    <Check size={16} />
                    <span>Apply & Restore This Snapshot</span>
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setRestoreFileStatus({ status: 'IDLE', message: '' })}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {restoreFileStatus.status === 'INVALID' && (
              <div className="restore-preview-box invalid">
                <AlertTriangle size={20} className="red-text" />
                <span>{restoreFileStatus.message}</span>
              </div>
            )}
          </div>

          {/* Automated Cloud & Webhook Destination */}
          <div className="panel webhook-panel">
            <div className="panel-heading">
              <div>
                <h3>3. Automated Cloud & Webhook Destinations</h3>
                <p>Configure automated outbound synchronization to external databases (Supabase), cloud storage (S3), or automation tools (Zapier, n8n).</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="webhook-form">
              <div className="form-group">
                <label htmlFor="webhook-url">Webhook Destination URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  placeholder="https://api.yourdomain.com/v1/backups/light-tracker"
                  value={backupConfig.webhookUrl}
                  onChange={e => setBackupConfig({ ...backupConfig, webhookUrl: e.target.value })}
                />
                <small>Receives HTTP POST payloads with header <code>X-LightTracker-Checksum</code>.</small>
              </div>

              <div className="form-group">
                <label htmlFor="secret-token">Bearer Secret Token (Optional)</label>
                <input
                  id="secret-token"
                  type="password"
                  placeholder="Bearer token or presigned signature"
                  value={backupConfig.secretToken || ''}
                  onChange={e => setBackupConfig({ ...backupConfig, secretToken: e.target.value })}
                />
              </div>

              <div className="form-row-checkbox">
                <label className="toggle-row">
                  <span>
                    <strong>Automated Snapshot Schedule</strong>
                    <small>Auto-export and dispatch daily at 02:00 WAT</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={backupConfig.autoBackupEnabled}
                    onChange={e => setBackupConfig({ ...backupConfig, autoBackupEnabled: e.target.checked })}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="button primary">
                  <Check size={16} />
                  <span>Save Destination</span>
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={handleTestWebhook}
                  disabled={isDispatching}
                >
                  {isDispatching ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
                  <span>{isDispatching ? 'Dispatching...' : 'Send Test Snapshot Now'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Backup Audit & Activity History */}
          <div className="panel audit-panel">
            <div className="panel-heading">
              <div>
                <h3>4. Backup Audit & Activity Log</h3>
                <p>Record of recent snapshot exports, restorations, and cloud dispatches.</p>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setAuditLog(getBackupAuditLog());
                  onNotify('Refreshed audit log.');
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            <div className="table-responsive">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Checksum</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(entry => (
                    <tr key={entry.id}>
                      <td className="code-font">{entry.timestamp.replace('+01:00', '').replace('T', ' ')}</td>
                      <td>
                        <span className="log-type-tag">{entry.type.replace('_', ' ')}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${entry.status.toLowerCase()}`}>
                          {entry.status === 'SUCCESS' ? '✓ OK' : '✕ FAILED'}
                        </span>
                      </td>
                      <td>{entry.details}</td>
                      <td className="code-font">{entry.checksum ? `${entry.checksum}...` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
