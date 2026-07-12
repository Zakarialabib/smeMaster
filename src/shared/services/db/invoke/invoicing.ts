import { invokeCommand } from './command';
import type { Invoice, InvoiceWithItems, Client, Item, Company, CompanySetting, Category, ErpAccount, JournalEntry, PnlResult, Wallet } from '../schema';

export async function listInvoices(companyId: string, typeFilter?: string, statusFilter?: string): Promise<Invoice[]> {
  return invokeCommand<Invoice[]>('db_list_invoices', { companyId, typeFilter: typeFilter ?? null, statusFilter: statusFilter ?? null });
}

export async function getInvoice(id: string): Promise<Invoice> {
  return invokeCommand<Invoice>('db_get_invoice', { id });
}

export async function getInvoiceWithItems(invoiceId: string): Promise<InvoiceWithItems> {
  return invokeCommand<InvoiceWithItems>('db_get_invoice_with_items', { invoiceId });
}

export async function createInvoice(req: {
  companyId: string;
  clientId: string;
  documentType: string;
  invoiceNumber: string;
  issueDate: number;
  dueDate?: number | null;
  currency: string;
  notes?: string | null;
  itemsReq: Array<{ description: string; qty: number; unit: string; unitPrice: number; taxRate: number; sortOrder: number }>;
}): Promise<Invoice> {
  return invokeCommand<Invoice>('db_create_invoice', { ...req, dueDate: req.dueDate ?? null, notes: req.notes ?? null });
}

export async function updateInvoice(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_invoice` takes individual Option params (no `fields` blob).
  // `issue_date` maps to Rust `date`; `document_type`/`invoice_number` are not
  // server-updatable yet (backend gap, tracked in STATUS.md).
  return invokeCommand<void>('db_update_invoice', {
    id,
    notes: (fields.notes ?? null) as string | null | undefined,
    date: (fields.issue_date ?? null) as number | null | undefined,
    due_date: (fields.due_date ?? null) as number | null | undefined,
    currency: fields.currency as string | undefined,
    client_id: (fields.client_id ?? null) as string | null | undefined,
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_invoice', { id });
}

export async function addInvoiceItem(invoiceId: string, description: string, qty: number, unit: string, unitPrice: number, taxRate: number, sortOrder: number): Promise<void> {
  return invokeCommand<void>('db_add_invoice_item', { invoiceId, description, qty, unit, unitPrice, taxRate, sortOrder });
}

export async function removeInvoiceItem(invoiceId: string, itemId: string): Promise<void> {
  return invokeCommand<void>('db_remove_invoice_item', { invoiceId, itemId });
}

export async function updateInvoiceStatus(id: string, status: string): Promise<void> {
  return invokeCommand<void>('db_update_invoice_status', { id, status });
}

export async function listClients(companyId: string): Promise<Client[]> {
  return invokeCommand<Client[]>('db_list_clients', { companyId });
}

export async function getClient(id: string): Promise<Client> {
  return invokeCommand<Client>('db_get_client', { id });
}

export async function createClient(data: { companyId: string; name: string; email?: string | null; phone?: string | null; address?: string | null; city?: string | null; country?: string; taxId?: string | null; role?: string; creditLimit?: number; paymentTerms?: number; notes?: string | null }): Promise<Client> {
  return invokeCommand<Client>('db_create_client', { ...data });
}

export async function updateClient(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_client` takes individual Option params (no `fields` blob).
  return invokeCommand<void>('db_update_client', { id, ...fields });
}

export async function deleteClient(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_client', { id });
}

// ── Company Settings ──────────────────────────────────────────────────

export async function getCompanySettings(companyId: string): Promise<CompanySetting | null> {
  return invokeCommand<CompanySetting | null>('db_get_company_settings', { companyId });
}

export async function upsertCompanySettings(companyId: string, fields: Record<string, unknown>): Promise<CompanySetting> {
  return invokeCommand<CompanySetting>('db_upsert_company_settings', { companyId, ...fields });
}

export async function deleteCompanySettings(companyId: string): Promise<void> {
  return invokeCommand<void>('db_delete_company_settings', { companyId });
}

// ── Categories ────────────────────────────────────────────────────────

export async function listCategories(companyId: string): Promise<Category[]> {
  return invokeCommand<Category[]>('db_list_categories', { companyId });
}

export async function getCategory(id: string): Promise<Category> {
  return invokeCommand<Category>('db_get_category', { id });
}

export async function createCategory(name: string, companyId: string): Promise<Category> {
  return invokeCommand<Category>('db_create_category', { name, companyId });
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  return invokeCommand<Category>('db_update_category', { id, name });
}

export async function deleteCategory(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_category', { id });
}

export async function listItems(companyId: string): Promise<Item[]> {
  return invokeCommand<Item[]>('db_list_items', { companyId });
}

export async function getItem(id: string): Promise<Item> {
  return invokeCommand<Item>('db_get_item', { id });
}

export async function createItem(data: { companyId: string; name: string; description?: string | null; type?: string; sku?: string | null; categoryId?: string | null; unit?: string; sellPrice?: number; taxRate?: number; barcode?: string | null }): Promise<Item> {
  // Rust `db_create_item` expects `item_type` (not `type`) and requires
  // buy_price / stock_qty / stock_alert. The UI only collects sell price,
  // so stock fields default to 0 here (backend gap, tracked in STATUS.md).
  return invokeCommand<Item>('db_create_item', {
    name: data.name,
    description: data.description ?? null,
    item_type: data.type ?? "product",
    sku: data.sku ?? null,
    unit: data.unit ?? "unit",
    buy_price: 0,
    sell_price: data.sellPrice ?? 0,
    stock_qty: 0,
    stock_alert: 0,
    tax_rate: data.taxRate ?? 0,
    barcode: data.barcode ?? null,
    company_id: data.companyId,
  });
}

export async function updateItem(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_item` takes individual Option params (no `fields` blob).
  // `type` maps to Rust `item_type`.
  return invokeCommand<void>('db_update_item', {
    id,
    name: fields.name as string | undefined,
    description: (fields.description ?? null) as string | null | undefined,
    item_type: fields.type as string | undefined,
    sku: (fields.sku ?? null) as string | null | undefined,
    unit: fields.unit as string | undefined,
    buy_price: fields.buyPrice as number | undefined,
    sell_price: fields.sellPrice as number | undefined,
    stock_qty: fields.stockQty as number | undefined,
    stock_alert: fields.stockAlert as number | undefined,
    tax_rate: fields.taxRate as number | undefined,
    barcode: (fields.barcode ?? null) as string | null | undefined,
  });
}

export async function deleteItem(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_item', { id });
}

export async function getCompany(companyId: string): Promise<Company> {
  return invokeCommand<Company>('db_get_company', { companyId });
}

export async function updateCompany(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_company` takes `company_id` (not `id`) + individual Option params.
  return invokeCommand<void>('db_update_company', { company_id: id, ...fields });
}

export async function generateInvoiceDocuments(invoiceId: string): Promise<[string, string]> {
  return invokeCommand<[string, string]>('db_generate_invoice_documents', { invoiceId });
}

export async function sendInvoice(invoiceId: string, to: string): Promise<void> {
  // Real delivery: builds the Peppol XML + PDF, dispatches over SMTP (with
  // optional PGP encryption when a key exists for the recipient), then marks
  // the invoice `sent` and posts it to the ledger + adjusts stock.
  return invokeCommand<void>('db_send_invoice', { invoiceId, to });
}

export async function calculateInvoice(invoiceId: string): Promise<Invoice> {
  return invokeCommand<Invoice>('db_calculate_invoice', { invoiceId });
}

// ── ERP · Accounting (double-entry ledger) ──────────────────────────────

/** Seed the standard chart of accounts for a company (idempotent). */
export async function ensureChartOfAccounts(companyId: string): Promise<void> {
  return invokeCommand<void>('db_ensure_chart_of_accounts', { companyId });
}

/** List a company's chart of accounts. */
export async function listChartOfAccounts(companyId: string): Promise<ErpAccount[]> {
  return invokeCommand<ErpAccount[]>('db_list_chart_of_accounts', { companyId });
}

/** List a company's journal entries (chronological). */
export async function listJournalEntries(companyId: string): Promise<JournalEntry[]> {
  return invokeCommand<JournalEntry[]>('db_list_journal_entries', { companyId });
}

/** Manually post an invoice to the ledger (usually done automatically on send). */
export async function postInvoiceJournal(invoiceId: string): Promise<void> {
  return invokeCommand<void>('db_post_invoice_journal', { invoiceId });
}

/** Compute profit & loss for a company. */
export async function getProfitAndLoss(companyId: string): Promise<PnlResult> {
  return invokeCommand<PnlResult>('db_get_profit_and_loss', { companyId });
}

/** List items at or below their reorder alert level. */
export async function listLowStock(companyId: string): Promise<Item[]> {
  return invokeCommand<Item[]>('db_list_low_stock', { companyId });
}

// ── ERP · Wallet (company cash hub) ────────────────────────────────────

/** Ensure a wallet exists for a company (creates one if missing). */
export async function ensureWallet(companyId: string): Promise<Wallet> {
  return invokeCommand<Wallet>('db_ensure_wallet', { companyId });
}

/** Fetch the company wallet, creating it on demand if it does not exist. */
export async function getWallet(companyId: string): Promise<Wallet> {
  return invokeCommand<Wallet>('db_get_wallet', { companyId });
}

/** Top up the wallet (cash in). Books a Dr Cash / Cr Equity journal entry. */
export async function creditWallet(
  companyId: string,
  amount: number,
  reference?: string | null,
  description?: string | null,
): Promise<Wallet> {
  return invokeCommand<Wallet>('db_credit_wallet', {
    companyId,
    amount,
    reference: reference ?? null,
    description: description ?? null,
  });
}

/** Withdraw from the wallet (cash out). Books a Dr Equity / Cr Cash entry. */
export async function debitWallet(
  companyId: string,
  amount: number,
  reference?: string | null,
  description?: string | null,
): Promise<Wallet> {
  return invokeCommand<Wallet>('db_debit_wallet', {
    companyId,
    amount,
    reference: reference ?? null,
    description: description ?? null,
  });
}
