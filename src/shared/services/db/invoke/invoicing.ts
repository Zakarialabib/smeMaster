import { invokeCommand } from './command';
import type { Invoice, InvoiceWithItems, Client, Item, Company } from '../schema';

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
  return invokeCommand<void>('db_update_invoice', { id, fields });
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
  return invokeCommand<void>('db_update_client', { id, fields });
}

export async function deleteClient(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_client', { id });
}

export async function listItems(companyId: string): Promise<Item[]> {
  return invokeCommand<Item[]>('db_list_items', { companyId });
}

export async function getItem(id: string): Promise<Item> {
  return invokeCommand<Item>('db_get_item', { id });
}

export async function createItem(data: { companyId: string; name: string; description?: string | null; type?: string; sku?: string | null; categoryId?: string | null; unit?: string; sellPrice?: number; taxRate?: number; barcode?: string | null }): Promise<Item> {
  return invokeCommand<Item>('db_create_item', { ...data });
}

export async function updateItem(id: string, fields: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>('db_update_item', { id, fields });
}

export async function deleteItem(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_item', { id });
}

export async function getCompany(companyId: string): Promise<Company> {
  return invokeCommand<Company>('db_get_company', { companyId });
}

export async function updateCompany(id: string, fields: Record<string, unknown>): Promise<void> {
  return invokeCommand<void>('db_update_company', { id, fields });
}

export async function generateInvoiceDocuments(invoiceId: string): Promise<[string, string]> {
  return invokeCommand<[string, string]>('db_generate_invoice_documents', { invoiceId });
}

export async function sendInvoice(invoiceId: string, to: string): Promise<void> {
  return invokeCommand<void>('db_send_invoice', { invoiceId, to });
}

export async function calculateInvoice(invoiceId: string): Promise<Invoice> {
  return invokeCommand<Invoice>('db_calculate_invoice', { invoiceId });
}
