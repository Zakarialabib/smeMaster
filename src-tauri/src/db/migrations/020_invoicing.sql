-- ═══════════════════════════════════════════════════════════════════════════════
-- INVOICING — Full Billing/ERP Schema: Clients, Items, Invoices, Settings
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add Morocco-specific legal identifiers to companies table
ALTER TABLE companies ADD COLUMN ice TEXT;
ALTER TABLE companies ADD COLUMN tax_id TEXT;
ALTER TABLE companies ADD COLUMN rc TEXT;
ALTER TABLE companies ADD COLUMN cnss TEXT;

-- 2. Clients (customers AND suppliers)
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'MA',
    tax_id TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'supplier', 'both')),
    credit_limit INTEGER DEFAULT 0,
    payment_terms INTEGER DEFAULT 30,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);

-- 3. Items (products and services catalog)
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'product' CHECK (type IN ('product', 'service')),
    sku TEXT,
    category_id TEXT,
    unit TEXT DEFAULT 'pc',
    buy_price INTEGER DEFAULT 0,
    sell_price INTEGER DEFAULT 0,
    stock_qty REAL DEFAULT 0,
    stock_alert REAL DEFAULT 0,
    tax_rate REAL DEFAULT 20,
    barcode TEXT,
    image_url TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 4. Invoices / Documents (multi-document type)
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('invoice', 'delivery_bill', 'shipping_print')),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'cancelled')),
    client_id TEXT NOT NULL REFERENCES clients(id),
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
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(document_number);

-- 5. Invoice Items / Document Lines
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_id TEXT,
    description TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'pc',
    unit_price INTEGER NOT NULL DEFAULT 0,
    tax_rate REAL DEFAULT 20,
    tax_amount INTEGER DEFAULT 0,
    line_total INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 6. Company Settings (per-tenant config)
CREATE TABLE IF NOT EXISTS company_settings (
    company_id TEXT PRIMARY KEY,
    default_currency TEXT DEFAULT 'MAD',
    default_tax_rate REAL DEFAULT 20,
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_suffix TEXT DEFAULT '',
    quote_prefix TEXT DEFAULT 'QUO-',
    default_template_id TEXT,
    logo_url TEXT,
    signature_text TEXT,
    bank_details TEXT,
    terms_default TEXT,
    theme_color TEXT DEFAULT '#CE422B',
    units_enabled TEXT DEFAULT '["pc","kg","m","hr"]',
    tax_position TEXT DEFAULT 'excluded',
    decimal_places INTEGER DEFAULT 2,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 7. Categories (lightweight item lookup)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
