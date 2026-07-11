import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the typed IPC caller so no real Tauri `invoke` is performed.
vi.mock("./command", () => ({
  invokeCommand: vi.fn(),
}));

import { invokeCommand } from "./command";
import * as api from "./invoicing";

const mockInvoke = vi.mocked(invokeCommand);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invoicing IPC wrapper — command names", () => {
  it("listInvoices -> db_list_invoices with company + optional filters", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await api.listInvoices("company-1", "invoice", "paid");
    expect(mockInvoke).toHaveBeenCalledWith("db_list_invoices", {
      companyId: "company-1",
      typeFilter: "invoice",
      statusFilter: "paid",
    });
  });

  it("listInvoices normalises omitted filters to null", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await api.listInvoices("company-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_list_invoices", {
      companyId: "company-1",
      typeFilter: null,
      statusFilter: null,
    });
  });

  it("createInvoice -> db_create_invoice forwarding camelCase request", async () => {
    const req = {
      companyId: "company-1",
      clientId: "client-1",
      documentType: "invoice" as const,
      invoiceNumber: "INV-2026-001",
      issueDate: 1700000000,
      dueDate: 1700600000,
      currency: "MAD",
      notes: "Thanks",
      itemsReq: [
        { description: "Dev", qty: 1, unit: "h", unitPrice: 100, taxRate: 20, sortOrder: 0 },
      ],
    };
    mockInvoke.mockResolvedValueOnce({ id: "inv-1" });
    await api.createInvoice(req);
    expect(mockInvoke).toHaveBeenCalledWith("db_create_invoice", {
      ...req,
      dueDate: 1700600000,
      notes: "Thanks",
    });
  });

  it("updateInvoice -> db_update_invoice with individual Option params (issue_date -> date)", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.updateInvoice("inv-1", {
      notes: "Memo",
      issue_date: 100,
      due_date: 200,
      currency: "MAD",
      client_id: "client-9",
    });
    expect(mockInvoke).toHaveBeenCalledWith("db_update_invoice", {
      id: "inv-1",
      notes: "Memo",
      date: 100,
      due_date: 200,
      currency: "MAD",
      client_id: "client-9",
    });
  });

  it("updateInvoice omits undefined fields (no issue_date sent)", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.updateInvoice("inv-1", { notes: "Only notes" });
    expect(mockInvoke).toHaveBeenCalledWith("db_update_invoice", {
      id: "inv-1",
      notes: "Only notes",
      date: null,
      due_date: null,
      currency: undefined,
      client_id: null,
    });
  });

  it("deleteInvoice -> db_delete_invoice", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.deleteInvoice("inv-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_delete_invoice", { id: "inv-1" });
  });

  it("updateInvoiceStatus -> db_update_invoice_status", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.updateInvoiceStatus("inv-1", "paid");
    expect(mockInvoke).toHaveBeenCalledWith("db_update_invoice_status", {
      id: "inv-1",
      status: "paid",
    });
  });

  it("addInvoiceItem -> db_add_invoice_item", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.addInvoiceItem("inv-1", "Line", 2, "h", 50, 20, 1);
    expect(mockInvoke).toHaveBeenCalledWith("db_add_invoice_item", {
      invoiceId: "inv-1",
      description: "Line",
      qty: 2,
      unit: "h",
      unitPrice: 50,
      taxRate: 20,
      sortOrder: 1,
    });
  });

  it("removeInvoiceItem -> db_remove_invoice_item", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.removeInvoiceItem("inv-1", "item-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_remove_invoice_item", {
      invoiceId: "inv-1",
      itemId: "item-1",
    });
  });
});

describe("invoicing IPC wrapper — clients", () => {
  it("listClients -> db_list_clients (company filter ignored server-side, tracked in STATUS.md)", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await api.listClients("company-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_list_clients", { companyId: "company-1" });
  });

  it("createClient -> db_create_client with camelCase data", async () => {
    const data = {
      companyId: "company-1",
      name: "Acme",
      email: "a@acme.co",
      phone: "+212600000",
      role: "customer" as const,
    };
    mockInvoke.mockResolvedValueOnce({ id: "client-1" });
    await api.createClient(data);
    expect(mockInvoke).toHaveBeenCalledWith("db_create_client", data);
  });

  it("updateClient -> db_update_client with individual params (no fields blob)", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.updateClient("client-1", { name: "New", email: "x@y.z" });
    expect(mockInvoke).toHaveBeenCalledWith("db_update_client", {
      id: "client-1",
      name: "New",
      email: "x@y.z",
    });
  });

  it("deleteClient -> db_delete_client", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.deleteClient("client-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_delete_client", { id: "client-1" });
  });
});

describe("invoicing IPC wrapper — items", () => {
  it("createItem -> db_create_item mapping type->item_type and adding required stock fields", async () => {
    mockInvoke.mockResolvedValueOnce({ id: "item-1" });
    await api.createItem({
      companyId: "company-1",
      name: "Widget",
      type: "product",
      sellPrice: 10,
      taxRate: 20,
      sku: "W-1",
      unit: "pcs",
    });
    expect(mockInvoke).toHaveBeenCalledWith("db_create_item", {
      name: "Widget",
      description: null,
      item_type: "product",
      sku: "W-1",
      unit: "pcs",
      buy_price: 0,
      sell_price: 10,
      stock_qty: 0,
      stock_alert: 0,
      tax_rate: 20,
      barcode: null,
      company_id: "company-1",
    });
  });

  it("createItem defaults item_type to product and sell/stock to 0", async () => {
    mockInvoke.mockResolvedValueOnce({ id: "item-2" });
    await api.createItem({ companyId: "company-1", name: "Service" });
    expect(mockInvoke).toHaveBeenCalledWith("db_create_item", {
      name: "Service",
      description: null,
      item_type: "product",
      sku: null,
      unit: "unit",
      buy_price: 0,
      sell_price: 0,
      stock_qty: 0,
      stock_alert: 0,
      tax_rate: 0,
      barcode: null,
      company_id: "company-1",
    });
  });

  it("updateItem -> db_update_item mapping type->item_type and camelCase->snake_case", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.updateItem("item-1", {
      type: "service",
      sellPrice: 5,
      stockQty: 3,
      stockAlert: 1,
      taxRate: 10,
    });
    expect(mockInvoke).toHaveBeenCalledWith("db_update_item", {
      id: "item-1",
      name: undefined,
      description: null,
      item_type: "service",
      sku: null,
      unit: undefined,
      buy_price: undefined,
      sell_price: 5,
      stock_qty: 3,
      stock_alert: 1,
      tax_rate: 10,
      barcode: null,
    });
  });

  it("deleteItem -> db_delete_item", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.deleteItem("item-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_delete_item", { id: "item-1" });
  });
});

describe("invoicing IPC wrapper — company + documents", () => {
  it("getCompany -> db_get_company", async () => {
    mockInvoke.mockResolvedValueOnce({ id: "company-1" });
    await api.getCompany("company-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_get_company", { companyId: "company-1" });
  });

  it("updateCompany -> db_update_company with company_id (not id)", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.updateCompany("company-1", { name: "Renamed", email: "b@c.d" });
    expect(mockInvoke).toHaveBeenCalledWith("db_update_company", {
      company_id: "company-1",
      name: "Renamed",
      email: "b@c.d",
    });
  });

  it("generateInvoiceDocuments -> db_generate_invoice_documents returning [pdf, xml]", async () => {
    mockInvoke.mockResolvedValueOnce(["/x.pdf", "/y.xml"]);
    const result = await api.generateInvoiceDocuments("inv-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_generate_invoice_documents", {
      invoiceId: "inv-1",
    });
    expect(result).toEqual(["/x.pdf", "/y.xml"]);
  });

  it("sendInvoice -> db_send_invoice (to is accepted but ignored server-side, tracked in STATUS.md)", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await api.sendInvoice("inv-1", "client@mail.com");
    expect(mockInvoke).toHaveBeenCalledWith("db_send_invoice", {
      invoiceId: "inv-1",
      to: "client@mail.com",
    });
  });

  it("calculateInvoice -> db_calculate_invoice", async () => {
    mockInvoke.mockResolvedValueOnce({ id: "inv-1" });
    await api.calculateInvoice("inv-1");
    expect(mockInvoke).toHaveBeenCalledWith("db_calculate_invoice", { invoiceId: "inv-1" });
  });
});
