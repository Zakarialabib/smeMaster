-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'none',
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  due_date INTEGER,
  parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  thread_id TEXT,
  thread_account_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT,
  next_recurrence_at INTEGER,
  tags_json TEXT NOT NULL DEFAULT '[]',
  workflow_config_json TEXT,
  reminder_config_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS task_tags (
  tag TEXT NOT NULL,
  company_id TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (tag, company_id)
);
