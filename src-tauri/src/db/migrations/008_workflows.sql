-- Workflows: rules, reminders, pending operations
CREATE TABLE IF NOT EXISTS workflow_rules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_conditions TEXT,
  actions TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  remind_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
  -- thread_id is a loose reference (threads are account-scoped, not company-scoped).
  -- Application code resolves the thread via thread_id + account context.
);

CREATE TABLE IF NOT EXISTS pending_operations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  params TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 10,
  next_retry_at INTEGER,
  error_message TEXT,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  hold_until INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
