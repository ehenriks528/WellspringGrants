CREATE TABLE IF NOT EXISTS acquisition_leads (
 id UUID PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 org_name TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT NOT NULL,
 website TEXT, location TEXT NOT NULL, project TEXT NOT NULL,
 grant_url TEXT, deadline DATE, source TEXT NOT NULL DEFAULT 'direct',
 consent_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'new',
 follow_up_at TIMESTAMPTZ, notes TEXT NOT NULL DEFAULT '',
 acknowledgement_attempts INTEGER NOT NULL DEFAULT 0, acknowledgement_attempted_at TIMESTAMPTZ,
 acknowledgement_status TEXT NOT NULL DEFAULT 'pending', acknowledgement_id TEXT,
 suppressed BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS acquisition_email_idx ON acquisition_leads (email);
CREATE TABLE IF NOT EXISTS acquisition_events (
 id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 lead_id UUID REFERENCES acquisition_leads(id), submission_id TEXT,
 event TEXT NOT NULL, external_id TEXT UNIQUE, amount_cents INTEGER,
 currency TEXT, live BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS acquisition_outreach (
 id UUID PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 org_name TEXT NOT NULL, email TEXT NOT NULL, contact_source TEXT NOT NULL,
 demand_source TEXT NOT NULL, funder_source TEXT NOT NULL,
 eligibility_evidence TEXT NOT NULL, deadline DATE NOT NULL,
 verified_at TIMESTAMPTZ NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft', approved_at TIMESTAMPTZ,
 approved_by TEXT, sent_at TIMESTAMPTZ, follow_up_at TIMESTAMPTZ,
 CHECK (status IN ('draft','approved','sent','replied','closed','suppressed'))
);
CREATE TABLE IF NOT EXISTS acquisition_suppressions (
 email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS acquisition_audit (
 id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 record_id UUID NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL
);

ALTER TABLE acquisition_leads ADD COLUMN IF NOT EXISTS acknowledgement_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE acquisition_leads ADD COLUMN IF NOT EXISTS acknowledgement_attempted_at TIMESTAMPTZ;
