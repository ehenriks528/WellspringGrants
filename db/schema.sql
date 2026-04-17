CREATE TABLE IF NOT EXISTS submissions (
  id VARCHAR(100) PRIMARY KEY,
  submitted_at TIMESTAMPTZ,
  status VARCHAR(50),
  org_name TEXT,
  mission TEXT,
  ein VARCHAR(20),
  signer_name TEXT,
  signer_title TEXT,
  org_phone VARCHAR(30),
  org_street TEXT,
  org_city TEXT,
  org_state VARCHAR(5),
  org_zip VARCHAR(10),
  org_location TEXT,
  tax_exempt VARCHAR(20),
  funder_name TEXT,
  grant_program TEXT,
  guidelines_url TEXT,
  grant_deadline VARCHAR(30),
  special_requirements TEXT,
  problem_statement TEXT,
  project_description TEXT,
  target_population TEXT,
  expected_outcomes TEXT,
  budget_breakdown TEXT,
  amount_requested NUMERIC,
  annual_budget NUMERIC,
  delivery_format VARCHAR(50),
  contact_name TEXT,
  contact_email TEXT,
  referral_source TEXT,
  anything_else TEXT,
  stripe_session_id TEXT,
  paid_at TIMESTAMPTZ,
  grant_draft TEXT,
  grant_body TEXT,
  qa_report TEXT,
  quality_score NUMERIC,
  client_input_required BOOLEAN DEFAULT false,
  is_comp BOOLEAN DEFAULT false,
  promo_code_used VARCHAR(50),
  grant_generated_at TIMESTAMPTZ,
  doc_url TEXT,
  doc_id TEXT,
  client_folder_id TEXT,
  doc_created_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error TEXT
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code VARCHAR(50) PRIMARY KEY,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO promo_codes
  (code, description, max_uses, expires_at)
VALUES
  ('FIRSTGRANT',
   'First grant free outreach campaign',
   100,
   NOW() + interval '12 months')
ON CONFLICT (code) DO NOTHING;
