-- Offline availability tracking: which accounts/folders/contacts are guaranteed offline.
-- This supports the local-first "available offline" set inspired by Notion's offline trees.

CREATE TABLE IF NOT EXISTS offline_availability (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  folder_id TEXT,
  contact_id TEXT,
  reason TEXT NOT NULL DEFAULT 'manual' CHECK (reason IN ('manual', 'recent', 'favorite', 'label')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_offline_availability_company ON offline_availability(company_id);
CREATE INDEX IF NOT EXISTS idx_offline_availability_enabled ON offline_availability(company_id, enabled);
