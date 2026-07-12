//! Accounts table data-access layer.
//!
//! CRUD and partial-update helpers for the `accounts` table. Every function
//! takes a `&SqlitePool` and returns `Result<_, AppDbError>`. A missing row
//! is reported either as `Ok(None)` (for lookups that tolerate absence) or as
//! `Err(AppDbError::NotFound)` (for lookups that require the row to exist),
//! depending on the call. Shared helpers from `crate::db::common` are used
//! where the existing pattern matches exactly.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::core::schema::Account;
use crate::smtp::types::SmtpConfig;
use crate::commands::core::CreateAccountRequest;
use crate::db::commands::UpdateFields;
use crate::db::common::{delete_or_not_found, fetch_or_not_found};

/// Fetch a single account by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the account's primary key.
///
/// # Returns
/// The matching `Account` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no account with the given `id` exists.
///
/// # SQL safety
/// The `id` is bound as a parameter (`?`); it is never interpolated into the
/// SQL string.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Account, AppDbError> {
    let opt = sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "Account")
}

/// Look up an account by email address.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `email` — the account's email address to look up.
///
/// # Returns
/// `Some(Account)` when a matching row exists, `None` otherwise.
///
/// # Errors
/// Never returns `AppDbError::NotFound`; a missing row is reported as `Ok(None)`.
/// Other database failures surface as `AppDbError::Database`.
///
/// # SQL safety
/// The `email` is passed as a bound parameter (`?`) and is not interpolated
/// into the SQL string.
pub async fn get_by_email(pool: &SqlitePool, email: &str) -> Result<Option<Account>, AppDbError> {
    sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE email = ?")
        .bind(email)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)
}

/// List all accounts ordered by email.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
///
/// # Returns
/// Every `Account` row, ordered ascending by `email`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
pub async fn get_all(pool: &SqlitePool) -> Result<Vec<Account>, AppDbError> {
    sqlx::query_as::<_, Account>("SELECT * FROM accounts ORDER BY email")
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

/// List all mail accounts that belong to a given company (oldest first).
pub async fn get_by_company(pool: &SqlitePool, company_id: &str) -> Result<Vec<Account>, AppDbError> {
    sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE company_id = ? ORDER BY created_at ASC")
        .bind(company_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Build an [`SmtpConfig`] from an account's stored SMTP settings.
///
/// Returns an error string if any required field (host, port, credentials) is missing.
pub fn to_smtp_config(account: &Account) -> Result<SmtpConfig, String> {
    let host = account
        .smtp_host
        .clone()
        .ok_or_else(|| "Account is missing an SMTP host".to_string())?;
    let port = account
        .smtp_port
        .map(|p| p as u16)
        .ok_or_else(|| "Account is missing an SMTP port".to_string())?;
    let security = account
        .smtp_security
        .clone()
        .unwrap_or_else(|| "starttls".to_string());
    let username = account
        .smtp_username
        .clone()
        .or_else(|| Some(account.email.clone()))
        .ok_or_else(|| "Account is missing an SMTP username".to_string())?;
    let password = account
        .smtp_password
        .clone()
        .ok_or_else(|| "Account is missing an SMTP password".to_string())?;

    Ok(SmtpConfig {
        host,
        port,
        security,
        username,
        password,
        auth_method: account.auth_method.clone(),
        accept_invalid_certs: false,
        timeout_secs: None,
    })
}

/// Create a new account and return the full row.
///
/// Auto-generates `id` (UUID v4), sets `is_active = 1`, `metadata_json = '{}'`,
/// and timestamps (`created_at`, `updated_at`) to the current epoch second.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `req` — the `CreateAccountRequest` describing the account.
///
/// # Returns
/// The newly inserted `Account` row (the request plus the generated `id` and
/// timestamps).
///
/// # Errors
/// Returns `AppDbError::Database` if the insert fails (e.g. a constraint
/// violation).
///
/// # SQL safety
/// Every field from `req` is bound as a positional parameter (`?`); only
/// `is_active`, `metadata_json`, and the timestamps are constants in the SQL.
pub async fn create(pool: &SqlitePool, req: CreateAccountRequest) -> Result<Account, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, Account>(
        r#"
        INSERT INTO accounts (
            id, email, display_name, provider,
            access_token, refresh_token,
            imap_host, imap_port, imap_security,
            imap_username, imap_password,
            smtp_host, smtp_port, smtp_security,
            smtp_username, smtp_password,
            oauth_provider, oauth_client_id, oauth_client_secret,
            auth_method,
            metadata_json, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 1, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(&req.email)
    .bind(&req.display_name)
    .bind(&req.provider)
    .bind(&req.access_token)
    .bind(&req.refresh_token)
    .bind(&req.imap_host)
    .bind(req.imap_port)
    .bind(&req.imap_security)
    .bind(&req.imap_username)
    .bind(&req.imap_password)
    .bind(&req.smtp_host)
    .bind(req.smtp_port)
    .bind(&req.smtp_security)
    .bind(&req.smtp_username)
    .bind(&req.smtp_password)
    .bind(&req.oauth_provider)
    .bind(&req.oauth_client_id)
    .bind(&req.oauth_client_secret)
    .bind(&req.auth_method)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Partially update an account.
///
/// - `fields.set` — columns to set to a JSON-serializable value.
/// - `fields.unset` — columns to set to `NULL`.
///
/// The `updated_at` timestamp is always bumped to the current epoch second.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the account's primary key.
/// - `fields` — the `UpdateFields` describing the `set`/`unset` columns.
///
/// # Returns
/// `Ok(())` when the update is applied (even when only `updated_at` changes).
///
/// # Errors
/// Returns `AppDbError::Database` if the statement fails to execute.
///
/// # SQL safety
/// The SQL is built dynamically from the `set`/`unset` keys and wrapped in
/// `sqlx::AssertSqlSafe`; all values (including the JSON-encoded `set` values)
/// are bound as parameters, never interpolated.
pub async fn update_fields(
    pool: &SqlitePool,
    id: &str,
    fields: &UpdateFields,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();

    // Collect SET clauses: every key in fields.set + updated_at
    let set_count = fields.set.len();
    let total_params = set_count + 1; // SET columns + WHERE id

    if set_count == 0 && fields.unset.is_empty() {
        // Nothing to update — still bump updated_at
        sqlx::query("UPDATE accounts SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppDbError::Database)?;
        return Ok(());
    }

    // Build SET clause parts
    let mut set_parts: Vec<String> = Vec::with_capacity(set_count + 1 + fields.unset.len());
    let mut set_values: Vec<serde_json::Value> = Vec::with_capacity(total_params);

    for key in &fields.unset {
        set_parts.push(format!("\"{key}\" = NULL"));
    }

    for (key, value) in &fields.set {
        set_parts.push(format!("\"{key}\" = ?"));
        set_values.push(value.clone());
    }

    set_parts.push("\"updated_at\" = ?".to_string());

    let sql = format!(
        "UPDATE accounts SET {} WHERE id = ?",
        set_parts.join(", ")
    );

    let mut q = sqlx::query(sqlx::AssertSqlSafe(sql));
    for val in &set_values {
        q = q.bind(val);
    }
    q = q.bind(now);
    q = q.bind(id);

    q.execute(pool).await.map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete an account by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the account's primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no account with the given `id` exists
/// (zero rows affected).
///
/// # SQL safety
/// The `DELETE` statement uses a bound parameter (`?`) for `id`; the SQL is
/// wrapped in `sqlx::AssertSqlSafe` by the shared helper.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(pool, "DELETE FROM accounts WHERE id = ?", id, "Account").await
}

/// Update the `history_id` and `last_sync_at` fields after a sync cycle.
pub async fn update_last_sync(
    pool: &SqlitePool,
    id: &str,
    history_id: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE accounts SET history_id = ?, last_sync_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(history_id)
    .bind(now)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    use crate::db::migrations::run_migrations;
    use sqlx::SqlitePool;

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();
        pool
    }

    fn make_create_req() -> CreateAccountRequest {
        CreateAccountRequest {
            email: "test@example.com".to_string(),
            display_name: Some("Test User".to_string()),
            provider: "imap".to_string(),
            access_token: None,
            refresh_token: None,
            imap_host: Some("imap.example.com".to_string()),
            imap_port: Some(993),
            imap_security: Some("tls".to_string()),
            imap_username: Some("test@example.com".to_string()),
            imap_password: Some("password".to_string()),
            smtp_host: Some("smtp.example.com".to_string()),
            smtp_port: Some(587),
            smtp_security: Some("starttls".to_string()),
            smtp_username: Some("test@example.com".to_string()),
            smtp_password: Some("password".to_string()),
            oauth_provider: None,
            oauth_client_id: None,
            oauth_client_secret: None,
            auth_method: Some("password".to_string()),
        }
    }

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = create_test_pool().await;
        let req = make_create_req();
        let account = create(&pool, req).await.unwrap();
        assert_eq!(account.email, "test@example.com");
        assert_eq!(account.display_name.as_deref(), Some("Test User"));
        assert_eq!(account.is_active, 1);
        assert!(account.created_at > 0);

        let fetched = get_by_id(&pool, &account.id).await.unwrap();
        assert_eq!(fetched.id, account.id);
        assert_eq!(fetched.email, account.email);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_email() {
        let pool = create_test_pool().await;
        let req = make_create_req();
        let account = create(&pool, req).await.unwrap();

        let found = get_by_email(&pool, "test@example.com").await.unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, account.id);

        let not_found = get_by_email(&pool, "missing@example.com").await.unwrap();
        assert!(not_found.is_none());
    }

    #[tokio::test]
    async fn test_get_all() {
        let pool = create_test_pool().await;
        let accounts = get_all(&pool).await.unwrap();
        let initial_count = accounts.len();

        let req1 = make_create_req();
        create(&pool, req1).await.unwrap();

        let mut req2 = make_create_req();
        req2.email = "other@example.com".to_string();
        create(&pool, req2).await.unwrap();

        let all = get_all(&pool).await.unwrap();
        assert_eq!(all.len(), initial_count + 2);
        assert!(all.iter().any(|a| a.email == "other@example.com"));
    }

    #[tokio::test]
    async fn test_update_fields() {
        let pool = create_test_pool().await;
        let req = make_create_req();
        let account = create(&pool, req).await.unwrap();

        // Use a numeric value to avoid JSON string quote encoding
        let mut set = std::collections::HashMap::new();
        set.insert(
            "imap_port".to_string(),
            serde_json::json!(995),
        );
        let fields = UpdateFields {
            set,
            unset: vec![],
        };

        update_fields(&pool, &account.id, &fields).await.unwrap();

        let updated = get_by_id(&pool, &account.id).await.unwrap();
        assert_eq!(updated.imap_port, Some(995));
    }

    #[tokio::test]
    async fn test_update_fields_unset() {
        let pool = create_test_pool().await;
        let req = make_create_req();
        let account = create(&pool, req).await.unwrap();

        let fields = UpdateFields {
            set: std::collections::HashMap::new(),
            unset: vec!["display_name".to_string()],
        };

        update_fields(&pool, &account.id, &fields).await.unwrap();

        let updated = get_by_id(&pool, &account.id).await.unwrap();
        assert!(updated.display_name.is_none());
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = create_test_pool().await;
        let req = make_create_req();
        let account = create(&pool, req).await.unwrap();

        delete(&pool, &account.id).await.unwrap();

        let err = get_by_id(&pool, &account.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = create_test_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_update_last_sync() {
        let pool = create_test_pool().await;
        let req = make_create_req();
        let account = create(&pool, req).await.unwrap();

        update_last_sync(&pool, &account.id, "hist_123").await.unwrap();

        let updated = get_by_id(&pool, &account.id).await.unwrap();
        assert_eq!(updated.history_id.as_deref(), Some("hist_123"));
        assert!(updated.last_sync_at.is_some());
    }
}
