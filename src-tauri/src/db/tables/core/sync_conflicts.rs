//! Sync-conflict audit table data-access layer.
//!
//! Logs source-vs-local divergences encountered during import (report.md
//! §6.3) so a user can see *why* a starred / flagged / folder assignment
//! moved instead of being silently surprised. Entries start `pending` and are
//! resolved explicitly (source_wins / local_wins).
//!
//! Request structs live in `crate::commands::core` (mirroring the
//! `folder_sync_state` convention) and are imported here.

use sqlx::SqlitePool;

use crate::commands::core::RecordSyncConflictRequest;
use crate::db::error::AppDbError;
use crate::db::mail::schema::SyncConflict;

/// Record a source-vs-local divergence during import.
pub async fn record(pool: &SqlitePool, req: &RecordSyncConflictRequest) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        r#"
        INSERT INTO sync_conflicts (
            id, account_id, folder_path, conflict_type,
            message_id_header, source_value, local_value, resolved, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        "#,
    )
    .bind(&req.id)
    .bind(&req.account_id)
    .bind(&req.folder_path)
    .bind(&req.conflict_type)
    .bind(&req.message_id_header)
    .bind(&req.source_value)
    .bind(&req.local_value)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// List conflicts for an account, optionally only the unresolved ones.
///
/// The SQL literal for the `resolved` filter is a constant chosen by the
/// `only_unresolved` flag — no user input reaches the query text.
pub async fn list_by_account(
    pool: &SqlitePool,
    account_id: &str,
    only_unresolved: bool,
) -> Result<Vec<SyncConflict>, AppDbError> {
    let sql = if only_unresolved {
        "SELECT * FROM sync_conflicts WHERE account_id = ?1 AND resolved = 'pending' ORDER BY created_at DESC"
    } else {
        "SELECT * FROM sync_conflicts WHERE account_id = ?1 ORDER BY created_at DESC"
    };
    sqlx::query_as::<_, SyncConflict>(sql)
        .bind(account_id)
        .fetch_all(pool)
        .await
        .map_err(AppDbError::Database)
}

/// Resolve a conflict (e.g. `source_wins` / `local_wins`).
pub async fn resolve(pool: &SqlitePool, id: &str, resolution: &str) -> Result<(), AppDbError> {
    sqlx::query("UPDATE sync_conflicts SET resolved = ? WHERE id = ?")
        .bind(resolution)
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

    fn make_req(id: &str, account_id: &str, conflict_type: &str) -> RecordSyncConflictRequest {
        RecordSyncConflictRequest {
            id: id.to_string(),
            account_id: account_id.to_string(),
            folder_path: "INBOX".to_string(),
            conflict_type: conflict_type.to_string(),
            message_id_header: Some("<abc@mail>".to_string()),
            source_value: Some("starred".to_string()),
            local_value: Some("unread".to_string()),
        }
    }

    #[tokio::test]
    async fn test_record_and_list() {
        let pool = create_test_pool().await;
        record(&pool, &make_req("c1", "acc_sc_1", "flag_divergence")).await.unwrap();

        let all = list_by_account(&pool, "acc_sc_1", false).await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].resolved, "pending");

        let unresolved = list_by_account(&pool, "acc_sc_1", true).await.unwrap();
        assert_eq!(unresolved.len(), 1);
    }

    #[tokio::test]
    async fn test_resolve_filters_list() {
        let pool = create_test_pool().await;
        record(&pool, &make_req("c2", "acc_sc_2", "folder_rename")).await.unwrap();
        resolve(&pool, "c2", "source_wins").await.unwrap();

        let unresolved = list_by_account(&pool, "acc_sc_2", true).await.unwrap();
        assert_eq!(unresolved.len(), 0);

        let all = list_by_account(&pool, "acc_sc_2", false).await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].resolved, "source_wins");
    }
}
