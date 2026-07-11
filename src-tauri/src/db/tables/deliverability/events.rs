//! Deliverability events — an append-only log of per-account deliverability
//! occurrences (bounces, complaints, etc.). Each event's arbitrary payload lives
//! in the `event_data_json` column. Read-only within this module: `list` and
//! `list_by_type` (write via `create`).

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::deliverability::schema::DeliverabilityEvent;

/// List all deliverability events for an account, most recent first.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
///
/// # Returns
/// All events for the account ordered by `created_at DESC` (newest first). An
/// empty `Vec` (not an error) is returned when the account has no events.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<DeliverabilityEvent>, AppDbError> {
    sqlx::query_as::<_, DeliverabilityEvent>(
        "SELECT * FROM deliverability_events WHERE account_id = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Create a new deliverability event and return the full row.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `event_type` — discriminator for the event (e.g. `"bounce"`, `"complaint"`).
/// * `event_data_json` — arbitrary JSON payload describing the event.
///
/// # Returns
/// The newly inserted `DeliverabilityEvent` row (with generated `id` and
/// `created_at`).
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn create(
    pool: &SqlitePool,
    account_id: &str,
    event_type: &str,
    event_data_json: &str,
) -> Result<DeliverabilityEvent, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, DeliverabilityEvent>(
        r#"
        INSERT INTO deliverability_events (id, account_id, event_type, event_data_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(account_id)
    .bind(event_type)
    .bind(event_data_json)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List events filtered by type, most recent first.
///
/// # Parameters
/// * `pool` — DB connection pool.
/// * `account_id` — owning account id.
/// * `event_type` — event-type discriminator to filter on.
///
/// # Returns
/// All matching events for the account ordered by `created_at DESC`. An empty
/// `Vec` (not an error) when no events of that type exist.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Never returns
/// `AppDbError::NotFound`.
pub async fn list_by_type(
    pool: &SqlitePool,
    account_id: &str,
    event_type: &str,
) -> Result<Vec<DeliverabilityEvent>, AppDbError> {
    sqlx::query_as::<_, DeliverabilityEvent>(
        "SELECT * FROM deliverability_events WHERE account_id = ? AND event_type = ? ORDER BY created_at DESC",
    )
    .bind(account_id)
    .bind(event_type)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-evt-1";
        helpers::insert_test_account(&pool, account_id).await;
        let event = create(&pool, account_id, "bounce", r#"{"code":"5.1.1"}"#)
            .await
            .unwrap();
        assert_eq!(event.account_id, account_id);
        assert_eq!(event.event_type, "bounce");
        assert_eq!(event.event_data_json, r#"{"code":"5.1.1"}"#);

        let items = list(&pool, account_id).await.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, event.id);
    }

    #[tokio::test]
    async fn test_list_by_type() {
        let pool = helpers::create_memory_pool().await;
        let account_id = "acc-evt-2";
        helpers::insert_test_account(&pool, account_id).await;
        create(&pool, account_id, "bounce", r#"{"code":"5.1.1"}"#)
            .await
            .unwrap();
        create(&pool, account_id, "complaint", r#"{"type":"abuse"}"#)
            .await
            .unwrap();
        create(&pool, account_id, "bounce", r#"{"code":"5.1.2"}"#)
            .await
            .unwrap();

        let bounces = list_by_type(&pool, account_id, "bounce").await.unwrap();
        assert_eq!(bounces.len(), 2);
        assert!(bounces.iter().all(|e| e.event_type == "bounce"));
    }

    #[tokio::test]
    async fn test_list_by_type_empty() {
        let pool = helpers::create_memory_pool().await;
        let items = list_by_type(&pool, "acc-evt-3", "bounce").await.unwrap();
        assert!(items.is_empty());
    }

    #[tokio::test]
    async fn test_list_empty_account() {
        let pool = helpers::create_memory_pool().await;
        let items = list(&pool, "acc-evt-none").await.unwrap();
        assert!(items.is_empty());
    }
}
