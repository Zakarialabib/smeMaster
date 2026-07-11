use sqlx::{SqlitePool, SqliteExecutor};
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::Invoice;

pub struct CreateInvoiceInput<'a> {
    pub company_id: &'a str,
    pub client_id: &'a str,
    pub document_type: &'a str,
    pub invoice_number: &'a str,
    pub issue_date: i64,
    pub due_date: Option<i64>,
    pub currency: &'a str,
    pub notes: Option<&'a str>,
    pub created_by: &'a str,
}

pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<Invoice>, AppDbError> {
    sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC")
        .bind(company_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Invoice, AppDbError> {
    sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Invoice {id} not found")))
}

pub async fn create<'e, E: SqliteExecutor<'e>>(
    executor: E,
    input: CreateInvoiceInput<'_>,
) -> Result<Invoice, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Invoice>(
        r#"
        INSERT INTO invoices (
            id, company_id, client_id, type, document_number, status,
            date, due_date, currency, subtotal, tax_amount, grand_total,
            notes, company_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(input.company_id)
    .bind(input.client_id)
    .bind(input.document_type)
    .bind(input.invoice_number)
    .bind(input.issue_date)
    .bind(input.due_date)
    .bind(input.currency)
    .bind(input.notes)
    .bind(input.company_id)
    .bind(input.created_by)
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

pub async fn update_totals<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
    subtotal: i64,
    tax_amount: i64,
    grand_total: i64,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE invoices SET subtotal = ?, tax_amount = ?, grand_total = ?, updated_at = ? WHERE id = ?"
    )
    .bind(subtotal)
    .bind(tax_amount)
    .bind(grand_total)
    .bind(now)
    .bind(id)
    .execute(executor)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_status<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
    status: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_xml_path<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
    path: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE invoices SET peppol_xml_path = ?, updated_at = ? WHERE id = ?")
        .bind(path)
        .bind(now)
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_pdf_path<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
    path: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE invoices SET pdf_path = ?, updated_at = ? WHERE id = ?")
        .bind(path)
        .bind(now)
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_invoice<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
    status: Option<&str>,
    notes: Option<&str>,
    date: Option<i64>,
    due_date: Option<i64>,
    currency: Option<&str>,
    client_id: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE invoices SET \
         status = COALESCE(?, status), \
         notes = COALESCE(?, notes), \
         date = COALESCE(?, date), \
         due_date = COALESCE(?, due_date), \
         currency = COALESCE(?, currency), \
         client_id = COALESCE(?, client_id), \
         updated_at = ? \
         WHERE id = ?"
    )
    .bind(status)
    .bind(notes)
    .bind(date)
    .bind(due_date)
    .bind(currency)
    .bind(client_id)
    .bind(now)
    .bind(id)
    .execute(executor)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn delete<'e, E: SqliteExecutor<'e>>(
    executor: E,
    id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("UPDATE invoices SET deleted_at = ? WHERE id = ?")
        .bind(chrono::Utc::now().timestamp())
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Invoice {id} not found")));
    }
    Ok(())
}
