import { create } from 'zustand';
import { Invoice, InvoiceWithItems, Client, Item, CreateInvoiceRequest } from '../types';
import type { Company } from '@shared/services/db/schema';
import {
  listInvoices,
  getInvoice,
  getInvoiceWithItems,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  getCompany,
  updateCompany,
  generateInvoiceDocuments,
  sendInvoice,
} from '@shared/services/db/invoke/invoicing';
import { listInvoicingClients, createBillingContact, updateBillingContact, deleteBillingContact } from '../services/clientRegistry';

export interface InvoiceFilters {
  type?: string | null;
  status?: string | null;
  search?: string;
}

interface InvoicingState {
  // ----- invoices -----
  invoices: Invoice[];
  listLoading: boolean;
  listError: string | null;
  filters: InvoiceFilters;
  setFilters: (patch: Partial<InvoiceFilters>) => void;
  fetchInvoices: (companyId: string) => Promise<void>;
  getInvoice: (id: string) => Promise<Invoice>;
  getInvoiceWithItems: (id: string) => Promise<InvoiceWithItems>;
  createInvoice: (req: CreateInvoiceRequest) => Promise<Invoice>;
  updateInvoice: (id: string, fields: Record<string, unknown>) => Promise<void>;
  removeInvoice: (id: string) => Promise<void>;
  changeStatus: (id: string, status: string) => Promise<void>;
  generateDocuments: (id: string) => Promise<[string, string]>;
  sendInvoice: (id: string, to: string) => Promise<void>;

  // UI-only extension: invoicing clients are unified contacts with
  // `contact_type === 'client'`. Advanced billing fields are stored on the
  // same contacts row so the UI does not need a separate invoice client registry.
  clients: Client[];
  clientsLoading: boolean;
  fetchClients: (companyId: string) => Promise<void>;
  createClient: (data: { companyId: string; name: string; email?: string | null; phone?: string | null; address?: string | null; city?: string | null; country?: string; taxId?: string | null; role?: string; creditLimit?: number; paymentTerms?: number; notes?: string | null }) => Promise<Client>;
  updateClient: (id: string, fields: Record<string, unknown>) => Promise<void>;
  removeClient: (id: string) => Promise<void>;

  // ----- items / products -----
  items: Item[];
  itemsLoading: boolean;
  fetchItems: (companyId: string) => Promise<void>;
  createItem: (data: Parameters<typeof createItem>[0]) => Promise<Item>;
  updateItem: (id: string, fields: Record<string, unknown>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;

  // ----- company / business profile -----
  company: Company | null;
  fetchCompany: (companyId: string) => Promise<void>;
  updateCompany: (id: string, fields: Record<string, unknown>) => Promise<void>;
}

const handle = (fn: () => Promise<void>, onError: (m: string) => void) =>
  fn().catch((err: any) => onError(err?.message ?? 'Something went wrong'));

export const useInvoicingStore = create<InvoicingState>()((set, get) => ({
  // ----- invoices -----
  invoices: [],
  listLoading: false,
  listError: null,
  filters: { type: null, status: null, search: '' },

  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

  fetchInvoices: async (companyId) => {
    set({ listLoading: true, listError: null });
    await handle(async () => {
      const invoices = await listInvoices(
        companyId,
        get().filters.type ?? undefined,
        get().filters.status ?? undefined,
      );
      set({ invoices, listLoading: false });
    }, (m) => set({ listError: m, listLoading: false }));
  },

  getInvoice: (id) => getInvoice(id),
  getInvoiceWithItems: (id) => getInvoiceWithItems(id),

  createInvoice: async (req) => {
    const invoice = await createInvoice(req);
    set((s) => ({ invoices: [invoice, ...s.invoices] }));
    return invoice;
  },

  updateInvoice: async (id, fields) => {
    await updateInvoice(id, fields);
    set((s) => ({
      invoices: s.invoices.map((i) => (i.id === id ? { ...i, ...fields } : i)),
    }));
  },

  removeInvoice: async (id) => {
    await deleteInvoice(id);
    set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
  },

  changeStatus: async (id, status) => {
    await updateInvoiceStatus(id, status);
    set((s) => ({
      invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: status as Invoice['status'] } : i)),
    }));
  },

  generateDocuments: (id) => generateInvoiceDocuments(id),
  sendInvoice: (id, to) => sendInvoice(id, to),

/* UI-only extension: invoicing clients are unified contacts with
 * `contact_type === 'client'`. These store methods preserve existing API
 * names while delegating to the shared TS wrappers, so UI can migrate to
 * contacts-backed behavior without renaming callers.
 */
  clients: [] as Client[],
  clientsLoading: false,
  fetchClients: async (companyId) => {
    set({ clientsLoading: true });
    await handle(async () => {
      const clients = await listInvoicingClients(companyId);
      set({ clients, clientsLoading: false });
    }, () => set({ clientsLoading: false }));
  },
  createClient: async (data) => {
    const client = await createBillingContact(data);
    set((s) => ({ clients: [client, ...s.clients] }));
    return client;
  },
  updateClient: async (id, fields) => {
    await updateBillingContact(id, fields);
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...fields } : c)) }));
  },
  removeClient: async (id) => {
    await deleteBillingContact(id);
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },

  // ----- items -----
  items: [],
  itemsLoading: false,
  fetchItems: async (companyId) => {
    set({ itemsLoading: true });
    await handle(async () => {
      const items = await listItems(companyId);
      set({ items, itemsLoading: false });
    }, () => set({ itemsLoading: false }));
  },
  createItem: async (data) => {
    const item = await createItem(data);
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },
  updateItem: async (id, fields) => {
    await updateItem(id, fields);
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...fields } : it)) }));
  },
  removeItem: async (id) => {
    await deleteItem(id);
    set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
  },

  // ----- company -----
  company: null,
  fetchCompany: async (companyId) => {
    const company = await getCompany(companyId);
    set({ company });
  },
  updateCompany: async (id, fields) => {
    await updateCompany(id, fields);
    set((s) => (s.company ? { company: { ...s.company, ...fields } } : {}));
  },
}));
