//! Engagement-log query functions.
//!
//! This module records and queries engagement events (emails, meetings, calls,
//! etc.) stored in the `engagement_log` table. All functions are async and
//! return `Result<_, AppDbError>`.

// ── Engagement Log query functions ────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::contacts::schema::{EngagementLog, EngagementTrendPoint, DailyCount};

/// Record a new engagement event in the `engagement_log` table.
///
/// # Parameters
/// - `entity_type`: optional kind of related entity (e.g. `contact`, `deal`).
/// - `entity_id`: optional related entity primary key.
/// - `contact_id`: optional related contact primary key.
/// - `event_type`: the engagement kind (e.g. `email`, `meeting`, `call`).
/// - `score_delta`: the engagement-score delta to record.
/// - `metadata_json`: optional JSON metadata string (defaults to `"{}"`).
///
/// # Returns
/// `Ok(())` on success. `id` is auto-generated (UUID v4) and `created_at` to `now`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn log(
    pool: &SqlitePool,
    entity_type: Option<&str>,
    entity_id: Option<&str>,
    contact_id: Option<&str>,
    event_type: &str,
    score_delta: f64,
    metadata_json: Option<&str>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let metadata = metadata_json.unwrap_or("{}");

    sqlx::query(
        "INSERT INTO engagement_log \
         (id, contact_id, entity_type, entity_id, event_type, score_delta, metadata_json, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(contact_id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(event_type)
    .bind(score_delta)
    .bind(metadata)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Get recent engagement history for a contact.
pub async fn get_history(
    pool: &SqlitePool,
    contact_id: &str,
    limit: i64,
) -> Result<Vec<EngagementLog>, AppDbError> {
    sqlx::query_as::<_, EngagementLog>(
        "SELECT * FROM engagement_log WHERE contact_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(contact_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get engagement score trend aggregated by day.
pub async fn get_engagement_trend(
    pool: &SqlitePool,
    contact_id: &str,
    cutoff: i64,
) -> Result<Vec<EngagementTrendPoint>, AppDbError> {
    sqlx::query_as::<_, EngagementTrendPoint>(
        "SELECT date(created_at, 'unixepoch') as date, SUM(score_delta) as score \
         FROM engagement_log \
         WHERE contact_id = ? AND created_at >= ? \
         GROUP BY date(created_at, 'unixepoch') \
         ORDER BY date ASC",
    )
    .bind(contact_id)
    .bind(cutoff)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get recent engagement events for a specific entity, with optional cutoff.
///
/// # Parameters
/// - `entity_type`: the kind of entity to look up.
/// - `entity_id`: the entity's primary key.
/// - `cutoff`: when `Some(c)`, only include events with `created_at >= c`;
///   when `None`, include all events for the entity.
///
/// # Returns
/// A `Vec<EngagementLog>` ordered by `created_at DESC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_engagement_for_entity(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    cutoff: Option<i64>,
) -> Result<Vec<EngagementLog>, AppDbError> {
    match cutoff {
        Some(cut) => {
            sqlx::query_as::<_, EngagementLog>(
                "SELECT * FROM engagement_log \
                 WHERE entity_type = ? AND entity_id = ? AND created_at >= ? \
                 ORDER BY created_at DESC",
            )
            .bind(entity_type)
            .bind(entity_id)
            .bind(cut)
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
        None => {
            sqlx::query_as::<_, EngagementLog>(
                "SELECT * FROM engagement_log \
                 WHERE entity_type = ? AND entity_id = ? \
                 ORDER BY created_at DESC",
            )
            .bind(entity_type)
            .bind(entity_id)
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Get recent engagement events for a specific entity, newest first.
///
/// # Parameters
/// - `entity_type`: the kind of entity to look up.
/// - `entity_id`: the entity's primary key.
/// - `limit`: maximum number of events returned.
///
/// # Returns
/// A `Vec<EngagementLog>` ordered by `created_at DESC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_by_entity(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    limit: i64,
) -> Result<Vec<EngagementLog>, AppDbError> {
    sqlx::query_as::<_, EngagementLog>(
        "SELECT * FROM engagement_log \
         WHERE entity_type = ? AND entity_id = ? \
         ORDER BY created_at DESC LIMIT ?",
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// List recent engagement activity across all contacts, newest first.
///
/// # Parameters
/// - `limit`: maximum number of events returned.
///
/// # Returns
/// A `Vec<EngagementLog>` ordered by `created_at DESC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn list_recent(pool: &SqlitePool, limit: i64) -> Result<Vec<EngagementLog>, AppDbError> {
    sqlx::query_as::<_, EngagementLog>(
        "SELECT * FROM engagement_log ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get daily engagement counts aggregated by day over a lookback window.
///
/// # Parameters
/// - `days`: number of days to look back; events with
///   `created_at >= now - days*86400` are included.
///
/// # Returns
/// A `Vec<DailyCount>` (one per day) ordered by `date ASC`.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_daily_counts(
    pool: &SqlitePool,
    days: i64,
) -> Result<Vec<DailyCount>, AppDbError> {
    let cutoff = chrono::Utc::now().timestamp() - days * 86400;
    sqlx::query_as::<_, DailyCount>(
        "SELECT date(created_at, 'unixepoch') as date, COUNT(*) as count \
         FROM engagement_log \
         WHERE created_at >= ? \
         GROUP BY date(created_at, 'unixepoch') \
         ORDER BY date ASC",
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    async fn create_test_pool() -> sqlx::SqlitePool {
        let pool = helpers::create_memory_pool().await;
        // Add migration columns that the `log` INSERT expects
        sqlx::query("ALTER TABLE engagement_log ADD COLUMN entity_type TEXT")
            .execute(&pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE engagement_log ADD COLUMN entity_id TEXT")
            .execute(&pool)
            .await
            .ok();
        sqlx::query("ALTER TABLE engagement_log ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'")
            .execute(&pool)
            .await
            .ok();
        pool
    }

    #[tokio::test]
    async fn test_log_engagement() {
        let pool = create_test_pool().await;
        helpers::insert_test_contact(&pool, "log-contact").await;

        log(&pool, Some("contact"), Some("log-contact"), Some("log-contact"), "email", 1.5, Some(r#"{"subject":"Hello"}"#))
            .await
            .unwrap();

        let history = get_history(&pool, "log-contact", 10).await.unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].event_type, "email");
        assert_eq!(history[0].score_delta, 1.5);
        assert_eq!(history[0].metadata_json, r#"{"subject":"Hello"}"#);
    }

    #[tokio::test]
    async fn test_get_history_limit() {
        let pool = create_test_pool().await;
        helpers::insert_test_contact(&pool, "hist-contact").await;

        // Log multiple events
        for i in 0..5 {
            log(
                &pool,
                Some("contact"),
                Some("hist-contact"),
                Some("hist-contact"),
                "email",
                (i as f64) + 1.0,
                None,
            )
            .await
            .unwrap();
        }

        let all = get_history(&pool, "hist-contact", 10).await.unwrap();
        assert_eq!(all.len(), 5);

        let limited = get_history(&pool, "hist-contact", 3).await.unwrap();
        assert_eq!(limited.len(), 3);

        // Results are in DESC order by created_at (most recent first)
        assert!(limited[0].created_at >= limited[1].created_at);
    }

    #[tokio::test]
    async fn test_get_by_entity() {
        let pool = create_test_pool().await;
        helpers::insert_test_contact(&pool, "ent-contact").await;

        // Log events for entity type "deal", id "deal-1"
        log(&pool, Some("deal"), Some("deal-1"), Some("ent-contact"), "email", 1.0, None).await.unwrap();
        log(&pool, Some("deal"), Some("deal-1"), Some("ent-contact"), "meeting", 2.0, None).await.unwrap();
        // Different entity
        log(&pool, Some("deal"), Some("deal-2"), Some("ent-contact"), "call", 0.5, None).await.unwrap();

        let events = get_by_entity(&pool, "deal", "deal-1", 10).await.unwrap();
        assert_eq!(events.len(), 2);
        assert!(events.iter().any(|e| e.event_type == "email"));
        assert!(events.iter().any(|e| e.event_type == "meeting"));

        // No events for unknown entity
        let empty = get_by_entity(&pool, "deal", "nonexistent", 10).await.unwrap();
        assert!(empty.is_empty());
    }
}
