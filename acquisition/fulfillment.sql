CREATE TABLE IF NOT EXISTS fulfillment_jobs (
  id BIGSERIAL PRIMARY KEY,
  submission_id VARCHAR(100) NOT NULL REFERENCES submissions(id),
  kind TEXT NOT NULL CHECK (kind IN ('generation','confirmation','admin_notification')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','succeeded','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_until TIMESTAMPTZ,
  lease_token TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id,kind)
);
CREATE INDEX IF NOT EXISTS fulfillment_jobs_ready ON fulfillment_jobs(state,available_at);
