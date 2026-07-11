-- Vault Items: indexed metadata for vault files
CREATE TABLE IF NOT EXISTS vault_items (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  extension TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  file_size INTEGER NOT NULL DEFAULT 0,
  is_dir INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  checksum TEXT
);

CREATE INDEX IF NOT EXISTS idx_vault_items_company ON vault_items(company_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_category ON vault_items(category);
CREATE INDEX IF NOT EXISTS idx_vault_items_relative_path ON vault_items(relative_path);
