import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the entire invoicing IPC wrapper so the store is tested in isolation.
vi.mock("@shared/services/db/invoke/invoicing", () => ({
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
  getInvoiceWithItems: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  updateInvoiceStatus: vi.fn(),
  addInvoiceItem: vi.fn(),
  removeInvoiceItem: vi.fn(),
  listClients: vi.fn(),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  listItems: vi.fn(),
  getItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getCompany: vi.fn(),
  updateCompany: vi.fn(),
  generateInvoiceDocuments: vi.fn(),
  sendInvoice: vi.fn(),
}));

import {
  listInvoices,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  listClients,
  createClient,
  listItems,
  generateInvoiceDocuments,
} from "@shared/services/db/invoke/invoicing";
import { useInvoicingStore } from "./invoicingStore";
import type { Invoice, Client, Item } from "../types";

const mockListInvoices = vi.mocked(listInvoices);
const mockCreateInvoice = vi.mocked(createInvoice);
const mockUpdateInvoiceStatus = vi.mocked(updateInvoiceStatus);
const mockDeleteInvoice = vi.mocked(deleteInvoice);
const mockListClients = vi.mocked(listClients);
const mockCreateClient = vi.mocked(createClient);
const mockListItems = vi.mocked(listItems);
const mockGenerateInvoiceDocuments = vi.mocked(generateInvoiceDocuments);

const invoice = (id: string, status: Invoice["status"] = "draft"): Invoice =>
  ({
    id,
    company_id: "company-1",
    client_id: "client-1",
    document_type: "invoice",
    invoice_number: `INV-${id}`,
    status,
    issue_date: 1700000000,
    due_date: null,
    currency: "MAD",
    subtotal: 0,
    tax_total: 0,
    total_amount: 0,
    notes: null,
    peppol_xml_path: null,
    pdf_path: null,
    created_at: 1700000000,
    updated_at: 1700000000,
  }) as Invoice;

beforeEach(() => {
  vi.clearAllMocks();
  useInvoicingStore.setState({
    invoices: [],
    clients: [],
    items: [],
    company: null,
    listLoading: false,
    listError: null,
    clientsLoading: false,
    itemsLoading: false,
    filters: { type: null, status: null, search: "" },
  });
});

describe("invoicingStore — invoices", () => {
  it("fetchInvoices sets loading, then populates invoices and clears error", async () => {
    mockListInvoices.mockResolvedValue([invoice("a"), invoice("b", "paid")]);
    await useInvoicingStore.getState().fetchInvoices("company-1");
    expect(mockListInvoices).toHaveBeenCalledWith("company-1", undefined, undefined);
    expect(useInvoicingStore.getState().listLoading).toBe(false);
    expect(useInvoicingStore.getState().listError).toBeNull();
    expect(useInvoicingStore.getState().invoices).toHaveLength(2);
  });

  it("fetchInvoices forwards active filters", async () => {
    useInvoicingStore.getState().setFilters({ type: "invoice", status: "paid" });
    mockListInvoices.mockResolvedValue([]);
    await useInvoicingStore.getState().fetchInvoices("company-1");
    expect(mockListInvoices).toHaveBeenCalledWith("company-1", "invoice", "paid");
  });

  it("fetchInvoices sets listError on failure and leaves list intact", async () => {
    mockListInvoices.mockRejectedValue(new Error("db down"));
    await useInvoicingStore.getState().fetchInvoices("company-1");
    expect(useInvoicingStore.getState().listLoading).toBe(false);
    expect(useInvoicingStore.getState().listError).toBe("db down");
    expect(useInvoicingStore.getState().invoices).toHaveLength(0);
  });

  it("createInvoice prepends the returned invoice", async () => {
    const created = invoice("c");
    mockCreateInvoice.mockResolvedValue(created);
    useInvoicingStore.setState({ invoices: [invoice("a")] });
    const result = await useInvoicingStore.getState().createInvoice({
      companyId: "company-1",
      clientId: "client-1",
      documentType: "invoice",
      invoiceNumber: "INV-c",
      issueDate: 1700000000,
      currency: "MAD",
      itemsReq: [],
    });
    expect(result).toBe(created);
    expect(useInvoicingStore.getState().invoices[0]).toBe(created);
    expect(useInvoicingStore.getState().invoices).toHaveLength(2);
  });

  it("changeStatus updates the matching invoice and calls the backend", async () => {
    useInvoicingStore.setState({ invoices: [invoice("a", "draft"), invoice("b")] });
    mockUpdateInvoiceStatus.mockResolvedValue(undefined);
    await useInvoicingStore.getState().changeStatus("a", "paid");
    expect(mockUpdateInvoiceStatus).toHaveBeenCalledWith("a", "paid");
    expect(useInvoicingStore.getState().invoices.find((i) => i.id === "a")!.status).toBe("paid");
  });

  it("removeInvoice filters the deleted invoice out", async () => {
    useInvoicingStore.setState({ invoices: [invoice("a"), invoice("b")] });
    mockDeleteInvoice.mockResolvedValue(undefined);
    await useInvoicingStore.getState().removeInvoice("a");
    expect(useInvoicingStore.getState().invoices.map((i) => i.id)).toEqual(["b"]);
  });
});

describe("invoicingStore — clients", () => {
  it("fetchClients populates clients and clears loading", async () => {
    const client = { id: "client-1", name: "Acme" } as Client;
    mockListClients.mockResolvedValue([client]);
    await useInvoicingStore.getState().fetchClients("company-1");
    expect(mockListClients).toHaveBeenCalledWith("company-1");
    expect(useInvoicingStore.getState().clients).toEqual([client]);
    expect(useInvoicingStore.getState().clientsLoading).toBe(false);
  });

  it("createClient prepends the new client", async () => {
    const client = { id: "client-2", name: "New" } as Client;
    mockCreateClient.mockResolvedValue(client);
    const result = await useInvoicingStore.getState().createClient({
      companyId: "company-1",
      name: "New",
    });
    expect(result).toBe(client);
    expect(useInvoicingStore.getState().clients[0]).toBe(client);
  });
});

describe("invoicingStore — items", () => {
  it("fetchItems populates items and clears loading", async () => {
    const item = { id: "item-1", name: "Widget" } as Item;
    mockListItems.mockResolvedValue([item]);
    await useInvoicingStore.getState().fetchItems("company-1");
    expect(mockListItems).toHaveBeenCalledWith("company-1");
    expect(useInvoicingStore.getState().items).toEqual([item]);
    expect(useInvoicingStore.getState().itemsLoading).toBe(false);
  });
});

describe("invoicingStore — documents", () => {
  it("generateDocuments returns the [pdf, xml] tuple from the backend", async () => {
    mockGenerateInvoiceDocuments.mockResolvedValue(["/x.pdf", "/y.xml"]);
    const docs = await useInvoicingStore.getState().generateDocuments("inv-1");
    expect(mockGenerateInvoiceDocuments).toHaveBeenCalledWith("inv-1");
    expect(docs).toEqual(["/x.pdf", "/y.xml"]);
  });
});
