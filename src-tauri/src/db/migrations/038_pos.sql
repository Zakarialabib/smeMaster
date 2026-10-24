-- 038: POS (point of sale) tables.
--
-- `commands/pos.rs` queries pos_products / pos_sales / pos_sale_items but no
-- migration ever created them — db_list_products failed with
-- "no such table: pos_products". Columns mirror the `Product`, `Sale` and
-- `SaleItem` FromRow structs in commands/pos.rs.
--
-- pos_sale_items deliberately carries no FK on product_id: product_name is
-- denormalized into each sale line, and products must remain deletable after
-- a sale (snapshot semantics).

CREATE TABLE IF NOT EXISTS pos_products (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  sku TEXT,
  barcode TEXT,
  tax_rate REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_products_company ON pos_products(company_id);

CREATE TABLE IF NOT EXISTS pos_sales (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_sales_company ON pos_sales(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale ON pos_sale_items(sale_id);
