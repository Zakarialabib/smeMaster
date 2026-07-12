-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTACTS UNIFICATION — make `contacts` the single source of truth for people
-- (CRM contacts + invoicing clients/suppliers). Clients are migrated INTO
-- contacts (preserving their ids so existing invoice FKs stay valid), then the
-- legacy `clients` table is dropped and `invoices.client_id` is re-pointed to
-- `contacts(id)`.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Extend contacts with the type discriminator + invoicing fields.
ALTER TABLE contacts ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'contact'
  CHECK (contact_type IN ('contact', 'client', 'supplier', 'other'));
ALTER TABLE contacts ADD COLUMN phone TEXT;
ALTER TABLE contacts ADD COLUMN address TEXT;
ALTER TABLE contacts ADD COLUMN city TEXT;
ALTER TABLE contacts ADD COLUMN country TEXT DEFAULT 'MA';
ALTER TABLE contacts ADD COLUMN tax_id TEXT;
ALTER TABLE contacts ADD COLUMN credit_limit INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN payment_terms INTEGER DEFAULT 30;
ALTER TABLE contacts ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at);

-- 2. Migrate existing clients -> contacts (same id keeps invoice FKs valid).
--    role mapping: customer/both -> 'client', supplier -> 'supplier'.
INSERT INTO contacts (
    id, company_id, email, display_name, phone, address, city, country,
    tax_id, contact_type, credit_limit, payment_terms, notes,
    frequency, engagement_score, health_status, created_at, updated_at, deleted_at
)
SELECT
    c.id,
    c.company_id,
    COALESCE(c.email, ''),
    c.name,
    c.phone,
    c.address,
    c.city,
    COALESCE(c.country, 'MA'),
    c.tax_id,
    CASE c.role WHEN 'supplier' THEN 'supplier' ELSE 'client' END,
    COALESCE(c.credit_limit, 0),
    COALESCE(c.payment_terms, 30),
    c.notes,
    1,
    0.0,
    'cold',
    COALESCE(c.created_at, datetime('now')),
    COALESCE(c.updated_at, datetime('now')),
    c.deleted_at
FROM clients c
WHERE NOT EXISTS (SELECT 1 FROM contacts WHERE contacts.id = c.id);

-- 3. Rebuild `invoices` so client_id references contacts(id) instead of clients(id).
CREATE TABLE invoices_new (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('invoice', 'delivery_bill', 'shipping_print')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'cancelled')),
    client_id TEXT NOT NULL REFERENCES contacts(id),
    client_role TEXT,
    document_number TEXT NOT NULL,
    prefix TEXT,
    suffix TEXT,
    date TEXT DEFAULT (date('now')),
    due_date TEXT,
    currency TEXT DEFAULT 'MAD',
    currency_symbol TEXT DEFAULT 'DH',
    symbol_position TEXT DEFAULT 'after',
    decimal_places INTEGER DEFAULT 2,
    tax_rate REAL DEFAULT 20,
    subtotal INTEGER DEFAULT 0,
    discount_total INTEGER DEFAULT 0,
    tax_amount INTEGER DEFAULT 0,
    shipping INTEGER DEFAULT 0,
    grand_total INTEGER DEFAULT 0,
    paid_amount INTEGER DEFAULT 0,
    balance_due INTEGER DEFAULT 0,
    notes TEXT,
    terms TEXT,
    footer_text TEXT,
    template_id TEXT,
    peppol_xml_path TEXT,
    pdf_path TEXT,
    company_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT,
    UNIQUE(company_id, document_number)
);

INSERT INTO invoices_new (
    id, type, status, client_id, client_role, document_number, prefix, suffix,
    date, due_date, currency, currency_symbol, symbol_position, decimal_places,
    tax_rate, subtotal, discount_total, tax_amount, shipping, grand_total,
    paid_amount, balance_due, notes, terms, footer_text, template_id,
    peppol_xml_path, pdf_path, company_id, created_by, created_at, updated_at, deleted_at
)
SELECT
    id, type, status, client_id, client_role, document_number, prefix, suffix,
    date, due_date, currency, currency_symbol, symbol_position, decimal_places,
    tax_rate, subtotal, discount_total, tax_amount, shipping, grand_total,
    paid_amount, balance_due, notes, terms, footer_text, template_id,
    peppol_xml_path, pdf_path, company_id, created_by, created_at, updated_at, deleted_at
FROM invoices;

DROP TABLE invoices;
ALTER TABLE invoices_new RENAME TO invoices;

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(document_number);

-- 4. Drop the legacy clients table (data now lives in contacts).
DROP TABLE clients;
