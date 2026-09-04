-- Migration 003: Sensors table
CREATE TYPE sensor_role AS ENUM ('GRID', 'BACKUP');

CREATE TABLE sensors (
    id TEXT PRIMARY KEY,               -- e.g. "sensor_a"
    home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
    role sensor_role NOT NULL,
    device_id TEXT NOT NULL,           -- Tuya device ID
    device_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sensors_home_id ON sensors(home_id);
CREATE UNIQUE INDEX idx_sensors_home_role ON sensors(home_id, role); -- one GRID, one BACKUP per home
