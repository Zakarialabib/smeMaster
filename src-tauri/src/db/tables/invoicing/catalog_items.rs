// ── Catalog Items (products / services table) ───────────────────────────────
//
// These are the reusable items (products/services) that can be added to
// invoices as line items. This is NOT invoice_items (line items on invoices).
// The SQL table is `items`; the Rust module is `catalog_items` to disambiguate.

use crate::db::error::AppDbError;
use crate::db::invoicing::schema::CatalogItem;

/// List all active catalog items for a company.
pub async fn list_by_company<'e, E>(
    executor: E,
    company_id: &str,
) -> Result<Vec<CatalogItem>, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    sqlx::query_as::<_, CatalogItem>(
        "SELECT * FROM items WHERE company_id = ? ORDER BY name ASC",
    )
    .bind(company_id)
    .fetch_all(executor)
    .await
    .map_err(AppDbError::Database)
}

/// Get a single catalog item by id.
pub async fn get_by_id<'e, E>(
    executor: E,
    id: &str,
) -> Result<CatalogItem, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    sqlx::query_as::<_, CatalogItem>("SELECT * FROM items WHERE id = ?")
        .bind(id)
        .fetch_optional(executor)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("CatalogItem {id} not found")))
}

/// Input for creating a catalog item.
pub struct CreateCatalogItemInput<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub item_type: &'a str,
    pub sku: Option<&'a str>,
    pub unit: &'a str,
    pub buy_price: i64,
    pub sell_price: i64,
    pub stock_qty: f64,
    pub stock_alert: f64,
    pub tax_rate: f64,
    pub barcode: Option<&'a str>,
    pub image_url: Option<&'a str>,
    pub company_id: &'a str,
}

/// Create a new catalog item.
pub async fn create<'e, E>(
    executor: E,
    input: CreateCatalogItemInput<'_>,
) -> Result<CatalogItem, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, CatalogItem>(
        r#"
        INSERT INTO items (
            id, name, description, type, sku, unit,
            buy_price, sell_price, stock_qty, stock_alert, tax_rate,
            barcode, image_url, active, company_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(input.name)
    .bind(input.description)
    .bind(input.item_type)
    .bind(input.sku)
    .bind(input.unit)
    .bind(input.buy_price)
    .bind(input.sell_price)
    .bind(input.stock_qty)
    .bind(input.stock_alert)
    .bind(input.tax_rate)
    .bind(input.barcode)
    .bind(input.image_url)
    .bind(input.company_id)
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

/// Input for updating a catalog item.
pub struct UpdateCatalogItemInput<'a> {
    pub name: Option<&'a str>,
    pub description: Option<Option<&'a str>>,
    pub item_type: Option<&'a str>,
    pub sku: Option<Option<&'a str>>,
    pub unit: Option<&'a str>,
    pub buy_price: Option<i64>,
    pub sell_price: Option<i64>,
    pub stock_qty: Option<f64>,
    pub stock_alert: Option<f64>,
    pub tax_rate: Option<f64>,
    pub barcode: Option<Option<&'a str>>,
    pub image_url: Option<Option<&'a str>>,
    pub active: Option<i64>,
}

/// Update a catalog item. Only provided fields will be updated.
pub async fn update<'e, E>(
    executor: E,
    id: &str,
    input: UpdateCatalogItemInput<'_>,
) -> Result<CatalogItem, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, CatalogItem>(
        r#"
        UPDATE items SET
            name = COALESCE(?, name),
            description = CASE WHEN ? IS NULL AND ? IS NOT NULL THEN NULL ELSE COALESCE(?, description) END,
            type = COALESCE(?, type),
            sku = CASE WHEN ? IS NULL AND ? IS NOT NULL THEN NULL ELSE COALESCE(?, sku) END,
            unit = COALESCE(?, unit),
            buy_price = COALESCE(?, buy_price),
            sell_price = COALESCE(?, sell_price),
            stock_qty = COALESCE(?, stock_qty),
            stock_alert = COALESCE(?, stock_alert),
            tax_rate = COALESCE(?, tax_rate),
            barcode = CASE WHEN ? IS NULL AND ? IS NOT NULL THEN NULL ELSE COALESCE(?, barcode) END,
            image_url = CASE WHEN ? IS NULL AND ? IS NOT NULL THEN NULL ELSE COALESCE(?, image_url) END,
            active = COALESCE(?, active),
            updated_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(input.name)
    .bind(input.description)           // check for NULL
    .bind(input.description)           // check for sentinel
    .bind(input.description.map(|d| d.unwrap_or("__NULL__")))
    .bind(input.item_type)
    .bind(input.sku)                   // check for NULL
    .bind(input.sku)                   // check for sentinel
    .bind(input.sku.map(|d| d.unwrap_or("__NULL__")))
    .bind(input.unit)
    .bind(input.buy_price)
    .bind(input.sell_price)
    .bind(input.stock_qty)
    .bind(input.stock_alert)
    .bind(input.tax_rate)
    .bind(input.barcode)               // check for NULL
    .bind(input.barcode)               // check for sentinel
    .bind(input.barcode.map(|d| d.unwrap_or("__NULL__")))
    .bind(input.image_url)             // check for NULL
    .bind(input.image_url)             // check for sentinel
    .bind(input.image_url.map(|d| d.unwrap_or("__NULL__")))
    .bind(input.active)
    .bind(now)
    .bind(id)
    .fetch_optional(executor)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("CatalogItem {id} not found")))
}

/// Soft-delete a catalog item by setting active = 0.
pub async fn soft_delete<'e, E>(executor: E, id: &str) -> Result<(), AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let now = chrono::Utc::now().timestamp();
    let rows = sqlx::query("UPDATE items SET active = 0, updated_at = ? WHERE id = ? AND active = 1")
        .bind(now)
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("CatalogItem {id} not found or already inactive")));
    }
    Ok(())
}
