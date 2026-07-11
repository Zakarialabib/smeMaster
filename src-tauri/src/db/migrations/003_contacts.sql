-- Contacts, groups, segments, engagement
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS contact_groups (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS contact_tags (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS contact_tag_pivot (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES contact_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS contact_group_pivot (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, group_id)
);

CREATE TABLE IF NOT EXISTS entity_pivots (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  pivot_type TEXT NOT NULL,
  pivot_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(entity_type, entity_id, pivot_type, pivot_id)
);

CREATE TABLE IF NOT EXISTS contact_segments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  is_dynamic INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS dynamic_segments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  refreshed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS engagement_log (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  score_delta REAL NOT NULL DEFAULT 0.0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS contact_files (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

CREATE VIRTUAL TABLE IF NOT EXISTS contact_files_fts USING fts5(
  filename, original_name,
  content='contact_files', content_rowid='rowid', tokenize='trigram'
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
