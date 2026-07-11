-- Resumable email migration / backfill support (report.md §6).
--
-- 1. Extends folder_sync_state with per-folder resumable-sync bookkeeping.
--    Columns are added additively (NOT NULL + DEFAULT) so existing installs
--    keep syncing uninterrupted; fresh installs get them via schema.sql.
-- 2. Adds sync_jobs (one row per migration run) and sync_conflicts (audit log
--    of source-vs-local divergences) so a backfill can pause, resume, and
--    explain itself instead of failing with cryptic errors.

ALTER TABLE folder_sync_state ADD COLUMN sync_phase TEXT NOT NULL DEFAULT 'discovered';
-- 'discovered' → 'headers' → 'backfill' → 'delta' → 'done'

ALTER TABLE folder_sync_state ADD COLUMN last_error TEXT;
ALTER TABLE folder_sync_state ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE folder_sync_state ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'discovery',
  status TEXT NOT NULL DEFAULT 'running',
  total_folders INTEGER NOT NULL DEFAULT 0,
  done_folders INTEGER NOT NULL DEFAULT 0,
  estimated_messages INTEGER,
  synced_messages INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_account ON sync_jobs(account_id, status);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  message_id_header TEXT,
  conflict_type TEXT NOT NULL,
  source_value TEXT,
  local_value TEXT,
  resolved TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_account ON sync_conflicts(account_id, resolved);
