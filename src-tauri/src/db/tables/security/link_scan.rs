// ── Link scan result query functions ────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::security::schema::LinkScanResult;

/// Get the scan result for a specific message.
///
/// Returns `None` when the message has not been scanned yet.
pub async fn get_by_message(
    pool: &SqlitePool,
    message_id: &str,
    account_id: &str,
) -> Result<Option<LinkScanResult>, AppDbError> {
    sqlx::query_as::<_, LinkScanResult>(
        "SELECT * FROM link_scan_results WHERE message_id = ? AND account_id = ?",
    )
    .bind(message_id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Insert or update a link scan result for a message.
///
/// Uses `ON CONFLICT(message_id, account_id) DO UPDATE` so each message
/// has at most one scan result row.
pub async fn upsert_result(
    pool: &SqlitePool,
    message_id: &str,
    account_id: &str,
    result_json: &str,
) -> Result<LinkScanResult, AppDbError> {
    let now = chrono::Utc::now().timestamp();

    sqlx::query_as::<_, LinkScanResult>(
        r#"
        INSERT INTO link_scan_results (message_id, account_id, result_json, scanned_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(message_id, account_id) DO UPDATE
        SET result_json = excluded.result_json,
            scanned_at = excluded.scanned_at
        RETURNING *
        "#,
    )
    .bind(message_id)
    .bind(account_id)
    .bind(result_json)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_upsert_and_get() {
        let pool = helpers::create_memory_pool().await;
        let message_id = "msg-1";
        let account_id = "acc-ls-1";

        let result = upsert_result(&pool, message_id, account_id, r#"{"safe":true,"threats":[]}"#)
            .await
            .unwrap();
        assert_eq!(result.message_id, message_id);
        assert_eq!(result.account_id, account_id);
        assert_eq!(result.result_json, r#"{"safe":true,"threats":[]}"#);

        let found = get_by_message(&pool, message_id, account_id)
            .await
            .unwrap()
            .expect("should find scan result");
        assert_eq!(found.result_json, r#"{"safe":true,"threats":[]}"#);
    }

    #[tokio::test]
    async fn test_upsert_updates_existing() {
        let pool = helpers::create_memory_pool().await;
        upsert_result(&pool, "msg-2", "acc-ls-2", r#"{"safe":false}"#)
            .await
            .unwrap();
        let updated = upsert_result(&pool, "msg-2", "acc-ls-2", r#"{"safe":true,"threats":[]}"#)
            .await
            .unwrap();
        assert_eq!(updated.result_json, r#"{"safe":true,"threats":[]}"#);
    }

    #[tokio::test]
    async fn test_get_by_message_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_message(&pool, "msg-none", "acc-none")
            .await
            .unwrap();
        assert!(result.is_none());
    }
}
