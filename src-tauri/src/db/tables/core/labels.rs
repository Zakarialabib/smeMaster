//! Labels table data-access layer.
//!
//! Helpers for the `labels` table. Every function takes a `&SqlitePool` and
//! returns `Result<_, AppDbError>`. Lookups that require a row use a
//! `AppDbError::NotFound` error; bulk deletes never error on absence.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::Label;
use crate::commands::core::UpsertLabelRequest;

/// Retrieve all labels for a given account, ordered by `sort_order`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
///
/// # Returns
/// Every `Label` row for the account, ordered ascending by `sort_order`.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure.
///
/// # SQL safety
/// `account_id` is bound as a parameter (`?`); the `ORDER BY` column is a
/// constant.
pub async fn get_by_account(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<Label>, AppDbError> {
    sqlx::query_as::<_, Label>(
        "SELECT * FROM labels WHERE account_id = ? ORDER BY sort_order ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single label by its composite primary key (account_id, id).
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `id` — the label's primary key.
///
/// # Returns
/// The matching `Label` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no label matches the given
/// `(account_id, id)` pair.
///
/// # SQL safety
/// Both `account_id` and `id` are bound as parameters (`?`); they are never
/// interpolated into the SQL string.
pub async fn get_by_id(
    pool: &SqlitePool,
    account_id: &str,
    id: &str,
) -> Result<Label, AppDbError> {
    sqlx::query_as::<_, Label>(
        "SELECT * FROM labels WHERE account_id = ? AND id = ?",
    )
    .bind(account_id)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| {
        AppDbError::NotFound(format!(
            "Label with account_id '{account_id}' and id '{id}' not found"
        ))
    })
}

/// Insert-or-replace a label.
///
/// Converts `visible` from `Option<bool>` to `i64` (default 1).
/// `sort_order` defaults to 0 when `None`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `label` — the `UpsertLabelRequest` to persist.
///
/// # Returns
/// `Ok(())` once the row is inserted or replaced.
///
/// # Errors
/// Returns `AppDbError::Database` on failure.
///
/// # SQL safety
/// Every field of `label` is bound as a positional parameter (`?`).
pub async fn upsert(pool: &SqlitePool, label: UpsertLabelRequest) -> Result<(), AppDbError> {
    let visible = if let Some(v) = label.visible {
        if v { 1_i64 } else { 0_i64 }
    } else {
        1_i64
    };
    let sort_order = label.sort_order.unwrap_or(0);

    sqlx::query(
        r#"
        INSERT OR REPLACE INTO labels (
            account_id, id, name, "type",
            color_bg, color_fg,
            visible, sort_order,
            imap_folder_path, imap_special_use
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&label.account_id)
    .bind(&label.id)
    .bind(&label.name)
    .bind(&label.label_type)
    .bind(&label.color_bg)
    .bind(&label.color_fg)
    .bind(visible)
    .bind(sort_order)
    .bind(&label.imap_folder_path)
    .bind(&label.imap_special_use)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete all labels for an account.
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
    sqlx::query("DELETE FROM labels WHERE account_id = ?1")
        .bind(account_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Update a single label's sort order.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — the label's primary key.
/// - `sort_order` — the new sort position.
///
/// # Returns
/// `Ok(())` once the row is updated.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. This operation does not
/// check whether the label exists.
///
/// # SQL safety
/// Both `sort_order` and `id` are bound as parameters (`?1`, `?2`).
pub async fn update_sort_order(
    pool: &SqlitePool,
    id: &str,
    sort_order: i64,
) -> Result<(), AppDbError> {
    sqlx::query("UPDATE labels SET sort_order = ?1 WHERE id = ?2")
        .bind(sort_order)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Delete a label by its composite primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `account_id` — the owning account primary key.
/// - `id` — the label's primary key.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` when no label matches the `(account_id, id)`
/// pair (zero rows affected).
///
/// # SQL safety
/// Both `account_id` and `id` are bound as parameters (`?`); the `DELETE`
/// statement is plain (no dynamic SQL).
pub async fn delete_by_id(
    pool: &SqlitePool,
    account_id: &str,
    id: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM labels WHERE account_id = ? AND id = ?")
        .bind(account_id)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "Label with account_id '{account_id}' and id '{id}' not found"
        )));
    }
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

    /// Insert a minimal account row so foreign-key constraints are satisfied.
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

    fn make_upsert_req(account_id: &str, label_id: &str) -> UpsertLabelRequest {
        UpsertLabelRequest {
            account_id: account_id.to_string(),
            id: label_id.to_string(),
            name: "INBOX".to_string(),
            label_type: "system".to_string(),
            color_bg: Some("#ff0000".to_string()),
            color_fg: Some("#ffffff".to_string()),
            visible: Some(true),
            sort_order: Some(1),
            imap_folder_path: Some("INBOX".to_string()),
            imap_special_use: Some("\\Inbox".to_string()),
        }
    }

    #[tokio::test]
    async fn test_upsert_and_get_by_id() {
        let pool = create_test_pool().await;
        let account_id = "acc_labels_1";
        seed_account(&pool, account_id, "labels@example.com").await;

        let req = make_upsert_req(account_id, "label_1");
        upsert(&pool, req).await.unwrap();

        let label = get_by_id(&pool, account_id, "label_1").await.unwrap();
        assert_eq!(label.name, "INBOX");
        assert_eq!(label.label_type, "system");
        assert_eq!(label.color_bg.as_deref(), Some("#ff0000"));
        assert_eq!(label.visible, 1);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = create_test_pool().await;
        let err = get_by_id(&pool, "nonexistent", "no_label").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_account() {
        let pool = create_test_pool().await;
        let account_id = "acc_labels_2";
        seed_account(&pool, account_id, "labels2@example.com").await;

        let req1 = make_upsert_req(account_id, "label_a");
        upsert(&pool, req1).await.unwrap();
        let req2 = make_upsert_req(account_id, "label_b");
        upsert(&pool, req2).await.unwrap();

        let labels = get_by_account(&pool, account_id).await.unwrap();
        assert_eq!(labels.len(), 2);
    }

    #[tokio::test]
    async fn test_upsert_update_existing() {
        let pool = create_test_pool().await;
        let account_id = "acc_labels_3";
        seed_account(&pool, account_id, "labels3@example.com").await;

        let req = make_upsert_req(account_id, "label_upd");
        upsert(&pool, req).await.unwrap();

        let mut update_req = make_upsert_req(account_id, "label_upd");
        update_req.name = "UPDATED".to_string();
        update_req.sort_order = Some(99);
        upsert(&pool, update_req).await.unwrap();

        let label = get_by_id(&pool, account_id, "label_upd").await.unwrap();
        assert_eq!(label.name, "UPDATED");
        assert_eq!(label.sort_order, 99);
    }

    #[tokio::test]
    async fn test_delete_by_id() {
        let pool = create_test_pool().await;
        let account_id = "acc_labels_4";
        seed_account(&pool, account_id, "labels4@example.com").await;

        let req = make_upsert_req(account_id, "label_del");
        upsert(&pool, req).await.unwrap();

        delete_by_id(&pool, account_id, "label_del").await.unwrap();

        let err = get_by_id(&pool, account_id, "label_del").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_by_id_not_found() {
        let pool = create_test_pool().await;
        let err = delete_by_id(&pool, "nonexistent", "no_label").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
