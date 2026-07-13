-- Contacts fix: add deleted_at and contact_type columns for invoicing clients
-- The clients module stores customers/suppliers in the contacts table and needs
-- these columns for soft-delete and contact-type filtering.

ALTER TABLE contacts ADD COLUMN deleted_at INTEGER;
ALTER TABLE contacts ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'lead';
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);

-- Import history table for tracking CSV/contact imports
CREATE TABLE IF NOT EXISTS import_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_log TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_import_history_account ON import_history(account_id);
