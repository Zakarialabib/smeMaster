-- Calendar: calendars, events, snooze presets
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  UNIQUE(company_id, remote_id)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
  UNIQUE(company_id, google_event_id)
);

CREATE TABLE IF NOT EXISTS snooze_presets (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
