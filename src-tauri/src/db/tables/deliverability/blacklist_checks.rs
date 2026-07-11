//! Blacklist checks — DNSBL / blacklist lookup results for an account's
//! targets. Helpers: `list`, `create`, `update_result`, `upsert`, `delete`.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::common::delete_or_not_found;
use crate::db::error::AppDbError;

/// A DNSBL / blacklist lookup result for an IP or domain.
///
/// Defined inline — this struct exists in `schema.sql` but NOT in `schema.rs`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BlacklistCheck {
    /// Primary key (UUID).
    pub id: String,
    /// Owning account id.
    pub account_id: String,
    /// Kind of check (e.g. `"dnsbl"`).
    pub check_type: String,
    /// IP/domain that was checked.
    pub target: String,
    /// Whether the target is listed (1/0).
    pub listed: i64,
    /// Name of the list the target was found on, if listed.
    pub list_name: Option<String>,
    /// Whether a response was received (1/0).
    pub responded: i64,
    /// Unix-epoch time of the check.
    pub checked_at: i64,
}

/// List all blacklist checks for an account, most recent first.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All checks for the account ordered by `checked_at DESC`. An empty `Vec` (not
/// an error) when none exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<BlacklistCheck>, AppDbError> {
    sqlx::query_as::<_, BlacklistCheck>(
        "SELECT * FROM blacklist_checks WHERE account_id = ? ORDER BY checked_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Create a new blacklist check and return the full row.
///
/// New checks start with `responded = 0`.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `check_type` — kind of check (e.g. `"dnsbl"`).
/// * `target` — IP/domain checked.
/// * `listed` — whether the target is currently listed.
/// * `list_name` — list name if listed, else `None`.
///
/// # Returns
/// The newly inserted `BlacklistCheck` row (with generated `id`, `checked_at`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    check_type: &str,
    target: &str,
    listed: bool,
    list_name: Option<&str>,
) -> Result<BlacklistCheck, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, BlacklistCheck>(
        r#"
        INSERT INTO blacklist_checks (id, account_id, check_type, target, listed, list_name, responded, checked_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(check_type)
    .bind(target)
    .bind(listed as i64)
    .bind(list_name)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update the result of an existing blacklist check.
///
/// Sets `responded = 1`, stamps `checked_at`, and stores `listed`/`list_name`.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the check.
/// * `listed` — whether the target is now listed.
/// * `list_name` — list name if listed, else `None`.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"BlacklistCheck with id '<id>' not found"`)
/// when no check matches `id` (this is an `UPDATE`, so it is left inline rather
/// than via the `delete_or_not_found` helper, which is DELETE-specific). Returns
/// `AppDbError::Database` on query failure.
pub async fn update_result(
    pool: &SqlitePool,
    id: &str,
    listed: bool,
    list_name: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let rows = sqlx::query(
        "UPDATE blacklist_checks SET listed = ?, list_name = ?, responded = 1, checked_at = ? WHERE id = ?",
    )
    .bind(listed as i64)
    .bind(list_name)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("BlacklistCheck with id '{id}' not found")));
    }
    Ok(())
}

/// Insert or replace a blacklist check by primary key.
///
/// Uses `INSERT OR REPLACE` keyed on the caller-supplied `id`, so an existing
/// row with that `id` is fully overwritten. `responded` is forced to `0`.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key to insert/replace.
/// * `account_id` — owning account id.
/// * `check_type` — kind of check.
/// * `target` — IP/domain checked.
/// * `listed` — whether the target is listed (raw i64, 0/1).
/// * `list_name` — list name if listed, else `None`.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn upsert(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
    check_type: &str,
    target: &str,
    listed: i64,
    list_name: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT OR REPLACE INTO blacklist_checks (id, account_id, check_type, target, listed, list_name, responded, checked_at) VALUES (?,?,?,?,?,?,0,?)"
    )
    .bind(id)
    .bind(account_id)
    .bind(check_type)
    .bind(target)
    .bind(listed)
    .bind(list_name)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a blacklist check by its primary key.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `id` — primary key of the check to delete.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::NotFound` (`"BlacklistCheck with id '<id>' not found"`)
/// when no check matches `id` (the shared `delete_or_not_found` helper wraps the
/// statement in `sqlx::AssertSqlSafe` and interpolates `id` into the SQL).
/// Returns `AppDbError::Database` on query failure.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    delete_or_not_found(
        pool,
        format!("DELETE FROM blacklist_checks WHERE id = '{id}'"),
        id,
        "BlacklistCheck",
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
        let account_id = "acc-bl-1";
        helpers::insert_test_account(&pool, account_id).await;

        let check = create(
            &pool,
            account_id,
            "dnsbl",
            "192.0.2.1",
            true,
            Some("zen.spamhaus.org"),
        )
        .await
        .unwrap();

        assert_eq!(check.account_id, account_id);
        assert_eq!(check.check_type, "dnsbl");
        assert_eq!(check.target, "192.0.2.1");
        assert_eq!(check.listed, 1);
        assert_eq!(check.list_name, Some("zen.spamhaus.org".to_string()));

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, check.id);
    }

    #[tokio::test]
    async fn test_update_result() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-bl-2").await;
        let check = create(
            &pool,
            "acc-bl-2",
            "dnsbl",
            "203.0.113.5",
            false,
            None,
        )
        .await
        .unwrap();

        update_result(&pool, &check.id, true, Some("b.barracudacentral.org"))
            .await
            .unwrap();

        let items = list(&pool, "acc-bl-2").await.unwrap();
        assert_eq!(items[0].listed, 1);
        assert_eq!(items[0].list_name, Some("b.barracudacentral.org".to_string()));
    }

    #[tokio::test]
    async fn test_update_result_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = update_result(&pool, "nonexistent", true, None).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list_empty() {
        let pool = helpers::create_memory_pool().await;
        let items = list(&pool, "acc-bl-empty").await.unwrap();
        assert!(items.is_empty());
    }
}
