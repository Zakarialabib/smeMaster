use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use tauri::{AppHandle, command, State};

use crate::pos::{HardwareConfig, HardwareManager};

// ── POS Data Structs ───────────────────────────────────────────────────────

/// A product/item available for sale in the POS module.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub price: f64,
    pub sku: Option<String>,
    pub barcode: Option<String>,
    pub tax_rate: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A completed sale record.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Sale {
    pub id: String,
    pub company_id: String,
    pub total: f64,
    pub payment_method: String,
    pub created_at: i64,
}

/// An individual line item within a sale.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SaleItem {
    pub id: String,
    pub sale_id: String,
    pub product_id: String,
    pub product_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
    pub line_total: f64,
    pub created_at: i64,
}

/// Input DTO for a single sale item (frontend → backend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaleItemInput {
    pub product_id: String,
    pub product_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. db_list_products — list all products for a company
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_products(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<Product>, String> {
    sqlx::query_as::<_, Product>(
        "SELECT * FROM pos_products WHERE company_id = ? ORDER BY name ASC",
    )
    .bind(&company_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to list products: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. db_search_products — search products by name, SKU, or barcode
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_search_products(
    pool: State<'_, SqlitePool>,
    company_id: String,
    query: String,
) -> Result<Vec<Product>, String> {
    let pattern = format!("%{}%", query);
    sqlx::query_as::<_, Product>(
        "SELECT * FROM pos_products WHERE company_id = ? AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) ORDER BY name ASC",
    )
    .bind(&company_id)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to search products: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. db_create_product — create a new product
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_create_product(
    pool: State<'_, SqlitePool>,
    company_id: String,
    name: String,
    price: f64,
    sku: Option<String>,
    barcode: Option<String>,
    tax_rate: Option<f64>,
) -> Result<Product, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let tax_rate_val = tax_rate.unwrap_or(0.0);

    sqlx::query_as::<_, Product>(
        r#"
        INSERT INTO pos_products (id, company_id, name, price, sku, barcode, tax_rate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(&company_id)
    .bind(&name)
    .bind(price)
    .bind(sku)
    .bind(barcode)
    .bind(tax_rate_val)
    .bind(now)
    .bind(now)
    .fetch_one(&*pool)
    .await
    .map_err(|e| format!("Failed to create product: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. db_update_product — update product fields dynamically
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_update_product(
    pool: State<'_, SqlitePool>,
    id: String,
    name: Option<String>,
    price: Option<f64>,
    sku: Option<String>,
    barcode: Option<String>,
    tax_rate: Option<f64>,
) -> Result<Product, String> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Product>(
        r#"
        UPDATE pos_products SET
            name = COALESCE(?, name),
            price = COALESCE(?, price),
            sku = COALESCE(?, sku),
            barcode = COALESCE(?, barcode),
            tax_rate = COALESCE(?, tax_rate),
            updated_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(price)
    .bind(sku)
    .bind(barcode)
    .bind(tax_rate)
    .bind(now)
    .bind(&id)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Failed to update product: {e}"))?
    .ok_or_else(|| format!("Product {id} not found"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. db_delete_product — permanently delete a product
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_delete_product(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    let rows = sqlx::query("DELETE FROM pos_products WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to delete product: {e}"))?
        .rows_affected();

    if rows == 0 {
        return Err(format!("Product {id} not found"));
    }
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. db_record_sale — record a sale with items (transactional)
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_record_sale(
    pool: State<'_, SqlitePool>,
    company_id: String,
    items: Vec<SaleItemInput>,
    total: f64,
    payment_method: String,
) -> Result<Sale, String> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("DB begin failed: {e}"))?;

    let sale_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // 1. Insert the sale header
    sqlx::query(
        "INSERT INTO pos_sales (id, company_id, total, payment_method, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&sale_id)
    .bind(&company_id)
    .bind(total)
    .bind(&payment_method)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Failed to record sale: {e}"))?;

    // 2. Insert each sale item
    for item in &items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let line_total = item.quantity * item.unit_price;

        sqlx::query(
            r#"
            INSERT INTO pos_sale_items (id, sale_id, product_id, product_name, quantity, unit_price, tax_rate, line_total, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&item_id)
        .bind(&sale_id)
        .bind(&item.product_id)
        .bind(&item.product_name)
        .bind(item.quantity)
        .bind(item.unit_price)
        .bind(item.tax_rate)
        .bind(line_total)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Failed to insert sale item: {e}"))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("DB commit failed: {e}"))?;

    // Return the created sale
    sqlx::query_as::<_, Sale>("SELECT * FROM pos_sales WHERE id = ?")
        .bind(&sale_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("Failed to retrieve sale: {e}"))?
        .ok_or_else(|| format!("Sale {sale_id} not found after creation"))
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. db_list_sales — list all sales for a company
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_sales(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> Result<Vec<Sale>, String> {
    sqlx::query_as::<_, Sale>(
        "SELECT * FROM pos_sales WHERE company_id = ? ORDER BY created_at DESC",
    )
    .bind(&company_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to list sales: {e}"))
}

// ═════════════════════════════════════════════════════════════════
// 8. db_list_sale_items — list the line items for a single sale
// ═════════════════════════════════════════════════════════════════

#[command]
pub async fn db_list_sale_items(
    pool: State<'_, SqlitePool>,
    sale_id: String,
) -> Result<Vec<SaleItem>, String> {
    sqlx::query_as::<_, SaleItem>(
        "SELECT * FROM pos_sale_items WHERE sale_id = ? ORDER BY created_at ASC",
    )
    .bind(&sale_id)
    .fetch_all(&*pool)
    .await
    .map_err(|e| format!("Failed to list sale items: {e}"))
}

// ═════════════════════════════════════════════════════════════════════════════
// (Existing hardware commands follow below)
// ═════════════════════════════════════════════════════════════════════════════

#[command]
pub async fn pos_get_hardware_configs(
    _app: AppHandle,
    _company_id: String,
) -> Result<Vec<HardwareConfig>, String> {
    // In a real app, this would query the SQLite DB
    Ok(vec![])
}

#[command]
pub async fn pos_test_printer(
    config: HardwareConfig,
) -> Result<(), String> {
    let manager = HardwareManager::new();
    manager.print_test_page(config).await
}

#[command]
pub async fn pos_print_receipt(
    config: HardwareConfig,
    html_content: String,
) -> Result<(), String> {
    let manager = HardwareManager::new();
    // In a full implementation, we'd convert HTML to ESC/POS or use a webview to print
    // For now, we'll strip tags and print as text for ESC/POS, or use the system driver
    let plain_text = html_content
        .replace("<h1>", "").replace("</h1>", "\n")
        .replace("<p>", "").replace("</p>", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n");

    manager.print_receipt(config, plain_text).await
}

#[command]
pub async fn pos_open_cash_drawer(
    config: HardwareConfig,
) -> Result<(), String> {
    let manager = HardwareManager::new();
    manager.open_cash_drawer(config).await
}
