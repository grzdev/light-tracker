-- Migration 005: Grid events (confirmed state transitions only, after debounce)

CREATE TYPE grid_state AS ENUM ('ON', 'OFF', 'UNKNOWN', 'SETUP_FAULT');
CREATE TYPE confidence_level AS ENUM ('HIGH', 'MEDIUM', 'LOW');

CREATE TABLE grid_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    home_id TEXT NOT NULL REFERENCES homes(id),
    state grid_state NOT NULL,
    reason_code TEXT NOT NULL,          -- see event-spec.md for all codes
    confidence confidence_level NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,   -- when the state FIRST appeared (not debounce commit time)
    committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    previous_state grid_state,
    duration_in_previous_state_ms BIGINT  -- populated when next event comes in
);

CREATE INDEX idx_grid_events_home_recorded ON grid_events(home_id, recorded_at DESC);
