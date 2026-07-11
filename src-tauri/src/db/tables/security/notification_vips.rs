// ── Notification VIP query functions ────────────────────────────────────────

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;

/// A VIP sender whose notifications bypass bundling and silencing rules.
///
/// Defined inline — this struct exists in `schema.sql` but NOT in `schema.rs`.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationVip {
    pub id: String,
    pub account_id: String,
    pub email_address: String,
    pub display_name: Option<String>,
    pub created_at: i64,
}

/// List all notification VIPs for an account, newest first.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<NotificationVip>, AppDbError> {
    sqlx::query_as::<_, NotificationVip>(
        "SELECT * FROM notification_vips WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Add a VIP sender.
///
/// Uses `ON CONFLICT(account_id, email_address) DO NOTHING` to prevent
/// duplicate VIP entries. When a duplicate is detected, the existing
/// row is returned instead.
pub async fn add_vip(
    pool: &SqlitePool,
    account_id: &str,
    email_address: &str,
    display_name: Option<&str>,
) -> Result<NotificationVip, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    let result = sqlx::query_as::<_, NotificationVip>(
        r#"
        INSERT INTO notification_vips (id, account_id, email_address, display_name, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(account_id, email_address) DO NOTHING
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(email_address)
    .bind(display_name)
    .bind(now)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;

    match result {
        Some(row) => Ok(row),
        None => {
            // Duplicate — fetch the existing row
            sqlx::query_as::<_, NotificationVip>(
                "SELECT * FROM notification_vips WHERE account_id = ? AND email_address = ?",
            )
            .bind(account_id)
            .bind(email_address)
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Remove a VIP sender by email address.
pub async fn remove_vip(
    pool: &SqlitePool,
    account_id: &str,
    email_address: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "DELETE FROM notification_vips WHERE account_id = ? AND email_address = ?",
    )
    .bind(account_id)
    .bind(email_address)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "NotificationVip account_id='{account_id}' email='{email_address}' not found"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    async fn create_test_pool() -> sqlx::SqlitePool {
        let pool = helpers::create_memory_pool().await;
        // notification_vips table created by migrations; ensure it exists
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS notification_vips (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                email_address TEXT NOT NULL,
                display_name TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                UNIQUE(account_id, email_address)
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn test_add_vip_and_list() {
        let pool = create_test_pool().await;
        let account_id = "acc-vip-1";
        helpers::insert_test_account(&pool, account_id).await;

        let vip = add_vip(&pool, account_id, "ceo@example.com", Some("CEO"))
            .await
            .unwrap();
        assert_eq!(vip.account_id, account_id);
        assert_eq!(vip.email_address, "ceo@example.com");
        assert_eq!(vip.display_name, Some("CEO".to_string()));

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, vip.id);
    }

    #[tokio::test]
    async fn test_add_vip_duplicate() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acc-vip-2").await;
        add_vip(&pool, "acc-vip-2", "vip@example.com", Some("Original"))
            .await
            .unwrap();
        // Duplicate should be a no-op
        let dup = add_vip(&pool, "acc-vip-2", "vip@example.com", Some("Override"))
            .await
            .unwrap();
        assert_eq!(dup.display_name, Some("Original".to_string()));
    }

    #[tokio::test]
    async fn test_remove_vip() {
        let pool = create_test_pool().await;
        helpers::insert_test_account(&pool, "acc-vip-3").await;
        add_vip(&pool, "acc-vip-3", "remove@example.com", None)
            .await
            .unwrap();
        remove_vip(&pool, "acc-vip-3", "remove@example.com")
            .await
            .unwrap();
        let items = list(&pool, "acc-vip-3").await.unwrap();
        assert!(items.is_empty());
    }

    #[tokio::test]
    async fn test_remove_vip_not_found() {
        let pool = create_test_pool().await;
        let err = remove_vip(&pool, "acc-none", "ghost@example.com")
            .await
            .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
