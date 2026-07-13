import { invokeCommand } from './command';

// ── Types (matching Rust backend with serde camelCase rename) ───────────────

export interface PosProduct {
  id: string;
  companyId: string;
  name: string;
  price: number;
  sku: string | null;
  barcode: string | null;
  taxRate: number;
  createdAt: number;
  updatedAt: number;
}

export interface SaleItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  createdAt: number;
}

export interface Sale {
  id: string;
  companyId: string;
  total: number;
  paymentMethod: string;
  createdAt: number;
}

export interface PosHardwareConfig {
  id: string;
  companyId: string;
  name: string;
  deviceType: string;
  driverType: string;
  connectionType: string;
  connectionParams: Record<string, unknown>;
  isDefault: boolean;
}

// ── Product CRUD ───────────────────────────────────────────────────────────

export async function listProducts(companyId: string): Promise<PosProduct[]> {
  return invokeCommand<PosProduct[]>('db_list_products', { companyId });
}

export async function searchProducts(companyId: string, query: string): Promise<PosProduct[]> {
  return invokeCommand<PosProduct[]>('db_search_products', { companyId, query });
}

export async function createProduct(
  companyId: string,
  name: string,
  price: number,
  sku?: string | null,
  barcode?: string | null,
  taxRate?: number | null,
): Promise<PosProduct> {
  return invokeCommand<PosProduct>('db_create_product', {
    companyId,
    name,
    price,
    sku: sku ?? null,
    barcode: barcode ?? null,
    taxRate: taxRate ?? null,
  });
}

export async function updateProduct(
  id: string,
  name?: string | null,
  price?: number | null,
  sku?: string | null,
  barcode?: string | null,
  taxRate?: number | null,
): Promise<PosProduct> {
  return invokeCommand<PosProduct>('db_update_product', {
    id,
    name: name ?? null,
    price: price ?? null,
    sku: sku ?? null,
    barcode: barcode ?? null,
    taxRate: taxRate ?? null,
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_product', { id });
}

// ── Sales ──────────────────────────────────────────────────────────────────

export async function recordSale(
  companyId: string,
  items: SaleItemInput[],
  total: number,
  paymentMethod: string,
): Promise<Sale> {
  return invokeCommand<Sale>('db_record_sale', { companyId, items, total, paymentMethod });
}

export async function listSales(companyId: string): Promise<Sale[]> {
  return invokeCommand<Sale[]>('db_list_sales', { companyId });
}

// ── Hardware ───────────────────────────────────────────────────────────────

export async function getHardwareConfigs(companyId: string): Promise<PosHardwareConfig[]> {
  return invokeCommand<PosHardwareConfig[]>('pos_get_hardware_configs', { companyId });
}

export async function openCashDrawer(config: PosHardwareConfig): Promise<void> {
  return invokeCommand<void>('pos_open_cash_drawer', { config });
}

export async function printReceipt(config: PosHardwareConfig, htmlContent: string): Promise<void> {
  return invokeCommand<void>('pos_print_receipt', { config, htmlContent });
}
