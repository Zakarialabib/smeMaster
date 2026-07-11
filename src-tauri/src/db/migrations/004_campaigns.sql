-- Campaigns, recipients, analytics, UTM
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  segment_id TEXT REFERENCES contact_segments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_count INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  ab_test_config TEXT,
  analytics_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  opened_at INTEGER,
  clicked_at INTEGER,
  variant TEXT,
  is_winner INTEGER,
  PRIMARY KEY (campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS utm_links (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS utm_clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES utm_links(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  clicked_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS backup_schedules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'mbox',
  cron_expression TEXT NOT NULL,
  destination_path TEXT,
  encrypt INTEGER NOT NULL DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
