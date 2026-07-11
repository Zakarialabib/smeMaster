// ── Allowlist query functions ───────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::security::schema::Allowlist;

/// List all allowlist entries for an account, newest first.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<Allowlist>, AppDbError> {
    sqlx::query_as::<_, Allowlist>(
        "SELECT * FROM allowlists WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List allowlist entries filtered by type (e.g. "sender", "domain", "image").
pub async fn list_by_type(
    pool: &SqlitePool,
    account_id: &str,
    list_type: &str,
) -> Result<Vec<Allowlist>, AppDbError> {
    sqlx::query_as::<_, Allowlist>(
        "SELECT * FROM allowlists WHERE account_id = ? AND list_type = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .bind(list_type)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Add a target to an allowlist.
///
/// Uses `ON CONFLICT(account_id, list_type, target) DO NOTHING` to prevent
/// duplicate entries. When a duplicate is detected, the existing row is
/// returned instead.
pub async fn add_to_list(
    pool: &SqlitePool,
    account_id: &str,
    list_type: &str,
    target: &str,
    display_name: Option<&str>,
) -> Result<Allowlist, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    let result = sqlx::query_as::<_, Allowlist>(
        r#"
        INSERT INTO allowlists (id, account_id, list_type, target, display_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, list_type, target) DO NOTHING
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(list_type)
    .bind(target)
    .bind(display_name)
    .bind(now)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?;

    match result {
        Some(row) => Ok(row),
        None => {
            // Duplicate — fetch the existing row
            sqlx::query_as::<_, Allowlist>(
                "SELECT * FROM allowlists WHERE account_id = ? AND list_type = ? AND target = ?",
            )
            .bind(account_id)
            .bind(list_type)
            .bind(target)
            .fetch_one(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Remove a specific target from an allowlist.
pub async fn remove_from_list(
    pool: &SqlitePool,
    account_id: &str,
    list_type: &str,
    target: &str,
) -> Result<(), AppDbError> {
    let rows = sqlx::query(
        "DELETE FROM allowlists WHERE account_id = ? AND list_type = ? AND target = ?",
    )
    .bind(account_id)
    .bind(list_type)
    .bind(target)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?
    .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!(
            "Allowlist entry account_id='{account_id}' list_type='{list_type}' target='{target}' not found"
        )));
    }
    Ok(())
}

/// Check whether a target exists in an allowlist.
///
/// Returns `true` if the target is present.
pub async fn check_target(
    pool: &SqlitePool,
    account_id: &str,
    list_type: &str,
    target: &str,
) -> Result<bool, AppDbError> {
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM allowlists WHERE account_id = ? AND list_type = ? AND target = ?",
    )
    .bind(account_id)
    .bind(list_type)
    .bind(target)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(count.0 > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_add_to_list_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-al-1";
        helpers::insert_test_account(&pool, account_id).await;

        let entry = add_to_list(&pool, account_id, "sender", "trusted@example.com", Some("Trusted Sender"))
            .await
            .unwrap();
        assert_eq!(entry.account_id, account_id);
        assert_eq!(entry.list_type, "sender");
        assert_eq!(entry.target, "trusted@example.com");
        assert_eq!(entry.display_name, Some("Trusted Sender".to_string()));

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, entry.id);
    }

    #[tokio::test]
    async fn test_add_to_list_duplicate() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-al-2").await;
        add_to_list(&pool, "acc-al-2", "domain", "example.com", None)
            .await
            .unwrap();
        // Duplicate insert should be a no-op
        let dup = add_to_list(&pool, "acc-al-2", "domain", "example.com", Some("Different"))
            .await
            .unwrap();
        assert_eq!(dup.display_name, None);
    }

    #[tokio::test]
    async fn test_list_by_type() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-al-3";
        helpers::insert_test_account(&pool, account_id).await;
        add_to_list(&pool, account_id, "sender", "a@x.com", None).await.unwrap();
        add_to_list(&pool, account_id, "domain", "x.com", None).await.unwrap();
        add_to_list(&pool, account_id, "sender", "b@x.com", None).await.unwrap();

        let senders = list_by_type(&pool, account_id, "sender").await.unwrap();
        assert_eq!(senders.len(), 2);
        assert!(senders.iter().all(|e| e.list_type == "sender"));
    }

    #[tokio::test]
    async fn test_check_target() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-al-4";
        helpers::insert_test_account(&pool, account_id).await;
        add_to_list(&pool, account_id, "sender", "vip@example.com", None)
            .await
            .unwrap();

        let found = check_target(&pool, account_id, "sender", "vip@example.com")
            .await
            .unwrap();
        assert!(found);

        let not_found = check_target(&pool, account_id, "sender", "unknown@example.com")
            .await
            .unwrap();
        assert!(!not_found);
    }

    #[tokio::test]
    async fn test_remove_from_list() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc-al-5").await;
        add_to_list(&pool, "acc-al-5", "sender", "remove@example.com", None)
            .await
            .unwrap();
        remove_from_list(&pool, "acc-al-5", "sender", "remove@example.com")
            .await
            .unwrap();
        let found = check_target(&pool, "acc-al-5", "sender", "remove@example.com")
            .await
            .unwrap();
        assert!(!found);
    }

    #[tokio::test]
    async fn test_remove_from_list_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = remove_from_list(&pool, "acc-none", "sender", "ghost@example.com")
            .await
            .unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }
}
