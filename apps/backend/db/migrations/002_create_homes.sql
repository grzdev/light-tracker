-- Migration 002: Homes table
CREATE TABLE homes (
    id TEXT PRIMARY KEY,               -- e.g. "home_abc123"
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                -- e.g. "Surulere Home"
    area TEXT,                         -- neighbourhood/area name
    city TEXT DEFAULT 'Lagos',
    timezone TEXT DEFAULT 'Africa/Lagos',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_homes_user_id ON homes(user_id);
