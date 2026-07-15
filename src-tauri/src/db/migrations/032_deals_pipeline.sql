-- 032: Deal / Pipeline management for the CRM sales module.
-- Adds pipelines (per company), deal_stages (ordered columns of a board), and
-- deals (the opportunities). Money is stored as i64 minor units (centimes) to
-- match the invoicing module's convention. Stage probability is 0..100.
-- Additive and safe to re-run.

CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS deal_stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#0b57d0',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL REFERENCES deal_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MAD',
  expected_close_at INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON deal_stages(pipeline_id);
