-- Account Cleaning: retention policies, cleanup rules, and unsubscribe integration
-- Add delete_behavior to accounts metadata (stored in metadata_json)

CREATE TABLE IF NOT EXISTS account_cleanup_rules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'sender', 'subject', 'age', 'unsubscribe'
  condition_json TEXT NOT NULL, -- filter criteria
  action TEXT NOT NULL, -- 'delete', 'archive', 'move_to', 'mark_read'
  target_folder TEXT, -- for move_to action
  retention_days INTEGER, -- for age-based cleanup
  is_scheduled INTEGER NOT NULL DEFAULT 0, -- run automatically via queue
  schedule_cron TEXT, -- cron expression for scheduled runs
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cleanup_rules_company ON account_cleanup_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_rules_scheduled ON account_cleanup_rules(is_scheduled, next_run_at);

CREATE TABLE IF NOT EXISTS cleanup_history (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_id TEXT REFERENCES account_cleanup_rules(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'delete', 'archive', 'move', 'unsubscribe'
  thread_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'partial'
  error_message TEXT,
  executed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cleanup_history_company ON cleanup_history(company_id, executed_at DESC);
