import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Invoice, InvoiceWithItems, CreateInvoiceRequest } from '../types';
import * as invoicingService from '../services/invoicing-invoke';

interface InvoicingState {
  invoices: Invoice[];
  currentInvoice: InvoiceWithItems | null;
  isLoading: boolean;
  error: string | null;

  fetchInvoices: (companyId: string) => Promise<void>;
  fetchInvoiceWithItems: (invoiceId: string) => Promise<void>;
  createInvoice: (req: CreateInvoiceRequest) => Promise<Invoice>;
  generateXml: (invoiceId: string) => Promise<string>;
}

export const useInvoicingStore = create<InvoicingState>()(
  persist(
    (set) => ({
      invoices: [],
      currentInvoice: null,
      isLoading: false,
      error: null,

      fetchInvoices: async (companyId) => {
        set({ isLoading: true, error: null });
        try {
          const invoices = await invoicingService.listInvoices(companyId);
          set({ invoices, isLoading: false });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch invoices', isLoading: false });
        }
      },

      fetchInvoiceWithItems: async (invoiceId) => {
        set({ isLoading: true, error: null });
        try {
          const currentInvoice = await invoicingService.getInvoiceWithItems(invoiceId);
          set({ currentInvoice, isLoading: false });
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch invoice details', isLoading: false });
        }
      },

      createInvoice: async (req) => {
        set({ isLoading: true, error: null });
        try {
          const invoice = await invoicingService.createInvoice(req);
          set((state) => ({
            invoices: [invoice, ...state.invoices],
            isLoading: false
          }));
          return invoice;
        } catch (err: any) {
          set({ error: err.message || 'Failed to create invoice', isLoading: false });
          throw err;
        }
      },

      generateXml: async (invoiceId) => {
        try {
          return await invoicingService.generateInvoiceXml(invoiceId);
        } catch (err: any) {
          set({ error: err.message || 'Failed to generate XML' });
          throw err;
        }
      }
    }),
    {
      name: 'smemaster-invoicing-storage',
    }
  )
);
