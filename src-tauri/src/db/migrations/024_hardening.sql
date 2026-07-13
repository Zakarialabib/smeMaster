-- 024_hardening: production-correctness gaps for templates, scheduled_emails, calendar.
-- Additive only: new columns via ALTER, new indexes, new tables. No destructive changes.
-- (SQLite cannot ADD a FOREIGN KEY to an existing column; category ownership is
--  enforced in Rust — see PRODUCTION_HARDENING_PLAN.md Phase 2.)

-- ── Templates ──────────────────────────────────────────────────────────────
ALTER TABLE templates ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch());
CREATE INDEX idx_templates_company_fav ON templates(company_id, is_favorite);
CREATE INDEX idx_templates_company_sort ON templates(company_id, sort_order);
CREATE UNIQUE INDEX idx_template_categories_company_name
    ON template_categories(company_id, name);

-- ── Scheduled emails (the "schedule" dispatcher needs these) ───────────────
ALTER TABLE scheduled_emails ADD COLUMN sent_at INTEGER;
ALTER TABLE scheduled_emails ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scheduled_emails ADD COLUMN last_error TEXT;
-- Dispatcher scan: pick rows due to send.
CREATE INDEX idx_scheduled_emails_due ON scheduled_emails(status, scheduled_at);

-- ── Calendar events: recurrence + provider-agnostic remote id ───────────────
ALTER TABLE calendar_events ADD COLUMN rrule TEXT;
ALTER TABLE calendar_events ADD COLUMN timezone TEXT;
ALTER TABLE calendar_events ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE calendar_events ADD COLUMN recurrence_id TEXT;
ALTER TABLE calendar_events ADD COLUMN remote_event_id TEXT;
CREATE INDEX idx_calendar_events_cal_start ON calendar_events(calendar_id, start_time);

-- Generic remote id so non-Google providers (CalDAV/Outlook) can coexist.
-- NOTE: the legacy UNIQUE(company_id, google_event_id) stays for Google back-compat;
-- provider-agnostic uniqueness is enforced in Rust until a table rebuild is done.
UPDATE calendar_events SET remote_event_id = google_event_id WHERE remote_event_id IS NULL;

-- ── Per-attendee + reminders (were opaque JSON / missing) ───────────────────
CREATE TABLE IF NOT EXISTS event_attendees (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    status TEXT NOT NULL DEFAULT 'needs-action', -- needs-action | accepted | declined | tentative
    optional INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_event_attendees_event ON event_attendees(event_id);

CREATE TABLE IF NOT EXISTS event_reminders (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    minutes_before INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'popup', -- popup | email
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_event_reminders_event ON event_reminders(event_id);

-- ── Calendars: store the calendar's timezone ───────────────────────────────
ALTER TABLE calendars ADD COLUMN timezone TEXT;
