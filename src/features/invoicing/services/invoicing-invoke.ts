import { invoke } from "@tauri-apps/api/core";
import { Invoice, InvoiceWithItems, CreateInvoiceRequest } from "../types";

export const listInvoices = (companyId: string): Promise<Invoice[]> =>
  invoke("list_invoices", { companyId });

export const getInvoiceWithItems = (invoiceId: string): Promise<InvoiceWithItems> =>
  invoke("get_invoice_with_items", { invoiceId });

export const createInvoice = (req: CreateInvoiceRequest): Promise<Invoice> =>
  invoke("create_invoice", { ...req });

export const generateInvoiceXml = (invoiceId: string): Promise<string> =>
  invoke("generate_invoice_xml", { invoiceId });
