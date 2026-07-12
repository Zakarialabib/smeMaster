export interface Invoice {
  id: string;
  company_id: string;
  client_id: string;
  document_type: 'invoice' | 'delivery_bill' | 'shipping_print';
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';
  issue_date: number;
  due_date: number | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  total_amount: number;
  notes: string | null;
  peppol_xml_path: string | null;
  pdf_path: string | null;
  created_at: number;
  updated_at: number;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  item_id: string | null;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  created_at: number;
}

export interface InvoiceWithItems {
  invoice: Invoice;
  items: InvoiceItem[];
}

export type { Client } from '@shared/services/db/schema';
export interface Item {
  id: string;
  name: string;
  description: string | null;
  type: 'product' | 'service';
  sku: string | null;
  category_id: string | null;
  unit: string;
  buy_price: number;
  sell_price: number;
  stock_qty: number;
  stock_alert: number;
  tax_rate: number;
  barcode: string | null;
  image_url: string | null;
  active: number;
  company_id: string;
  created_at: number;
  updated_at: number;
}

export interface CreateInvoiceRequest {
  companyId: string;
  clientId: string;
  documentType: 'invoice' | 'delivery_bill' | 'shipping_print';
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
}
