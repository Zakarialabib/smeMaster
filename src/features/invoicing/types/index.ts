export interface Invoice {
  id: string;
  company_id: string;
  contact_id: string | null;
  document_type: 'invoice' | 'delivery_bill' | 'shipping_print';
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
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
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  sort_order: number;
  created_at: number;
}

export interface InvoiceWithItems {
  invoice: Invoice;
  items: InvoiceItem[];
}

export interface CreateInvoiceRequest {
  companyId: string;
  contactId?: string | null;
  documentType: 'invoice' | 'delivery_bill' | 'shipping_print';
  invoiceNumber: string;
  issueDate: number;
  dueDate?: number | null;
  currency: string;
  notes?: string | null;
  itemsReq: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    sort_order: number;
  }>;
}
