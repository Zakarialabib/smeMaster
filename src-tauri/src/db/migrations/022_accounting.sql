-- 022_accounting.sql
-- ERP double-entry ledger: chart of accounts + journal entries.

CREATE TABLE chart_of_accounts (
    id           TEXT PRIMARY KEY,
    company_id   TEXT NOT NULL,
    code         TEXT NOT NULL,
    name         TEXT NOT NULL,
    account_type TEXT NOT NULL,           -- asset | liability | equity | revenue | expense
    normal_balance TEXT NOT NULL DEFAULT 'debit', -- debit | credit
    parent_id    TEXT,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_coa_company ON chart_of_accounts(company_id);

CREATE TABLE journal_entries (
    id           TEXT PRIMARY KEY,
    company_id   TEXT NOT NULL,
    entry_date   INTEGER NOT NULL,
    reference    TEXT,                       -- e.g. invoice id
    description  TEXT,
    account_id   TEXT NOT NULL,
    debit        INTEGER NOT NULL DEFAULT 0,
    credit       INTEGER NOT NULL DEFAULT 0,
    currency     TEXT NOT NULL DEFAULT 'MAD',
    created_at   INTEGER NOT NULL
);
CREATE INDEX idx_je_company ON journal_entries(company_id);
CREATE INDEX idx_je_reference ON journal_entries(reference);
