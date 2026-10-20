CREATE TABLE IF NOT EXISTS organic_funnel_events (
 event_id UUID PRIMARY KEY,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 event_name TEXT NOT NULL,
 page TEXT NOT NULL,
 step INTEGER
);
CREATE INDEX IF NOT EXISTS organic_funnel_period_idx ON organic_funnel_events(occurred_at);
CREATE TABLE IF NOT EXISTS purchase_scope_acknowledgments (
 submission_id TEXT PRIMARY KEY,
 acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 policy_version TEXT NOT NULL
);
