import { invokeCommand } from './command';
import type {
  Invoice,
  InvoiceWithItems,
  Client,
  Item,
  Company,
  CompanySetting,
  Category,
  ErpAccount,
  JournalEntry,
  PnlResult,
  Wallet,
} from '../schema';

export async function listInvoices(
  companyId: string,
  typeFilter?: string,
  statusFilter?: string,
): Promise<Invoice[]> {
  return invokeCommand<Invoice[]>('db_list_invoices', {
    companyId,
    typeFilter: typeFilter ?? null,
    statusFilter: statusFilter ?? null,
  });
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
  itemsReq: Array<{
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    taxRate: number;
    sortOrder: number;
  }>;
}): Promise<Invoice> {
  return invokeCommand<Invoice>('db_create_invoice', {
    ...req,
    dueDate: req.dueDate ?? null,
    notes: req.notes ?? null,
  });
}

export async function updateInvoice(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_invoice` takes individual Option params (no `fields` blob).
  // Wire format is camelCase (see CommandRegistry): `date` is the issue date,
  // `dueDate`/`clientId` are camelCase. Snake_case aliases are accepted for
  // backward compatibility. `document_type`/`invoice_number` are not
  // server-updatable yet (backend gap, tracked in STATUS.md).
  return invokeCommand<void>('db_update_invoice', {
    id,
    status: (fields.status ?? null) as string | null | undefined,
    notes: (fields.notes ?? null) as string | null | undefined,
    date: (fields.date ?? fields.issueDate ?? fields.issue_date ?? null) as
      number | null | undefined,
    dueDate: (fields.dueDate ?? fields.due_date ?? null) as number | null | undefined,
    currency: fields.currency as string | undefined,
    clientId: (fields.clientId ?? fields.client_id ?? null) as string | null | undefined,
    items: (fields.items ?? null) as
      | Array<{
          description: string;
          qty: number;
          unit?: string | null;
          unitPrice: number;
          taxRate: number;
          sortOrder: number;
        }>
      | null
      | undefined,
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_invoice', { id });
}

export async function addInvoiceItem(
  invoiceId: string,
  description: string,
  qty: number,
  unit: string,
  unitPrice: number,
  taxRate: number,
  sortOrder: number,
): Promise<void> {
  return invokeCommand<void>('db_add_invoice_item', {
    invoiceId,
    description,
    qty,
    unit,
    unitPrice,
    taxRate,
    sortOrder,
  });
}

export async function removeInvoiceItem(invoiceId: string, itemId: string): Promise<void> {
  // Rust `db_remove_invoice_item` takes only `itemId` (it resolves the parent
  // invoice itself). `invoiceId` is kept in the signature for caller
  // compatibility but is not sent over the wire.
  void invoiceId;
  return invokeCommand<void>('db_remove_invoice_item', { itemId });
}

export async function updateInvoiceStatus(id: string, status: string): Promise<void> {
  return invokeCommand<void>('db_update_invoice_status', { id, status });
}

export async function listClients(companyId: string, role?: string | null): Promise<Client[]> {
  return invokeCommand<Client[]>('db_list_clients', { companyId, role: role ?? null });
}

export async function getClient(id: string): Promise<Client> {
  return invokeCommand<Client>('db_get_client', { id });
}

export async function createClient(data: {
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string;
  taxId?: string | null;
  role?: string;
  creditLimit?: number;
  paymentTerms?: number;
  notes?: string | null;
}): Promise<Client> {
  return invokeCommand<Client>('db_create_client', { ...data });
}

export async function updateClient(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_client` takes individual Option params (no `fields` blob).
  // Wire format is camelCase (see CommandRegistry); snake_case aliases are
  // accepted for backward compatibility.
  return invokeCommand<void>('db_update_client', {
    id,
    name: (fields.name ?? null) as string | null | undefined,
    email: (fields.email ?? null) as string | null | undefined,
    phone: (fields.phone ?? null) as string | null | undefined,
    address: (fields.address ?? null) as string | null | undefined,
    city: (fields.city ?? null) as string | null | undefined,
    country: (fields.country ?? null) as string | null | undefined,
    taxId: (fields.taxId ?? fields.tax_id ?? null) as string | null | undefined,
    role: (fields.role ?? null) as string | null | undefined,
    creditLimit: (fields.creditLimit ?? fields.credit_limit ?? null) as number | null | undefined,
    paymentTerms: (fields.paymentTerms ?? fields.payment_terms ?? null) as
      number | null | undefined,
    notes: (fields.notes ?? null) as string | null | undefined,
  });
}

export async function deleteClient(id: string, hard?: boolean | null): Promise<void> {
  return invokeCommand<void>('db_delete_client', { id, hard: hard ?? null });
}

// ── Company Settings ──────────────────────────────────────────────────

export async function getCompanySettings(companyId: string): Promise<CompanySetting | null> {
  return invokeCommand<CompanySetting | null>('db_get_company_settings', { companyId });
}

export async function upsertCompanySettings(
  companyId: string,
  fields: Record<string, unknown>,
): Promise<CompanySetting> {
  // Wire format is camelCase (see CommandRegistry); snake_case aliases are
  // accepted for backward compatibility.
  return invokeCommand<CompanySetting>('db_upsert_company_settings', {
    companyId,
    defaultCurrency: (fields.defaultCurrency ?? fields.default_currency ?? null) as
      string | null | undefined,
    defaultTaxRate: (fields.defaultTaxRate ?? fields.default_tax_rate ?? null) as
      number | null | undefined,
    invoicePrefix: (fields.invoicePrefix ?? fields.invoice_prefix ?? null) as
      string | null | undefined,
    invoiceSuffix: (fields.invoiceSuffix ?? fields.invoice_suffix ?? null) as
      string | null | undefined,
    quotePrefix: (fields.quotePrefix ?? fields.quote_prefix ?? null) as string | null | undefined,
    defaultTemplateId: (fields.defaultTemplateId ?? fields.default_template_id ?? null) as
      string | null | undefined,
    logoUrl: (fields.logoUrl ?? fields.logo_url ?? null) as string | null | undefined,
    signatureText: (fields.signatureText ?? fields.signature_text ?? null) as
      string | null | undefined,
    bankDetails: (fields.bankDetails ?? fields.bank_details ?? null) as string | null | undefined,
    termsDefault: (fields.termsDefault ?? fields.terms_default ?? null) as
      string | null | undefined,
    themeColor: (fields.themeColor ?? fields.theme_color ?? null) as string | null | undefined,
    unitsEnabled: (fields.unitsEnabled ?? fields.units_enabled ?? null) as
      string | null | undefined,
    taxPosition: (fields.taxPosition ?? fields.tax_position ?? null) as string | null | undefined,
    decimalPlaces: (fields.decimalPlaces ?? fields.decimal_places ?? null) as
      number | null | undefined,
  });
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

export async function createItem(data: {
  companyId: string;
  name: string;
  description?: string | null;
  type?: string;
  sku?: string | null;
  categoryId?: string | null;
  unit?: string;
  buyPrice?: number;
  sellPrice?: number;
  stockQty?: number;
  stockAlert?: number;
  taxRate?: number;
  barcode?: string | null;
  imageUrl?: string | null;
}): Promise<Item> {
  // Wire format is camelCase (see CommandRegistry): `type` maps to `itemType`.
  // `categoryId` is accepted for caller compatibility but has no backend column
  // yet, so it is not sent (backend gap). Stock fields default to 0 — the UI
  // only collects the sell price.
  void data.categoryId;
  return invokeCommand<Item>('db_create_item', {
    name: data.name,
    description: data.description ?? null,
    itemType: data.type ?? 'product',
    sku: data.sku ?? null,
    unit: data.unit ?? 'unit',
    buyPrice: data.buyPrice ?? 0,
    sellPrice: data.sellPrice ?? 0,
    stockQty: data.stockQty ?? 0,
    stockAlert: data.stockAlert ?? 0,
    taxRate: data.taxRate ?? 0,
    barcode: data.barcode ?? null,
    imageUrl: data.imageUrl ?? null,
    companyId: data.companyId,
  });
}

export async function updateItem(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_item` takes individual Option params (no `fields` blob).
  // Wire format is camelCase (see CommandRegistry): `type`/`item_type` map to
  // `itemType`. Snake_case aliases are accepted for backward compatibility.
  // Unknown keys (`companyId`, `categoryId`) are not sent — they are not
  // server-updatable.
  return invokeCommand<void>('db_update_item', {
    id,
    name: (fields.name ?? null) as string | null | undefined,
    description: (fields.description ?? null) as string | null | undefined,
    itemType: (fields.itemType ?? fields.type ?? fields.item_type ?? null) as
      string | null | undefined,
    sku: (fields.sku ?? null) as string | null | undefined,
    unit: (fields.unit ?? null) as string | null | undefined,
    buyPrice: (fields.buyPrice ?? fields.buy_price ?? null) as number | null | undefined,
    sellPrice: (fields.sellPrice ?? fields.sell_price ?? null) as number | null | undefined,
    stockQty: (fields.stockQty ?? fields.stock_qty ?? null) as number | null | undefined,
    stockAlert: (fields.stockAlert ?? fields.stock_alert ?? null) as number | null | undefined,
    taxRate: (fields.taxRate ?? fields.tax_rate ?? null) as number | null | undefined,
    barcode: (fields.barcode ?? null) as string | null | undefined,
    imageUrl: (fields.imageUrl ?? fields.image_url ?? null) as string | null | undefined,
    active: (fields.active ?? null) as number | null | undefined,
  });
}

export async function deleteItem(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_item', { id });
}

export async function getCompany(companyId: string): Promise<Company> {
  return invokeCommand<Company>('db_get_company', { companyId });
}

export async function listCompanies(): Promise<Company[]> {
  return invokeCommand<Company[]>('db_list_companies', {});
}

export async function createCompany(data: {
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  website?: string | null;
  industry?: string | null;
  timezone?: string;
  logoUrl?: string | null;
  ice?: string | null;
  taxId?: string | null;
  rc?: string | null;
  cnss?: string | null;
}): Promise<Company> {
  // Wire format is camelCase (see CommandRegistry). Previously this sent
  // snake_case keys which Tauri silently dropped, so address/legal identifiers
  // were never saved.
  const {
    name,
    legalName = null,
    email = null,
    phone = null,
    addressLine1 = null,
    addressLine2 = null,
    city = null,
    state = null,
    postalCode = null,
    country = null,
    website = null,
    industry = null,
    timezone = 'Africa/Casablanca',
    logoUrl = null,
    ice = null,
    taxId = null,
    rc = null,
    cnss = null,
  } = data;
  return invokeCommand<Company>('db_create_company', {
    name,
    legalName,
    email,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    website,
    industry,
    timezone,
    logoUrl,
    ice,
    taxId,
    rc,
    cnss,
  });
}

export async function updateCompany(id: string, fields: Record<string, unknown>): Promise<void> {
  // Rust `db_update_company` takes `companyId` + individual Option params.
  // Wire format is camelCase (see CommandRegistry); snake_case aliases are
  // accepted for backward compatibility (BusinessProfilePanel and other forms
  // mirror the snake_case DB row shape).
  return invokeCommand<void>('db_update_company', {
    companyId: id,
    name: (fields.name ?? null) as string | null | undefined,
    legalName: (fields.legalName ?? fields.legal_name ?? null) as string | null | undefined,
    email: (fields.email ?? null) as string | null | undefined,
    phone: (fields.phone ?? null) as string | null | undefined,
    addressLine1: (fields.addressLine1 ?? fields.address_line1 ?? null) as
      string | null | undefined,
    addressLine2: (fields.addressLine2 ?? fields.address_line2 ?? null) as
      string | null | undefined,
    city: (fields.city ?? null) as string | null | undefined,
    state: (fields.state ?? null) as string | null | undefined,
    postalCode: (fields.postalCode ?? fields.postal_code ?? null) as string | null | undefined,
    country: (fields.country ?? null) as string | null | undefined,
    website: (fields.website ?? null) as string | null | undefined,
    industry: (fields.industry ?? null) as string | null | undefined,
    timezone: (fields.timezone ?? null) as string | null | undefined,
    logoUrl: (fields.logoUrl ?? fields.logo_url ?? null) as string | null | undefined,
    ice: (fields.ice ?? null) as string | null | undefined,
    taxId: (fields.taxId ?? fields.tax_id ?? null) as string | null | undefined,
    rc: (fields.rc ?? null) as string | null | undefined,
    cnss: (fields.cnss ?? null) as string | null | undefined,
  });
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
