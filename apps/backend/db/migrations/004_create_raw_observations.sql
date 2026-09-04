-- Migration 004: Raw observations (every 60-second poll result)
-- NEVER delete rows from this table. It is the source of truth for reprocessing.

CREATE TABLE raw_observations (
    id BIGSERIAL PRIMARY KEY,
    home_id TEXT NOT NULL REFERENCES homes(id),
    sensor_a_online BOOLEAN NOT NULL,  -- GRID sensor
    sensor_b_online BOOLEAN NOT NULL,  -- BACKUP sensor
    raw_response_a JSONB,              -- Full Tuya API response for debugging
    raw_response_b JSONB,
    polled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_obs_home_polled ON raw_observations(home_id, polled_at DESC);
