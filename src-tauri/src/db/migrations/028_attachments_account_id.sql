-- Attachments drift fix.
--
-- The user's existing databases were created by an older 002_mail.sql whose
-- `attachments` table did not include `account_id` (and the indexes that
-- reference it). A later edit to 002_mail.sql added `account_id` + those
-- indexes, but migrations only run forward, so already-created databases keep
-- the old shape. Queries such as the unified-search `has:attachment` filter
-- reference `attachments.account_id` and fail with "no such column: account_id".
--
-- Fresh installs already get `account_id` from 002_mail.sql, so the ALTER below
-- is a no-op there (the runner tolerates the resulting "duplicate column"
-- error). For older databases it back-fills the missing column.

ALTER TABLE attachments ADD COLUMN account_id TEXT NOT NULL DEFAULT '';

-- Re-create the indexes that the newer 002_mail.sql defines on attachments.
-- They are missing on older databases; IF NOT EXISTS keeps this safe to re-run.
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(account_id, message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_cid ON attachments(content_id);
