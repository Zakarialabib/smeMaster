import type { Invoice, InvoiceWithItems, CreateInvoiceRequest } from "../types";
import {
  listInvoices as dbListInvoices,
  getInvoiceWithItems as dbGetInvoiceWithItems,
  createInvoice as dbCreateInvoice,
  generateInvoiceDocuments as dbGenerateInvoiceDocuments,
} from "@shared/services/db/invoke/invoicing";

/**
 * Thin feature-layer wrappers that delegate to the canonical `db_*` Tauri
 * command wrappers in `@shared/services/db/invoke/invoicing`.
 *
 * The previous version invoked non-existent commands (`list_invoices`,
 * `generate_invoice_xml`, ...). These now call the real backend commands
 * with matching argument shapes.
 */

export const listInvoices = (companyId: string): Promise<Invoice[]> =>
  dbListInvoices(companyId);

export const getInvoiceWithItems = (invoiceId: string): Promise<InvoiceWithItems> =>
  dbGetInvoiceWithItems(invoiceId);

export const createInvoice = (req: CreateInvoiceRequest): Promise<Invoice> =>
  dbCreateInvoice(req);

/**
 * Generates the invoice PDF + PEPPOL XML and returns their on-disk paths
 * as `[pdfPath, xmlPath]`.
 *
 * NOTE: renamed from the old `generateInvoiceXml` to match the canonical
 * wrapper (`generateInvoiceDocuments`) — the backend now produces both
 * documents, so the return type is `[string, string]` rather than a single
 * string. This file is not imported anywhere else, so no callers break.
 */
export const generateInvoiceDocuments = (invoiceId: string): Promise<[string, string]> =>
  dbGenerateInvoiceDocuments(invoiceId);
