-- Security: PGP keys, allowlists, VIPs, phishing, link scan
CREATE TABLE IF NOT EXISTS pgp_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
   private_key_encrypted TEXT,
   passphrase_hint TEXT,
   fingerprint TEXT,
   user_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, key_id)
);

CREATE TABLE IF NOT EXISTS allowlists (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL,
  target TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(account_id, list_type, target)
);

CREATE TABLE IF NOT EXISTS notification_vips (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, email_address)
);

CREATE TABLE IF NOT EXISTS image_allowlist (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, sender_address)
);

CREATE TABLE IF NOT EXISTS phishing_allowlist (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sender_address TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(account_id, sender_address)
);

CREATE TABLE IF NOT EXISTS link_scan_results (
  message_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  scanned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (account_id, message_id)
);
