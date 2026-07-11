-- Suggestions: Email-to-Contact/Deal automation suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'new_contact' | 'create_deal'
  source_email_id TEXT, -- Reference to the email that triggered this suggestion
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  subject TEXT,
  snippet TEXT,
  suggested_contact_name TEXT,
  suggested_deal_title TEXT,
  suggested_deal_value REAL,
  suggested_deal_currency TEXT DEFAULT 'USD',
  deal_keywords_matched TEXT, -- JSON array of matched keywords
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'dismissed'
  dismissed_at INTEGER,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_suggestions_company ON suggestions(company_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_sender ON suggestions(sender_email);
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS trg_suggestions_updated
AFTER UPDATE ON suggestions
BEGIN
  UPDATE suggestions SET updated_at = unixepoch() WHERE id = NEW.id;
END;