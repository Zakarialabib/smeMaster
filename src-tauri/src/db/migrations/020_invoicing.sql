-- ═══════════════════════════════════════════════════════════════════════════════
-- INVOICING — Invoices, Line Items, Legal Identifiers
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Add Morocco-specific legal identifiers to companies table
ALTER TABLE companies ADD COLUMN ice TEXT;
ALTER TABLE companies ADD COLUMN tax_id TEXT;
ALTER TABLE companies ADD COLUMN rc TEXT;
ALTER TABLE companies ADD COLUMN cnss TEXT;

-- 2. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL DEFAULT 'invoice' CHECK(document_type IN ('invoice', 'delivery_bill', 'shipping_print')),
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date INTEGER NOT NULL,
  due_date INTEGER,
  currency TEXT NOT NULL DEFAULT 'MAD',
  subtotal REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  peppol_xml_path TEXT,
  pdf_path TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- 3. Invoice Items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 20.0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
