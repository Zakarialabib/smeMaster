-- Compliance: profiles, checks
CREATE TABLE IF NOT EXISTS compliance_profiles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  region_hint TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- This FK is defined here (not on templates) because compliance_profiles
-- is created in this migration, avoiding forward-reference issues.
-- Application code enforces the relationship on templates.compliance_profile_id.

CREATE TABLE IF NOT EXISTS compliance_checks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_draft_id TEXT REFERENCES local_drafts(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  profile_ids TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 100,
  violations_json TEXT,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
