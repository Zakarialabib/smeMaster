-- schema.sql: authoritative full schema for fresh installs
-- Applies idempotently via runMigrations() — all CREATE TABLE IF NOT EXISTS.

-- ─── Core ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  history_id TEXT,
  last_sync_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'gmail_api',
  imap_host TEXT,
  imap_port INTEGER,
  imap_security TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_security TEXT,
  auth_method TEXT NOT NULL DEFAULT 'oauth',
  imap_password TEXT,
  imap_username TEXT,
  oauth_provider TEXT,
  oauth_client_id TEXT,
  oauth_client_secret TEXT,
  smtp_username TEXT,
  smtp_password TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS labels (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  color_bg TEXT,
  color_fg TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  imap_folder_path TEXT,
  imap_special_use TEXT,
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_labels_account ON labels(account_id);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject TEXT,
  snippet TEXT,
  last_message_at INTEGER,
  message_count INTEGER NOT NULL DEFAULT 0,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  is_important INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  is_snoozed INTEGER NOT NULL DEFAULT 0,
  snooze_until INTEGER,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_muted INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_threads_date ON threads(account_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_snoozed ON threads(is_snoozed, snooze_until);
CREATE INDEX IF NOT EXISTS idx_threads_pinned ON threads(account_id, is_pinned DESC, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_muted ON threads(account_id, is_muted);

CREATE TABLE IF NOT EXISTS thread_categories (
  account_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  category TEXT NOT NULL,
  is_manual INTEGER NOT NULL DEFAULT 0,
  is_user_override INTEGER NOT NULL DEFAULT 0,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (account_id, thread_id),
  FOREIGN KEY (account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_thread_categories_lookup ON thread_categories(account_id, category, thread_id);

-- Thread-Label junction
CREATE TABLE IF NOT EXISTS thread_labels (
  thread_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (account_id, thread_id, label_id),
  FOREIGN KEY (account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE,
  FOREIGN KEY (account_id, label_id) REFERENCES labels(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_thread_labels_label ON thread_labels(account_id, label_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT,
  cc_addresses TEXT,
  bcc_addresses TEXT,
  reply_to TEXT,
  subject TEXT,
  snippet TEXT,
  date INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  body_html TEXT,
  body_text TEXT,
  body_cached INTEGER NOT NULL DEFAULT 0,
  raw_size INTEGER,
  internal_date INTEGER,
  list_unsubscribe TEXT,
  list_unsubscribe_post TEXT,
  auth_results TEXT,
  message_id_header TEXT,
  references_header TEXT,
  in_reply_to_header TEXT,
  imap_uid INTEGER,
  imap_folder TEXT,
  PRIMARY KEY (account_id, id),
  FOREIGN KEY (account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(account_id, thread_id, date ASC);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_address);
CREATE INDEX IF NOT EXISTS idx_messages_imap_uid ON messages(account_id, imap_folder, imap_uid);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id_header);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  filename TEXT,
  mime_type TEXT,
  size INTEGER,
  gmail_attachment_id TEXT,
  content_id TEXT,
  is_inline INTEGER NOT NULL DEFAULT 0,
  local_path TEXT,
  cached_at INTEGER,
  cache_size INTEGER,
  imap_part_id TEXT,
  FOREIGN KEY (account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(account_id, message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_cid ON attachments(content_id);

CREATE TABLE IF NOT EXISTS folder_sync_state (
  account_id TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  uidvalidity INTEGER,
  last_uid INTEGER NOT NULL DEFAULT 0,
  modseq INTEGER,
  last_sync_at INTEGER,
  sync_phase TEXT NOT NULL DEFAULT 'discovered',
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  is_paused INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, folder_path),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject,
  from_name,
  from_address,
  body_text,
  snippet,
  content='messages',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, from_name, from_address, body_text, snippet)
  VALUES (new.rowid, new.subject, new.from_name, new.from_address, new.body_text, new.snippet);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, from_name, from_address, body_text, snippet)
  VALUES ('delete', old.rowid, old.subject, old.from_name, old.from_address, old.body_text, old.snippet);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, from_name, from_address, body_text, snippet)
  VALUES ('delete', old.rowid, old.subject, old.from_name, old.from_address, old.body_text, old.snippet);
  INSERT INTO messages_fts(rowid, subject, from_name, from_address, body_text, snippet)
  VALUES (new.rowid, new.subject, new.from_name, new.from_address, new.body_text, new.snippet);
END;

-- ─── CRM ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  frequency INTEGER NOT NULL DEFAULT 1,
  last_contacted_at INTEGER,
  first_contacted_at INTEGER,
  notes TEXT,
  engagement_score REAL NOT NULL DEFAULT 0.0,
  last_engaged_at INTEGER,
  health_status TEXT NOT NULL DEFAULT 'cold',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_frequency ON contacts(frequency DESC);

CREATE TABLE IF NOT EXISTS contact_labels (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, name)
);
CREATE INDEX IF NOT EXISTS idx_contact_labels_account ON contact_labels(account_id);

CREATE TABLE IF NOT EXISTS contact_groups (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, name)
);
CREATE INDEX IF NOT EXISTS idx_contact_groups_account ON contact_groups(account_id);

CREATE TABLE IF NOT EXISTS contact_tags (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, name)
);
CREATE INDEX IF NOT EXISTS idx_contact_tags_account ON contact_tags(account_id);

CREATE TABLE IF NOT EXISTS contact_tag_pivot (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_tag_pivot_tag ON contact_tag_pivot(tag_id);

CREATE TABLE IF NOT EXISTS contact_group_pivot (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_group_pivot_group ON contact_group_pivot(group_id);

CREATE TABLE IF NOT EXISTS entity_pivots (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  pivot_type TEXT NOT NULL,
  pivot_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(entity_type, entity_id, pivot_type, pivot_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_pivots_lookup ON entity_pivots(entity_type, entity_id, pivot_type);
CREATE INDEX IF NOT EXISTS idx_entity_pivots_reverse ON entity_pivots(pivot_type, pivot_id);

CREATE TABLE IF NOT EXISTS contact_segments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  is_dynamic INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, name)
);

-- Dynamic segments (legacy — being merged into contact_segments.is_dynamic)
CREATE TABLE IF NOT EXISTS dynamic_segments (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  refreshed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, name)
);

CREATE TABLE IF NOT EXISTS engagement_log (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  score_delta REAL NOT NULL DEFAULT 0.0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_engagement_log_contact ON engagement_log(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_log_type ON engagement_log(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_files (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  category TEXT NOT NULL DEFAULT 'general',
  starred INTEGER NOT NULL DEFAULT 0,
  sender_email TEXT,
  message_id TEXT,
  local_path TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_contact_files_account ON contact_files(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_files_contact ON contact_files(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_files_category ON contact_files(account_id, category);

CREATE VIRTUAL TABLE IF NOT EXISTS contact_files_fts USING fts5(
  filename,
  original_name,
  content='contact_files',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS contact_files_ai AFTER INSERT ON contact_files BEGIN
  INSERT INTO contact_files_fts(rowid, filename, original_name)
  VALUES (new.rowid, new.filename, new.original_name);
END;

CREATE TRIGGER IF NOT EXISTS contact_files_ad AFTER DELETE ON contact_files BEGIN
  INSERT INTO contact_files_fts(contact_files_fts, rowid, filename, original_name)
  VALUES ('delete', old.rowid, old.filename, old.original_name);
END;

CREATE TRIGGER IF NOT EXISTS contact_files_au AFTER UPDATE ON contact_files BEGIN
  INSERT INTO contact_files_fts(contact_files_fts, rowid, filename, original_name)
  VALUES ('delete', old.rowid, old.filename, old.original_name);
  INSERT INTO contact_files_fts(rowid, filename, original_name)
  VALUES (new.rowid, new.filename, new.original_name);
END;

-- ─── Comms ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS filter_rules (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  criteria_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  group_operator TEXT NOT NULL DEFAULT 'AND',
  score_threshold REAL,
  chaining_action TEXT DEFAULT 'stop',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_filter_rules_account ON filter_rules(account_id);

CREATE TABLE IF NOT EXISTS filter_conditions (
  id TEXT PRIMARY KEY,
  filter_id TEXT NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'contains',
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filter_logs (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES filter_rules(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  matched INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0.0,
  applied_actions TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS smart_folders (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Search',
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_smart_folders_account ON smart_folders(account_id);

CREATE TABLE IF NOT EXISTS quick_steps (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  shortcut TEXT,
  actions_json TEXT NOT NULL,
  icon TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  continue_on_error INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_quick_steps_account ON quick_steps(account_id);

CREATE TABLE IF NOT EXISTS quick_replies (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  shortcut TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_account ON quick_replies(account_id);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body_html TEXT NOT NULL,
  shortcut TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_id TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  conditional_blocks_json TEXT,
  template_type TEXT NOT NULL DEFAULT 'email',
  origin TEXT NOT NULL DEFAULT 'user_created',
  delivery_config_json TEXT,
  ai_config_json TEXT,
  voice_config_json TEXT,
  compliance_profile_id TEXT REFERENCES compliance_profiles(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_templates_account ON templates(account_id);

CREATE TABLE IF NOT EXISTS template_categories (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_system INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_categories_account ON template_categories(account_id);

CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body_html TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS send_as_aliases (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  reply_to_address TEXT,
  signature_id TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  treat_as_alias INTEGER NOT NULL DEFAULT 1,
  verification_status TEXT NOT NULL DEFAULT 'accepted',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, email)
);
CREATE INDEX IF NOT EXISTS idx_send_as_account ON send_as_aliases(account_id);

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_addresses TEXT NOT NULL,
  cc_addresses TEXT,
  bcc_addresses TEXT,
  subject TEXT,
  body_html TEXT NOT NULL,
  reply_to_message_id TEXT,
  thread_id TEXT,
  scheduled_at INTEGER NOT NULL,
  signature_id TEXT REFERENCES signatures(id) ON DELETE SET NULL,
  attachment_paths TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_emails(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_account ON scheduled_emails(account_id, scheduled_at);

CREATE TABLE IF NOT EXISTS local_drafts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_addresses TEXT,
  cc_addresses TEXT,
  bcc_addresses TEXT,
  subject TEXT,
  body_html TEXT,
  reply_to_message_id TEXT,
  thread_id TEXT,
  from_email TEXT,
  signature_id TEXT,
  remote_draft_id TEXT,
  attachments TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS composer_presets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  default_reply_mode TEXT NOT NULL DEFAULT 'reply',
  send_and_archive INTEGER NOT NULL DEFAULT 0,
  undo_send_delay INTEGER NOT NULL DEFAULT 10,
  font_family TEXT NOT NULL DEFAULT 'sans-serif',
  font_size INTEGER NOT NULL DEFAULT 14,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_composer_presets_account ON composer_presets(account_id);

CREATE TRIGGER IF NOT EXISTS trg_composer_preset_new_account
AFTER INSERT ON accounts
BEGIN
  INSERT OR IGNORE INTO composer_presets (id, account_id, name, is_default)
  VALUES (NEW.id || '-default', NEW.id, 'Default', 1);
END;

-- ─── AI ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, thread_id, type)
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_cache(account_id, thread_id, type);

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

-- ─── Campaigns ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_contact ON campaign_recipients(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);

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
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_backup_schedules_account ON backup_schedules(account_id);

-- ─── Deliverability ────────────────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_deliv_events_type ON deliverability_events(account_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_bundles (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rules_json TEXT NOT NULL DEFAULT '{}',
  thread_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newsletter_bundles_account ON newsletter_bundles(account_id);

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
CREATE INDEX IF NOT EXISTS idx_blacklist_checks_lookup ON blacklist_checks(account_id, check_type, target);

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
CREATE INDEX IF NOT EXISTS idx_arf_reports_account ON arf_reports(account_id, created_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_warming_log_date ON warming_log(account_id, sent_date DESC);

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
CREATE INDEX IF NOT EXISTS idx_bounces_email ON bounces(recipient_email, bounce_type, bounced_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounces_campaign ON bounces(campaign_id, bounce_type);

CREATE TABLE IF NOT EXISTS suppression_list (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  suppressed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_suppression_email ON suppression_list(account_id, email);

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
CREATE INDEX IF NOT EXISTS idx_unsub_account ON unsubscribe_actions(account_id, status);

-- ─── Security ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pgp_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key_encrypted TEXT,
  passphrase_hint TEXT,
  fingerprint TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, key_id)
);

CREATE TABLE IF NOT EXISTS allowlists (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL,
  target TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, list_type, target)
);

CREATE TABLE IF NOT EXISTS notification_vips (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, email_address)
);
CREATE INDEX IF NOT EXISTS idx_notification_vips ON notification_vips(account_id, email_address);

CREATE TABLE IF NOT EXISTS image_allowlist (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, sender_address)
);
CREATE INDEX IF NOT EXISTS idx_image_allowlist_sender ON image_allowlist(account_id, sender_address);

CREATE TABLE IF NOT EXISTS phishing_allowlist (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, sender_address)
);

CREATE TABLE IF NOT EXISTS link_scan_results (
  message_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  scanned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (account_id, message_id)
);

-- ─── Workflows ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_rules (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_conditions TEXT,
  actions TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_account ON workflow_rules(account_id);

CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  remind_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (account_id, thread_id) REFERENCES threads(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_followup_status ON follow_up_reminders(status, remind_at);
CREATE INDEX IF NOT EXISTS idx_followup_thread ON follow_up_reminders(account_id, thread_id);

CREATE TABLE IF NOT EXISTS pending_operations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_pending_ops_status ON pending_operations(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_pending_ops_resource ON pending_operations(account_id, resource_id);

-- ─── Calendar ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  remote_id TEXT NOT NULL,
  display_name TEXT,
  color TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  sync_token TEXT,
  ctag TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, remote_id)
);
CREATE INDEX IF NOT EXISTS idx_calendars_account ON calendars(account_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  calendar_id TEXT REFERENCES calendars(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  remote_event_id TEXT,
  summary TEXT,
  description TEXT,
  location TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_all_day INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  organizer_email TEXT,
  attendees_json TEXT,
  html_link TEXT,
  etag TEXT,
  ical_data TEXT,
  uid TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, google_event_id)
);
CREATE INDEX IF NOT EXISTS idx_cal_events_time ON calendar_events(account_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_cal_events_calendar ON calendar_events(calendar_id);

CREATE TABLE IF NOT EXISTS snooze_presets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_snooze_presets_account ON snooze_presets(account_id);

-- ─── Tasks ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(is_completed, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_thread ON tasks(thread_account_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks(sort_order);

-- Task tags
CREATE TABLE IF NOT EXISTS task_tags (
  tag TEXT NOT NULL,
  account_id TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (tag, account_id)
);

-- ─── Compliance ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_profiles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  region_hint TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS compliance_checks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_draft_id TEXT REFERENCES local_drafts(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  profile_ids TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 100,
  violations_json TEXT,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_account ON compliance_checks(account_id, checked_at DESC);

-- ─── Migration tracking ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  description TEXT,
  applied_at INTEGER DEFAULT (unixepoch())
);
