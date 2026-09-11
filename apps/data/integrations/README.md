# Light Tracker — Data Science & Backup Integrations

This directory provides Python utilities and canonical schemas for ingesting Light Tracker datasets into research environments (Pandas, Polars, Scikit-learn) and running automated backup synchronization.

---

## Architecture & Endpoints

The Light Tracker web dashboard exports static and dynamic data contracts under `/data/`:
- `https://<site>/data/backup-latest.json` — Portable full system snapshot (JSON v1.0.0).
- `https://<site>/data/dataset-timeseries-5m.json` — 5-minute continuous ML dataset with engineered features.
- `https://<site>/data/dataset-events.json` — Event transition log for survival and Markov models.
- `https://<site>/data/schema.json` — JSON schema validator for ingestion pipelines.

---

## 1. Data Science Loader (`ds_loader.py`)

Load continuous, feature-engineered time-series data directly into Pandas or Polars:

```python
from apps.data.integrations.ds_loader import LightTrackerDataLoader

# Ingest from remote web dashboard or local file
loader = LightTrackerDataLoader("https://your-site.netlify.app/data/dataset-timeseries-5m.json")

# 1. Load into Pandas with WAT (+01:00) DatetimeIndex
df = loader.load_pandas(mask_unknown=True)

# 2. Extract ML feature matrix X and target y
X, y = loader.get_feature_matrix(df)
print(X.head())

# 3. Load into Polars
df_polars = loader.load_polars()
```

### Pre-Engineered Features in the Dataset:
- `timestamp`: Africa/Lagos (+01:00) ISO datetime.
- `sin_hour`, `cos_hour`: Cyclical representations of time-of-day.
- `day_of_week`, `is_weekend`: Weekly residential load shedding indicators.
- `rolling_avail_6h`, `rolling_avail_24h`: Moving average grid availability percentages.
- `outage_streak_hours`: Continuous elapsed outage time for survival/hazard modeling.
- `is_unknown`: Binary flag indicating internet/router disconnection (masked to avoid false outage labels).

---

## 2. Automated Backup Runner (`backup_runner.py`)

Run automated disaster recovery backups from a cron job or Railway worker:

```bash
# Pull latest snapshot, verify SHA-256 integrity, and save locally
python apps/data/integrations/backup_runner.py \
  --source "https://your-site.netlify.app/data/backup-latest.json" \
  --dest-dir "./backups"

# Forward snapshot to an external webhook or Supabase edge function
python apps/data/integrations/backup_runner.py \
  --source "./backups/light-tracker-backup-home_abc123-2026-09-05.json" \
  --webhook "https://api.example.com/webhooks/light-tracker-backup" \
  --secret "your_secret_token"
```

---

## 3. Pydantic Schemas (`schema.py`)

Import canonical models to validate ingestion pipelines:

```python
from apps.data.integrations.schema import LightTrackerBackup, TimeSeriesRecord

# Validate payload
backup = LightTrackerBackup.model_validate(json_dict)
print(f"Home: {backup.home.name} ({len(backup.gridEvents)} events)")
```

---

## 4. Jupyter Quickstart Notebook

Open `apps/data/notebooks/data_science_quickstart.ipynb` to explore:
- Visualizing diurnal load shedding patterns across Lagos.
- Kaplan-Meier survival curves of outage durations.
- Baseline outage prediction using Random Forest / XGBoost.
