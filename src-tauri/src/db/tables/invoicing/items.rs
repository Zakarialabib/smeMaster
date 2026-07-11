use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::InvoiceItem;

pub async fn list_by_invoice(pool: &SqlitePool, invoice_id: &str) -> Result<Vec<InvoiceItem>, AppDbError> {
    sqlx::query_as::<_, InvoiceItem>("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC")
        .bind(invoice_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

pub async fn create(
    pool: &SqlitePool,
    invoice_id: &str,
    description: &str,
    quantity: f64,
    unit_price: f64,
    tax_rate: f64,
    sort_order: i64,
) -> Result<InvoiceItem, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let tax_amount = quantity * unit_price * (tax_rate / 100.0);
    let total_amount = (quantity * unit_price) + tax_amount;

    sqlx::query_as::<_, InvoiceItem>(
        r#"
        INSERT INTO invoice_items (
            id, invoice_id, description, quantity, unit_price,
            tax_rate, tax_amount, total_amount, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(invoice_id)
    .bind(description)
    .bind(quantity)
    .bind(unit_price)
    .bind(tax_rate)
    .bind(tax_amount)
    .bind(total_amount)
    .bind(sort_order)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

pub async fn delete_by_invoice(pool: &SqlitePool, invoice_id: &str) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM invoice_items WHERE invoice_id = ?")
        .bind(invoice_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}
