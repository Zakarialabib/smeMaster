//! PendingOperations table data-access layer.
//!
//! CRUD and retry queries for the `pending_operations` table. Every function
//! is `async` and runs against a shared `SqlitePool`. A missing row (on fetch
//! or delete) is surfaced as `AppDbError::NotFound`; other failures surface as
//! `AppDbError::Database`. Shared helpers from `crate::db::common` are used
//! where the existing pattern matches exactly (`fetch_or_not_found`,
//! `delete_or_not_found`).

use sqlx::SqlitePool;
use crate::db::common::{delete_or_not_found, fetch_or_not_found};
use crate::db::error::AppDbError;
use crate::db::workflows::schema::PendingOperation;

/// List pending operations for a company with optional status filter.
///
/// When `status` is `None`, operations in any status are returned.
/// Results are ordered by `created_at DESC`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `status` — optional status filter (e.g. `"pending"`, `"failed"`).
///
/// # Returns
/// `PendingOperation` rows for the company (optionally filtered by `status`),
/// ordered descending by `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
///
/// # SQL safety
/// The `WHERE` clause is built dynamically from fixed fragments (`company_id`
/// always, `status` only when present); only the filter values are bound as
/// parameters (`?`). The assembled SQL is wrapped with `sqlx::AssertSqlSafe`
/// because it is not a compile-time constant.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
    status: Option<&str>,
) -> Result<Vec<PendingOperation>, AppDbError> {
    let mut conditions: Vec<String> = vec!["company_id = ?".to_string()];

    if status.is_some() {
        conditions.push("status = ?".to_string());
    }

    let where_sql = conditions.join(" AND ");
    let sql = format!(
        "SELECT * FROM pending_operations WHERE {where_sql} ORDER BY created_at DESC"
    );

    let mut q = sqlx::query_as::<_, PendingOperation>(sqlx::AssertSqlSafe(sql.clone()));
    q = q.bind(company_id);
    if let Some(s) = status {
        q = q.bind(s);
    }

    q.fetch_all(pool).await.map_err(AppDbError::Database)
}

/// List all failed operations that are eligible for retry.
///
/// Filters by `status = 'failed'`, `retry_count < max_retries`, and
/// `next_retry_at <= ?`, ordered by `next_retry_at ASC` (most urgent first).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `now` — epoch-second cutoff; operations with `next_retry_at <= now` are
///   eligible.
///
/// # Returns
/// Retryable `PendingOperation` rows (status `'failed'`, under their retry
/// limit, due now), ordered ascending by `next_retry_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns `NotFound`.
pub async fn list_retryable(
    pool: &SqlitePool,
    now: i64,
) -> Result<Vec<PendingOperation>, AppDbError> {
    sqlx::query_as::<_, PendingOperation>(
        "SELECT * FROM pending_operations WHERE status = 'failed' AND retry_count < max_retries AND next_retry_at <= ? ORDER BY next_retry_at ASC",
    )
    .bind(now)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single pending operation by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the pending operation's primary key.
///
/// # Returns
/// The full `PendingOperation` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `PendingOperation with id '<id>' not found` when no operation matches the
/// key. Returns `AppDbError::Database` for other query failures.
///
/// # SQL safety
/// The `id` is bound as a parameter (`?`); it is never interpolated into the
/// SQL string.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<PendingOperation, AppDbError> {
    let opt = sqlx::query_as::<_, PendingOperation>("SELECT * FROM pending_operations WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "PendingOperation")
}

/// Create a new pending operation and return the full row.
///
/// Auto-generates `id` (UUID v4), sets `status = 'pending'`, `retry_count = 0`,
/// `max_retries = 3`, and `created_at` to the current epoch second.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — the owning company/account id.
/// - `operation_type` — the type of operation (e.g. `"send_email"`).
/// - `resource_id` — the resource the operation targets.
/// - `params` — JSON string of operation parameters.
/// - `next_retry_at` — optional epoch second for the next retry attempt.
/// - `campaign_id` — optional campaign this operation belongs to.
///
/// # Returns
/// The newly created `PendingOperation` row with server-assigned `id` and
/// `created_at`.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures.
/// Never returns `NotFound`.
///
/// # SQL safety
/// All input fields are bound as positional parameters (`?`); only `status`,
/// `retry_count`, `max_retries`, and `created_at` are constants in the SQL.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    operation_type: &str,
    resource_id: &str,
    params: &str,
    next_retry_at: Option<i64>,
    campaign_id: Option<&str>,
) -> Result<PendingOperation, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, PendingOperation>(
        r#"
        INSERT INTO pending_operations (
            id, company_id, operation_type, resource_id, params,
            status, retry_count, max_retries, next_retry_at, error_message,
            campaign_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', 0, 3, ?, NULL, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(operation_type)
    .bind(resource_id)
    .bind(params)
    .bind(next_retry_at)
    .bind(campaign_id)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update the status (and optionally the error message) of a pending operation.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the pending operation's primary key.
/// - `status` — new status value (e.g. `"completed"`, `"failed"`).
/// - `error_message` — optional error message to store.
///
/// # Returns
/// `Ok(())` when the row exists and was updated.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `PendingOperation with id '<id>' not found` when no operation matches the
/// key (i.e. zero rows were affected). Returns `AppDbError::Database` for
/// other query failures.
///
/// # SQL safety
/// The `status`, `error_message`, and `id` are bound as parameters (`?`); none
/// is interpolated into the SQL string.
pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "UPDATE pending_operations SET status = ?, error_message = ? WHERE id = ?",
    )
    .bind(status)
    .bind(error_message)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "PendingOperation with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Increment the retry count for a pending operation.
///
/// Also updates `next_retry_at` to the given timestamp. Returns
/// `AppDbError::NotFound` when no operation matches.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the pending operation's primary key.
/// - `next_retry_at` — optional new `next_retry_at` timestamp (epoch second).
///
/// # Returns
/// `Ok(())` when the row exists and was updated.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `PendingOperation with id '<id>' not found` when no operation matches the
/// key (i.e. zero rows were affected). Returns `AppDbError::Database` for
/// other query failures.
///
/// # SQL safety
/// Both `next_retry_at` and the `id` are bound as parameters (`?`); neither is
/// interpolated into the SQL string.
pub async fn increment_retry(
    pool: &SqlitePool,
    id: &str,
    next_retry_at: Option<i64>,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        r#"
        UPDATE pending_operations
        SET retry_count = retry_count + 1, next_retry_at = ?
        WHERE id = ?
        "#,
    )
    .bind(next_retry_at)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "PendingOperation with id '{id}' not found"
        )));
    }
    Ok(())
}

/// Delete a pending operation by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the pending operation's primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `PendingOperation with id '<id>' not found` when no row matches the key
/// (i.e. zero rows were affected). Returns `AppDbError::Database` for other
/// query failures.
///
/// # SQL safety
/// The `id` is interpolated into the `DELETE` statement and the SQL is wrapped
/// with `sqlx::AssertSqlSafe` by `delete_or_not_found`. Callers must only pass
/// app-generated ids (e.g. UUIDs); do not pass untrusted input.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM pending_operations WHERE id = '{id}'"),
        id,
        "PendingOperation",
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-po-1";
        helpers::insert_test_account(&pool, account_id).await;
        let now = chrono::Utc::now().timestamp();

        let op = create(
            &pool,
            account_id,
            "send_email",
            "res-1",
            r#"{"to":"user@example.com"}"#,
            Some(now + 300),
            None,
        )
        .await
        .unwrap();

        assert_eq!(op.company_id, account_id);
        assert_eq!(op.operation_type, "send_email");
        assert_eq!(op.resource_id, "res-1");
        assert_eq!(op.status, "pending");
        assert_eq!(op.retry_count, 0);
        assert_eq!(op.max_retries, 3);

        let items = list(&pool, account_id, None).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, op.id);
    }

    #[tokio::test]
    async fn test_list_with_status_filter() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-po-2";
        helpers::insert_test_account(&pool, account_id).await;
        let now = chrono::Utc::now().timestamp();

        create(
            &pool,
            account_id,
            "type-a",
            "r1",
            "{}",
            Some(now + 100),
            None,
        )
        .await
        .unwrap();
        let op2 = create(
            &pool,
            account_id,
            "type-b",
            "r2",
            "{}",
            Some(now + 200),
            None,
        )
        .await
        .unwrap();
        update_status(&pool, &op2.id, "completed", None)
            .await
            .unwrap();

        let pending = list(&pool, account_id, Some("pending")).await.unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].resource_id, "r1");
    }

    #[tokio::test]
    async fn test_list_retryable() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-po-3").await;
        let now = chrono::Utc::now().timestamp();

        let op = create(
            &pool,
            "acc-po-3",
            "sync",
            "res-1",
            "{}",
            Some(now - 100),
            None,
        )
        .await
        .unwrap();
        update_status(&pool, &op.id, "failed", Some("timeout"))
            .await
            .unwrap();

        let retryable = list_retryable(&pool, now).await.unwrap();
        assert!(!retryable.is_empty());
        assert!(retryable.iter().any(|r| r.id == op.id));
    }

    #[tokio::test]
    async fn test_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-po-4").await;
        helpers::insert_test_campaign(&pool, "camp-1", "acc-po-4").await;
        let op = create(
            &pool,
            "acc-po-4",
            "send_email",
            "res-1",
            "{}",
            None,
            Some("camp-1"),
        )
        .await
        .unwrap();

        let found = get_by_id(&pool, &op.id).await.unwrap();
        assert_eq!(found.campaign_id, Some("camp-1".to_string()));
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_update_status() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-po-5").await;
        let op = create(
            &pool,
            "acc-po-5",
            "delete",
            "res-1",
            "{}",
            None,
            None,
        )
        .await
        .unwrap();

        update_status(&pool, &op.id, "completed", None)
            .await
            .unwrap();
        let updated = get_by_id(&pool, &op.id).await.unwrap();
        assert_eq!(updated.status, "completed");

        update_status(&pool, &op.id, "failed", Some("network error"))
            .await
            .unwrap();
        let updated = get_by_id(&pool, &op.id).await.unwrap();
        assert_eq!(updated.status, "failed");
        assert_eq!(updated.error_message, Some("network error".to_string()));
    }

    #[tokio::test]
    async fn test_update_status_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = update_status(&pool, "nonexistent", "completed", None)
            .await
            .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_increment_retry() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-po-6").await;
        let op = create(
            &pool,
            "acc-po-6",
            "retry_me",
            "res-1",
            "{}",
            Some(chrono::Utc::now().timestamp()),
            None,
        )
        .await
        .unwrap();

        assert_eq!(op.retry_count, 0);

        let future = chrono::Utc::now().timestamp() + 3600;
        increment_retry(&pool, &op.id, Some(future)).await.unwrap();

        let updated = get_by_id(&pool, &op.id).await.unwrap();
        assert_eq!(updated.retry_count, 1);
        assert_eq!(updated.next_retry_at, Some(future));
    }

    #[tokio::test]
    async fn test_increment_retry_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = increment_retry(&pool, "nonexistent", None)
            .await
            .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-po-7").await;
        let op = create(
            &pool,
            "acc-po-7",
            "cleanup",
            "res-1",
            "{}",
            None,
            None,
        )
        .await
        .unwrap();
        delete(&pool, &op.id).await.unwrap();
        let err = get_by_id(&pool, &op.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
