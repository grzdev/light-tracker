"""
Light Tracker Data Science & Backup Schemas
Canonical Pydantic models matching docs/integration-spec.md
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class HomeMetadata(BaseModel):
    id: str
    name: str
    location: str
    timezone: str = "Africa/Lagos"
    createdAt: Optional[str] = None


class SensorMetadata(BaseModel):
    id: str
    role: Literal["GRID", "BACKUP"]
    name: str
    deviceId: str
    online: bool
    lastSeenAt: Optional[str] = None


class RawObservation(BaseModel):
    timestamp: str
    sensorAOnline: bool
    sensorBOnline: bool
    state: Literal["ON", "OFF", "UNKNOWN", "SETUP_FAULT"]
    reasonCode: str


class GridEvent(BaseModel):
    id: str
    recordedAt: str
    state: Literal["ON", "OFF", "UNKNOWN", "SETUP_FAULT"]
    previousState: Optional[str] = None
    reasonCode: str
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    durationSeconds: Optional[float] = None


class DailySummary(BaseModel):
    date: str
    gridOnHours: float
    gridOffHours: float
    unknownHours: float
    availabilityPercent: float
    coveragePercent: float
    outageCount: int
    longestOutageSeconds: float


class IntegrationsConfig(BaseModel):
    autoBackupEnabled: bool = True
    cadence: Literal["DAILY", "WEEKLY", "MANUAL"] = "DAILY"
    webhookUrl: str = ""
    secretToken: Optional[str] = None
    lastBackupAt: Optional[str] = None


class LightTrackerBackup(BaseModel):
    version: str = "1.0.0"
    exportedAt: str
    checksumSha256: str
    generator: str
    home: HomeMetadata
    sensors: List[SensorMetadata]
    rawObservations: List[RawObservation] = Field(default_factory=list)
    gridEvents: List[GridEvent] = Field(default_factory=list)
    dailySummaries: List[DailySummary] = Field(default_factory=list)
    integrationsConfig: Optional[IntegrationsConfig] = None


class TimeSeriesRecord(BaseModel):
    timestamp: str
    hour: int
    day_of_week: int
    is_weekend: int
    sin_hour: float
    cos_hour: float
    state: Literal["ON", "OFF", "UNKNOWN", "SETUP_FAULT"]
    is_grid_on: Optional[int] = None
    is_unknown: int
    sensor_a_online: bool
    sensor_b_online: bool
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    rolling_avail_6h: float
    rolling_avail_24h: float
    outage_streak_hours: float
