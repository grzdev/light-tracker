-- Migration 006: Daily summaries (pre-computed cache — can be recomputed anytime)

CREATE TABLE daily_summaries (
    id BIGSERIAL PRIMARY KEY,
    home_id TEXT NOT NULL REFERENCES homes(id),
    date DATE NOT NULL,
    grid_on_seconds BIGINT NOT NULL DEFAULT 0,
    grid_off_seconds BIGINT NOT NULL DEFAULT 0,
    unknown_seconds BIGINT NOT NULL DEFAULT 0,
    outage_count INTEGER NOT NULL DEFAULT 0,
    longest_outage_seconds BIGINT,
    availability_percent NUMERIC(5,2),
    coverage_percent NUMERIC(5,2),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(home_id, date)
);

CREATE INDEX idx_daily_summaries_home_date ON daily_summaries(home_id, date DESC);
