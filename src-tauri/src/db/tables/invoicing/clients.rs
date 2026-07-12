// ── Client (customer / supplier) operations ─────────────────────────────────
// Clients are now stored in the unified `contacts` table (contact_type =
// 'client' | 'supplier'). This module is the invoicing-facing projection over
// `contacts`, keeping the same command signatures so the TS store is unaffected.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::Client;

/// List non-deleted clients/suppliers for a company, optionally filtered by
/// `contact_type` ("client" | "supplier"). `None` returns both.
pub async fn list(
    pool: &SqlitePool,
    company_id: Option<&str>,
    contact_type: Option<&str>,
) -> Result<Vec<Client>, AppDbError> {
    match contact_type {
        Some(t) => {
            sqlx::query_as::<_, Client>(
                "SELECT * FROM contacts WHERE deleted_at IS NULL AND (? IS NULL OR company_id = ?) AND contact_type = ? ORDER BY display_name ASC"
            )
            .bind(company_id)
            .bind(company_id)
            .bind(t)
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
        None => {
            sqlx::query_as::<_, Client>(
                "SELECT * FROM contacts WHERE deleted_at IS NULL AND (? IS NULL OR company_id = ?) AND contact_type IN ('client','supplier') ORDER BY display_name ASC"
            )
            .bind(company_id)
            .bind(company_id)
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Get a single client/contact by ID (even if soft-deleted).
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Client, AppDbError> {
    sqlx::query_as::<_, Client>("SELECT * FROM contacts WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Client {id} not found")))
}

/// Input for creating a client.
pub struct CreateClientInput<'a> {
    pub company_id: &'a str,
    pub display_name: &'a str,
    pub email: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub address: Option<&'a str>,
    pub city: Option<&'a str>,
    pub country: Option<&'a str>,
    pub tax_id: Option<&'a str>,
    pub contact_type: &'a str,
    pub credit_limit: Option<i64>,
    pub payment_terms: Option<i64>,
    pub notes: Option<&'a str>,
}

/// Create a new client as a contact.
pub async fn create<'e, E>(
    executor: E,
    input: CreateClientInput<'_>,
) -> Result<Client, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Client>(
        r#"
        INSERT INTO contacts (
            id, company_id, email, display_name, phone, address, city, country,
            tax_id, contact_type, credit_limit, payment_terms, notes,
            frequency, engagement_score, health_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0.0, 'cold', ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(input.company_id)
    .bind(input.email)
    .bind(input.display_name)
    .bind(input.phone)
    .bind(input.address)
    .bind(input.city)
    .bind(input.country)
    .bind(input.tax_id)
    .bind(input.contact_type)
    .bind(input.credit_limit)
    .bind(input.payment_terms)
    .bind(input.notes)
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

/// Input for updating an existing client. All fields optional.
pub struct UpdateClientInput<'a> {
    pub display_name: Option<&'a str>,
    pub email: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub address: Option<&'a str>,
    pub city: Option<&'a str>,
    pub country: Option<&'a str>,
    pub tax_id: Option<&'a str>,
    pub contact_type: Option<&'a str>,
    pub credit_limit: Option<i64>,
    pub payment_terms: Option<i64>,
    pub notes: Option<&'a str>,
}

/// Update an existing client (a contact row).
pub async fn update<'e, E>(
    executor: E,
    id: &str,
    input: UpdateClientInput<'_>,
) -> Result<Client, AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, Client>(
        r#"
        UPDATE contacts SET
            display_name = COALESCE(?, display_name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            country = COALESCE(?, country),
            tax_id = COALESCE(?, tax_id),
            contact_type = COALESCE(?, contact_type),
            credit_limit = COALESCE(?, credit_limit),
            payment_terms = COALESCE(?, payment_terms),
            notes = COALESCE(?, notes),
            updated_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(input.display_name)
    .bind(input.email)
    .bind(input.phone)
    .bind(input.address)
    .bind(input.city)
    .bind(input.country)
    .bind(input.tax_id)
    .bind(input.contact_type)
    .bind(input.credit_limit)
    .bind(input.payment_terms)
    .bind(input.notes)
    .bind(now)
    .bind(id)
    .fetch_optional(executor)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Client {id} not found")))
}

/// Soft-delete a client by setting `deleted_at` timestamp.
pub async fn soft_delete<'e, E>(executor: E, id: &str) -> Result<(), AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let now = chrono::Utc::now().timestamp();
    let rows = sqlx::query("UPDATE contacts SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
        .bind(now)
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Client {id} not found or already deleted")));
    }
    Ok(())
}

/// Permanently delete a client (contact) from the database.
pub async fn hard_delete<'e, E>(executor: E, id: &str) -> Result<(), AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let rows = sqlx::query("DELETE FROM contacts WHERE id = ?")
        .bind(id)
        .execute(executor)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Client {id} not found")));
    }
    Ok(())
}
