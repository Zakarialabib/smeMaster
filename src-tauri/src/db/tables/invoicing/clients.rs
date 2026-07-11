// ── Client (customer / supplier) table operations ───────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::invoicing::schema::Client;

/// List all non-deleted clients for a company (or all clients).
/// `role` filter is optional: "customer", "supplier", or "both".
pub async fn list(
    pool: &SqlitePool,
    role: Option<&str>,
) -> Result<Vec<Client>, AppDbError> {
    match role {
        Some(r) => {
            sqlx::query_as::<_, Client>(
                "SELECT * FROM clients WHERE deleted_at IS NULL AND (role = ? OR role = 'both') ORDER BY name ASC"
            )
            .bind(r)
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
        None => {
            sqlx::query_as::<_, Client>(
                "SELECT * FROM clients WHERE deleted_at IS NULL ORDER BY name ASC"
            )
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Get a single client by ID (even if soft-deleted).
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Client, AppDbError> {
    sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("Client {id} not found")))
}

/// Input for creating a client.
pub struct CreateClientInput<'a> {
    pub name: &'a str,
    pub email: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub address: Option<&'a str>,
    pub city: Option<&'a str>,
    pub country: Option<&'a str>,
    pub tax_id: Option<&'a str>,
    pub role: Option<&'a str>,
    pub credit_limit: Option<i64>,
    pub payment_terms: Option<i64>,
    pub notes: Option<&'a str>,
}

/// Create a new client.
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
        INSERT INTO clients (
            id, name, email, phone, address, city, country,
            tax_id, role, credit_limit, payment_terms, notes,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(input.name)
    .bind(input.email)
    .bind(input.phone)
    .bind(input.address)
    .bind(input.city)
    .bind(input.country)
    .bind(input.tax_id)
    .bind(input.role)
    .bind(input.credit_limit)
    .bind(input.payment_terms)
    .bind(input.notes)
    .bind(now)
    .bind(now)
    .fetch_one(executor)
    .await
    .map_err(AppDbError::Database)
}

/// Input for updating an existing client. All fields are optional — only
/// provided fields will be updated.
pub struct UpdateClientInput<'a> {
    pub name: Option<&'a str>,
    pub email: Option<&'a str>,
    pub phone: Option<&'a str>,
    pub address: Option<&'a str>,
    pub city: Option<&'a str>,
    pub country: Option<&'a str>,
    pub tax_id: Option<&'a str>,
    pub role: Option<&'a str>,
    pub credit_limit: Option<i64>,
    pub payment_terms: Option<i64>,
    pub notes: Option<&'a str>,
}

/// Update an existing client.
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
        UPDATE clients SET
            name = COALESCE(?, name),
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            country = COALESCE(?, country),
            tax_id = COALESCE(?, tax_id),
            role = COALESCE(?, role),
            credit_limit = COALESCE(?, credit_limit),
            payment_terms = COALESCE(?, payment_terms),
            notes = COALESCE(?, notes),
            updated_at = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(input.name)
    .bind(input.email)
    .bind(input.phone)
    .bind(input.address)
    .bind(input.city)
    .bind(input.country)
    .bind(input.tax_id)
    .bind(input.role)
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
    let rows = sqlx::query("UPDATE clients SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
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

/// Permanently delete a client from the database.
pub async fn hard_delete<'e, E>(executor: E, id: &str) -> Result<(), AppDbError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let rows = sqlx::query("DELETE FROM clients WHERE id = ?")
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
