//! Folder sync-state table data-access layer.
//!
//! Helpers for the `folder_sync_state` table, which tracks IMAP UIDVALIDITY,
//! last UID, MODSEQ, and last-sync timestamp per (account, folder). Every
//! function takes a `&SqlitePool` and returns `Result<_, AppDbError>`.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::FolderSyncState;
use crate::commands::core::UpsertFolderSyncStateRequest;

/// Retrieve the sync state for a specific account folder.
///
/// Returns `None` (not an error) when no state record exists.
pub async fn get(
    pool: &SqlitePool,
    account_id: &str,
    folder_path: &str,
) -> Result<Option<FolderSyncState>, AppDbError> {
    sqlx::query_as::<_, FolderSyncState>(
        "SELECT * FROM folder_sync_state WHERE account_id = ? AND folder_path = ?",
    )
    .bind(account_id)
    .bind(folder_path)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert-or-replace a folder sync state record.
///
/// Uses `INSERT OR REPLACE`, so an existing record for the same
/// `(account_id, folder_path)` is overwritten. `last_sync_at` defaults to the
/// current epoch second when `state.last_sync_at` is `None`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `state` — the `UpsertFolderSyncStateRequest` to persist.
///
/// # Returns
/// `Ok(())` once the row is inserted or replaced.
///
/// # Errors
/// Returns `AppDbError::Database` on failure.
///
/// # SQL safety
/// Every field of `state` is bound as a positional parameter (`?`).
pub async fn upsert(
    pool: &SqlitePool,
    state: &UpsertFolderSyncStateRequest,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let sync_at = state.last_sync_at.unwrap_or(now);
    let sync_phase = state
        .sync_phase
        .clone()
        .unwrap_or_else(|| "discovered".to_string());

    sqlx::query(
        r#"
        INSERT OR REPLACE INTO folder_sync_state (
            account_id, folder_path,
            uidvalidity, last_uid, modseq,
            last_sync_at,
            sync_phase, last_error, retry_count, is_paused
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&state.account_id)
    .bind(&state.folder_path)
    .bind(state.uidvalidity)
    .bind(state.last_uid)
    .bind(state.modseq)
    .bind(sync_at)
    .bind(sync_phase)
    .bind(&state.last_error)
    .bind(state.retry_count.unwrap_or(0))
    .bind(state.is_paused.unwrap_or(0))
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Advance a folder's sync phase (discovered → headers → backfill → delta → done).
///
/// # SQL safety
/// `phase` is bound as a parameter (`?`); `account_id` / `folder_path` likewise.
pub async fn set_sync_phase(
    pool: &SqlitePool,
    account_id: &str,
    folder_path: &str,
    phase: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE folder_sync_state SET sync_phase = ? WHERE account_id = ? AND folder_path = ?",
    )
    .bind(phase)
    .bind(account_id)
    .bind(folder_path)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Record a sync error for a folder and bump its retry counter.
///
/// Used by the resume algorithm (report.md §6.4) to pause folders that keep
/// failing instead of aborting the whole migration.
///
/// # SQL safety
/// `error` is bound as a parameter; the `retry_count + 1` expression is a
/// constant referencing the local column.
pub async fn record_error(
    pool: &SqlitePool,
    account_id: &str,
    folder_path: &str,
    error: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE folder_sync_state SET last_error = ?, retry_count = retry_count + 1 \
         WHERE account_id = ? AND folder_path = ?",
    )
    .bind(error)
    .bind(account_id)
    .bind(folder_path)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Pause or resume a folder's backfill independently of the others.
///
/// # SQL safety
/// `paused` is bound as a parameter (`?`); coordinate columns are parameters.
pub async fn set_paused(
    pool: &SqlitePool,
    account_id: &str,
    folder_path: &str,
    paused: bool,
) -> Result<(), AppDbError> {
    sqlx::query(
        "UPDATE folder_sync_state SET is_paused = ? WHERE account_id = ? AND folder_path = ?",
    )
    .bind(paused as i64)
    .bind(account_id)
    .bind(folder_path)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// List folders for an account currently paused (interrupted backfill).
///
/// # SQL safety
/// `account_id` is bound as a parameter; `is_paused = 1` is a constant.
pub async fn list_paused(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<FolderSyncState>, AppDbError> {
    sqlx::query_as::<_, FolderSyncState>(
        "SELECT * FROM folder_sync_state WHERE account_id = ?1 AND is_paused = 1 ORDER BY folder_path",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete all folder sync states for an account.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// `Ok(())` once the deletion completes (even if zero rows were affected).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. This operation never
/// returns `AppDbError::NotFound`.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?1`).
pub async fn delete_all_for_account(pool: &SqlitePool, account_id: &str) -> Result<(), AppDbError> {
    sqlx::query("DELETE FROM folder_sync_state WHERE account_id = ?1")
        .bind(account_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// List all folder sync states for an account, ordered by folder_path.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// Every `FolderSyncState` row for the account, ordered ascending by
/// `folder_path`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?1`); the `ORDER BY` column is a
/// constant.
pub async fn list_by_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<FolderSyncState>, AppDbError> {
    let states = sqlx::query_as::<_, FolderSyncState>(
        "SELECT * FROM folder_sync_state WHERE account_id = ?1 ORDER BY folder_path"
    )
    .bind(account_id)
    .fetch_all(pool)
    .await?;
    Ok(states)
}

/// Delete a sync state record for an account folder.
///
/// Does **not** error if the record did not exist.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `folder_path` — the IMAP folder path to delete state for.
///
/// # Returns
/// `Ok(())` once the statement runs (even if no row matched).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. This operation never
/// returns `AppDbError::NotFound`.
///
/// # SQL safety
/// `account_id` and `folder_path` are bound as parameters (`?`).
pub async fn delete(
    pool: &SqlitePool,
    account_id: &str,
    folder_path: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "DELETE FROM folder_sync_state WHERE account_id = ? AND folder_path = ?",
    )
    .bind(account_id)
    .bind(folder_path)
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

    async fn seed_account(pool: &SqlitePool, id: &str, email: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "INSERT INTO accounts (id, email, provider, auth_method, metadata_json, created_at, updated_at) VALUES (?, ?, 'imap', 'password', '{}', ?, ?)",
        )
        .bind(id)
        .bind(email)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
    }

    fn make_upsert_req(account_id: &str, folder: &str) -> UpsertFolderSyncStateRequest {
        UpsertFolderSyncStateRequest {
            account_id: account_id.to_string(),
            folder_path: folder.to_string(),
            uidvalidity: Some(12345),
            last_uid: 100,
            modseq: Some(98765),
            last_sync_at: None,
            sync_phase: None,
            last_error: None,
            retry_count: None,
            is_paused: None,
        }
    }

    #[tokio::test]
    async fn test_upsert_and_get() {
        let pool = create_test_pool().await;
        let account_id = "acc_fss_1";
        seed_account(&pool, account_id, "fss1@example.com").await;

        let req = make_upsert_req(account_id, "INBOX");
        upsert(&pool, &req).await.unwrap();

        let state = get(&pool, account_id, "INBOX").await.unwrap().unwrap();
        assert_eq!(state.folder_path, "INBOX");
        assert_eq!(state.last_uid, 100);
        assert_eq!(state.uidvalidity, Some(12345));
        assert_eq!(state.modseq, Some(98765));
    }

    #[tokio::test]
    async fn test_get_not_found() {
        let pool = create_test_pool().await;
        let result = get(&pool, "nonexistent", "FOLDER").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_upsert_update() {
        let pool = create_test_pool().await;
        let account_id = "acc_fss_2";
        seed_account(&pool, account_id, "fss2@example.com").await;

        let req = make_upsert_req(account_id, "INBOX");
        upsert(&pool, &req).await.unwrap();

        let update_req = UpsertFolderSyncStateRequest {
            account_id: account_id.to_string(),
            folder_path: "INBOX".to_string(),
            uidvalidity: Some(99999),
            last_uid: 200,
            modseq: Some(55555),
            last_sync_at: Some(1234567890),
            sync_phase: None,
            last_error: None,
            retry_count: None,
            is_paused: None,
        };
        upsert(&pool, &update_req).await.unwrap();

        let state = get(&pool, account_id, "INBOX").await.unwrap().unwrap();
        assert_eq!(state.last_uid, 200);
        assert_eq!(state.uidvalidity, Some(99999));
        assert_eq!(state.last_sync_at, Some(1234567890));
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = create_test_pool().await;
        let account_id = "acc_fss_3";
        seed_account(&pool, account_id, "fss3@example.com").await;

        let req = make_upsert_req(account_id, "INBOX");
        upsert(&pool, &req).await.unwrap();

        delete(&pool, account_id, "INBOX").await.unwrap();

        let result = get(&pool, account_id, "INBOX").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_delete_nonexistent() {
        let pool = create_test_pool().await;
        // Should not error when record does not exist
        delete(&pool, "no_account", "NO_FOLDER").await.unwrap();
    }
}
