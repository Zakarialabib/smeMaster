use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::Invoice;

pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<Invoice>, AppDbError> {
    sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE company_id = ? ORDER BY issue_date DESC")
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

pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    contact_id: Option<&str>,
    document_type: &str,
    invoice_number: &str,
    issue_date: i64,
    due_date: Option<i64>,
    currency: &str,
    notes: Option<&str>,
) -> Result<Invoice, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Invoice>(
        r#"
        INSERT INTO invoices (
            id, company_id, contact_id, document_type, invoice_number, status,
            issue_date, due_date, currency, subtotal, tax_total, total_amount,
            notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 0, 0, 0, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(contact_id)
    .bind(document_type)
    .bind(invoice_number)
    .bind(issue_date)
    .bind(due_date)
    .bind(currency)
    .bind(notes)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

pub async fn update_totals(
    pool: &SqlitePool,
    id: &str,
    subtotal: f64,
    tax_total: f64,
    total_amount: f64,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE invoices SET subtotal = ?, tax_total = ?, total_amount = ?, updated_at = ? WHERE id = ?"
    )
    .bind(subtotal)
    .bind(tax_total)
    .bind(total_amount)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?")
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_xml_path(pool: &SqlitePool, id: &str, path: &str) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE invoices SET peppol_xml_path = ?, updated_at = ? WHERE id = ?")
        .bind(path)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn update_pdf_path(pool: &SqlitePool, id: &str, path: &str) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE invoices SET pdf_path = ?, updated_at = ? WHERE id = ?")
        .bind(path)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM invoices WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Invoice {id} not found")));
    }
    Ok(())
}
