-- Deliverability: config, events, newsletters, warming, bounces, suppression
CREATE TABLE IF NOT EXISTS deliverability_config (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  config_type TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, config_type)
);

CREATE TABLE IF NOT EXISTS deliverability_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS newsletter_bundles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  thread_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bundle_rules (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  is_bundled INTEGER NOT NULL DEFAULT 0,
  delivery_enabled INTEGER NOT NULL DEFAULT 0,
  delivery_schedule TEXT,
  last_delivered_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, category)
);

CREATE TABLE IF NOT EXISTS bundled_threads (
  account_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  category TEXT NOT NULL,
  held_until INTEGER,
  PRIMARY KEY (account_id, thread_id),
  FOREIGN KEY (account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blacklist_checks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  target TEXT NOT NULL,
  listed INTEGER NOT NULL DEFAULT 0,
  list_name TEXT,
  responded INTEGER NOT NULL DEFAULT 0,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS arf_reports (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  original_recipient TEXT,
  reported_domain TEXT,
  feedback_type TEXT,
  user_agent TEXT,
  source_ip TEXT,
  arrival_date INTEGER,
  report_raw TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS email_warming (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  start_volume INTEGER NOT NULL DEFAULT 10,
  current_volume INTEGER NOT NULL DEFAULT 10,
  target_volume INTEGER NOT NULL DEFAULT 100,
  ramp_days INTEGER NOT NULL DEFAULT 14,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS warming_log (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sent_date TEXT NOT NULL,
  volume INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bounces (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  bounce_type TEXT NOT NULL,
  diagnostic_code TEXT,
  reason TEXT,
  bounced_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS suppression_list (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  suppressed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS unsubscribe_actions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  from_name TEXT,
  method TEXT NOT NULL,
  unsubscribe_url TEXT NOT NULL,
  status TEXT DEFAULT 'subscribed',
  unsubscribed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, from_address)
);
