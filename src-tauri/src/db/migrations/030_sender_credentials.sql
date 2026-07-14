-- Sender verification credentials: stores SPF/DKIM/DMARC verification tokens
-- and status for sender identities (domains/emails) per account/company.
-- Used by the deliverability module to persist verification state across sessions.

CREATE TABLE IF NOT EXISTS sender_credentials (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    account_id TEXT,
    email TEXT NOT NULL,
    verification_type TEXT NOT NULL,  -- spf | dkim | dmarc
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | failed
    token TEXT,
    verified_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sender_credentials_account ON sender_credentials(account_id);
CREATE INDEX IF NOT EXISTS idx_sender_credentials_company ON sender_credentials(company_id);
CREATE INDEX IF NOT EXISTS idx_sender_credentials_email ON sender_credentials(email);
