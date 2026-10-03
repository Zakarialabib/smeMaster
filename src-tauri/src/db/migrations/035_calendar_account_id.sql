-- Calendar: add account_id column for unified search support.
-- Fresh installs already get account_id from the CREATE TABLE IF NOT EXISTS
-- pattern in 009_calendar.sql (if added there), so this is a no-op there.
-- For older databases it back-fills the missing column.

ALTER TABLE calendars ADD COLUMN account_id TEXT NOT NULL DEFAULT '';
ALTER TABLE calendar_events ADD COLUMN account_id TEXT NOT NULL DEFAULT '';
ALTER TABLE snooze_presets ADD COLUMN account_id TEXT NOT NULL DEFAULT '';