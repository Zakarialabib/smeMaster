-- Mail: labels, threads, messages, attachments, FTS, folders
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
  unsubscribe_status TEXT DEFAULT 'not_processed',
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
  PRIMARY KEY (account_id, folder_path),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject, from_name, from_address, body_text, snippet,
  content='messages', content_rowid='rowid', tokenize='trigram'
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

-- Folder sync states, filters, smart folders, quick steps, replies, signatures
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

CREATE TRIGGER IF NOT EXISTS trg_composer_preset_new_account
AFTER INSERT ON accounts
BEGIN
  INSERT OR IGNORE INTO composer_presets (id, account_id, name, is_default)
  VALUES (NEW.id || '-default', NEW.id, 'Default', 1);
END;

-- Templates (shared between mail and campaigns)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  compliance_profile_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS template_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
