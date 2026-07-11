-- Blacklist Monitoring: monitors, delist requests, bulk check jobs, reputation scores, alert preferences

-- Blacklist monitors for automated scanning
CREATE TABLE IF NOT EXISTS blacklist_monitors (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target TEXT NOT NULL,
  check_type TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL DEFAULT 1440,
  alerts_json TEXT NOT NULL DEFAULT '["email"]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_check_at INTEGER,
  UNIQUE(account_id, target, check_type)
);

-- Delist requests for guided delist workflow
CREATE TABLE IF NOT EXISTS delist_requests (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  list_name TEXT NOT NULL,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  delist_url TEXT,
  submitted_at INTEGER,
  resolved_at INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Bulk check jobs for multi-target batch operations
CREATE TABLE IF NOT EXISTS bulk_check_jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_targets INTEGER NOT NULL DEFAULT 0,
  processed_targets INTEGER NOT NULL DEFAULT 0,
  results_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);

-- Reputation scores for aggregate health metrics
CREATE TABLE IF NOT EXISTS reputation_scores (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  overall_score REAL NOT NULL DEFAULT 100.0,
  blacklist_factor REAL NOT NULL DEFAULT 100.0,
  bounce_factor REAL NOT NULL DEFAULT 100.0,
  complaint_factor REAL NOT NULL DEFAULT 100.0,
  warmup_factor REAL NOT NULL DEFAULT 100.0,
  calculated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Alert preferences for notification channels
CREATE TABLE IF NOT EXISTS alert_preferences (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  blacklist_enabled INTEGER NOT NULL DEFAULT 1,
  channels_json TEXT NOT NULL DEFAULT '["email"]',
  threshold TEXT NOT NULL DEFAULT 'immediate',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);