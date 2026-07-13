-- Automation Actions: is_flagged column for messages + message_labels table
-- These tables enable the workflow action handlers to persist real state.

-- Add is_flagged column to messages (for "flag" automation action)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check at runtime
-- in the automation engine before using this column.
ALTER TABLE messages ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0;

-- Track message-to-label associations for "apply_label" automation action
CREATE TABLE IF NOT EXISTS message_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    applied_by TEXT NOT NULL DEFAULT 'automation',
    applied_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (account_id, message_id) REFERENCES messages(account_id, id) ON DELETE CASCADE,
    FOREIGN KEY (account_id, label_id) REFERENCES labels(account_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_labels_msg ON message_labels(account_id, message_id);
CREATE INDEX IF NOT EXISTS idx_message_labels_label ON message_labels(account_id, label_id);
