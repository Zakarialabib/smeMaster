-- 023_wallet: company cash wallet (the cash hub for the ERP).
-- Every sale invoice payment credits it and every expense/bill payment
-- debits it; the balance stays in sync with the ledger's Cash account.

CREATE TABLE wallets (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MAD',
    balance INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_wallets_company ON wallets(company_id);
