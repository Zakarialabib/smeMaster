-- AI: cache, config, writing style, smart labels
CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, thread_id, type)
);

CREATE TABLE IF NOT EXISTS ai_config (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, config_type)
);

CREATE TABLE IF NOT EXISTS writing_style_profiles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  profile_text TEXT NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id)
);

CREATE TABLE IF NOT EXISTS smart_label_rules (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL,
  ai_description TEXT NOT NULL,
  criteria_json TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (account_id, label_id) REFERENCES labels(account_id, id) ON DELETE CASCADE
);
