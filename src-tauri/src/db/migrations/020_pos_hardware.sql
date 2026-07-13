-- POS Hardware Configuration and Related Tables

CREATE TABLE IF NOT EXISTS pos_hardware_configs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    device_type TEXT NOT NULL, -- 'printer', 'scanner', 'scale', 'cash_drawer'
    driver_type TEXT NOT NULL, -- 'escpos', 'system', 'hid', etc.
    connection_type TEXT NOT NULL, -- 'usb', 'network', 'serial', 'hid'
    connection_params TEXT NOT NULL, -- JSON object with params like IP, port, etc.
    is_default BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_products (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    barcode TEXT,
    price REAL NOT NULL DEFAULT 0.0,
    cost_price REAL NOT NULL DEFAULT 0.0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_categories (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    total_amount REAL NOT NULL,
    tax_amount REAL NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'card', 'other'
    status TEXT NOT NULL, -- 'completed', 'refunded', 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_transaction_items (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES pos_transactions(id),
    FOREIGN KEY (product_id) REFERENCES pos_products(id)
);

-- Index for barcode scanning
CREATE INDEX IF NOT EXISTS idx_pos_products_barcode ON pos_products(barcode);
