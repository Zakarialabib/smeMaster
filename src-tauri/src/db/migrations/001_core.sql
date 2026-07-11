-- ═══════════════════════════════════════════════════════════════════════════════
-- CORE — Companies, Accounts, App Config
-- ═══════════════════════════════════════════════════════════════════════════════
-- Domain model:
--   companies  →  the business entity (core)
--   accounts   →  email configurations belonging to a company
--   settings   →  app-level key-value store
--   app_config →  app configuration (onboarding, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  website TEXT,
  industry TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  logo_url TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  history_id TEXT,
  last_sync_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'imap_smtp',
  provider_type TEXT DEFAULT 'imap_smtp' CHECK(provider_type IN ('gmail_api', 'microsoft_graph', 'jmap', 'imap_smtp')),
  sync_state TEXT NOT NULL DEFAULT 'idle' CHECK(sync_state IN ('idle', 'syncing', 'error', 'backoff')),
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
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
