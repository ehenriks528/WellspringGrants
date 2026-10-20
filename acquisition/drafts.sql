-- Separate from paid submissions: optional drafts expire after seven days.
CREATE TABLE IF NOT EXISTS intake_drafts (
 token_hash TEXT PRIMARY KEY,
 encrypted_payload TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '7 days'
);
CREATE INDEX IF NOT EXISTS intake_drafts_expiry_idx ON intake_drafts(expires_at);
