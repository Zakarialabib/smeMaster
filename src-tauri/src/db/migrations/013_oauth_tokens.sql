-- v15: OAuth tokens table
-- accounts.provider_type and accounts.sync_state are now in 001_core.sql

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at INTEGER NOT NULL,
    scope TEXT NOT NULL DEFAULT 'https://mail.google.com/',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    refreshed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_account ON oauth_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
