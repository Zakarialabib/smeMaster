use sqlx::SqliteExecutor;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::InvoiceItem;

pub struct CreateItemInput<'a> {
    pub invoice_id: &'a str,
    pub item_id: Option<&'a str>,
    pub description: &'a str,
    pub qty: f64,
    pub unit: &'a str,
    pub unit_price: i64,
    pub tax_rate: f64,
    pub sort_order: i64,
}

pub async fn list_by_invoice<'e, E: SqliteExecutor<'e>>(
    executor: E,
    invoice_id: &str,
) -> Result<Vec<InvoiceItem>, AppDbError> {
    sqlx::query_as::<_, InvoiceItem>(
        "SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC"
    )
    .bind(invoice_id)
    .fetch_all(executor)
    .await
    .map_err(AppDbError::Database)
}

pub async fn create<'e, E: SqliteExecutor<'e>>(
    executor: E,
    input: CreateItemInput<'_>,
) -> Result<InvoiceItem, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    // Calculate amounts inline (pure function, no DB)
    let subtotal = (input.qty * input.unit_price as f64).round() as i64;
    let tax_amount = (subtotal as f64 * (input.tax_rate / 100.0)).round() as i64;
    let line_total = subtotal + tax_amount;

    sqlx::query_as::<_, InvoiceItem>(
        r#"
        INSERT INTO invoice_items (
            id, invoice_id, item_id, description, qty, unit,
            unit_price, tax_rate, tax_amount, line_total, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(input.invoice_id)
    .bind(input.item_id)
    .bind(input.description)
    .bind(input.qty)
    .bind(input.unit)
    .bind(input.unit_price)
    .bind(input.tax_rate)
    .bind(tax_amount)
    .bind(line_total)
    .bind(input.sort_order)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

pub async fn delete_by_invoice<'e, E: SqliteExecutor<'e>>(
    executor: E,
    invoice_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM invoice_items WHERE invoice_id = ?")
        .bind(invoice_id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn delete<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM invoice_items WHERE id = ?")
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("InvoiceItem {id} not found")));
    }
    Ok(())
}
