// ── Calendar domain operations ─────────────────────────────────────────────
//
// High-level operations that orchestrate multiple table queries.
// This module provides the `sync_all_calendars` entry point used by the
// background CalDAV sync loop.
//
// The CalDAV HTTP protocol and iCalendar parsing have been extracted into
// `crate::calendar::drivers::caldav::CalDavDriver`. This module retains
// the DB orchestration (querying calendars, upserting events, updating
// sync tokens) and delegates remote protocol operations to the driver.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::calendar::drivers::CalendarDriverRegistry;
use crate::db::calendar::schema::Calendar;
use crate::db::core::schema::Account;
use crate::db::error::AppDbError;
use crate::error::SerializedError;

/// Summary returned after a sync-all-calendars cycle.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncSummary {
    /// Number of calendars that synced without error.
    pub synced_ok: usize,
    /// Number of calendars that hit an error during sync.
    pub synced_error: usize,
}

/// Upsert a single event into the calendar_events table.
///
/// Accepts a `CalendarEvent` as returned by the driver's `fetch_events()`.
async fn upsert_event(
    pool: &SqlitePool,
    event: &crate::db::calendar::schema::CalendarEvent,
) -> Result<(), SerializedError> {
    let now = chrono::Utc::now().timestamp();

    // Use remote_event_id (UID) as the dedup key
    let uid = event.remote_event_id.as_deref().unwrap_or("");
    let account_id = &event.company_id;
    let calendar_id = event.calendar_id.as_deref().unwrap_or("");

    // Check if it already exists by remote_event_id + calendar_id
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM calendar_events WHERE account_id = ?1 AND remote_event_id = ?2 AND calendar_id = ?3"
    )
    .bind(account_id)
    .bind(uid)
    .bind(calendar_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;

    if let Some((existing_id,)) = existing {
        // Update existing event
        sqlx::query(
            "UPDATE calendar_events SET summary = ?1, description = ?2, location = ?3, \
             start_time = ?4, end_time = ?5, is_all_day = ?6, status = ?7, \
             organizer_email = ?8, ical_data = ?9, updated_at = ?10 \
             WHERE id = ?11"
        )
        .bind(&event.summary)
        .bind(&event.description)
        .bind(&event.location)
        .bind(event.start_time)
        .bind(event.end_time)
        .bind(event.is_all_day)
        .bind(&event.status)
        .bind(&event.organizer_email)
        .bind(&event.ical_data)
        .bind(now)
        .bind(&existing_id)
        .execute(pool)
        .await
        .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    } else {
        // Insert new event
        let mut id = event.id.clone();
        if id.is_empty() {
            id = uuid::Uuid::new_v4().to_string();
        }
        sqlx::query(
            "INSERT INTO calendar_events (id, account_id, calendar_id, google_event_id, \
             remote_event_id, summary, description, location, start_time, end_time, \
             is_all_day, status, organizer_email, attendees_json, html_link, etag, \
             ical_data, uid, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)"
        )
        .bind(&id)
        .bind(account_id)
        .bind(calendar_id)
        .bind(&event.google_event_id)
        .bind(&event.remote_event_id)
        .bind(&event.summary)
        .bind(&event.description)
        .bind(&event.location)
        .bind(event.start_time)
        .bind(event.end_time)
        .bind(event.is_all_day)
        .bind(&event.status)
        .bind(&event.organizer_email)
        .bind(&event.attendees_json)
        .bind(&event.html_link)
        .bind(&event.etag)
        .bind(&event.ical_data)
        .bind(&event.uid)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    }

    Ok(())
}

/// Synchronise a single CalDAV calendar using the CalendarDriverRegistry.
///
/// Uses the `CalDavDriver` to fetch remote events, then upserts them into the
/// local database.
async fn sync_one_calendar(
    pool: &SqlitePool,
    cal: &Calendar,
    _account: &Account,
) -> Result<usize, SerializedError> {
    let registry = CalendarDriverRegistry::new(pool.clone());
    let driver = registry
        .create("caldav")
        .map_err(|e| SerializedError::new(e.code, e.message))?;

    log::info!(
        "[caldav_ops] Syncing calendar {} ({}) via CalDavDriver",
        cal.display_name.as_deref().unwrap_or(&cal.id),
        cal.remote_id,
    );

    // Fetch events via the driver (full-range: we pass 0..MAX_TIMESTAMP)
    let events = driver
        .fetch_events(&cal.company_id, &cal.remote_id, 0, i64::MAX)
        .await
        .map_err(|e| SerializedError::new(e.code, e.message))?;

    let count = events.len();
    log::info!(
        "[caldav_ops] Fetched {count} VEVENT(s) from {} via driver",
        cal.remote_id,
    );

    // Upsert each event into the DB
    for event in &events {
        upsert_event(pool, event).await?;
    }

    // Update the calendar's sync_token (use a simple timestamp-based token)
    let now = chrono::Utc::now().timestamp();
    let sync_token = format!("caldav-{}", now);
    sqlx::query(
        "UPDATE calendars SET sync_token = ?1, ctag = ?2, updated_at = ?3 WHERE id = ?4"
    )
    .bind(&sync_token)
    .bind(&sync_token) // use same value for ctag
    .bind(now)
    .bind(&cal.id)
    .execute(pool)
    .await
    .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;

    log::info!(
        "[caldav_ops] Calendar {} synced: {count} events",
        cal.display_name.as_deref().unwrap_or(&cal.id),
    );

    Ok(count)
}

/// Run a full sync cycle for every calendar whose provider is `"caldav"`.
///
/// This function:
/// 1. Queries all calendars with `provider = 'caldav'`
/// 2. For each calendar, performs a CalDAV REPORT request to fetch events
/// 3. Upserts the returned iCalendar data into `calendar_events`
/// 4. Updates the calendar's `sync_token`
pub async fn sync_all_calendars(pool: &SqlitePool) -> Result<SyncSummary, SerializedError> {
    // 1. Find all CalDAV calendars across every account
    let calendars: Vec<Calendar> = sqlx::query_as::<_, Calendar>(
        "SELECT * FROM calendars WHERE provider = ? ORDER BY account_id, display_name",
    )
    .bind("caldav")
    .fetch_all(pool)
    .await
    .map_err(|e| {
        log::error!("[caldav_ops] Failed to query CalDAV calendars: {e}");
        SerializedError::from(AppDbError::Database(e))
    })?;

    let count = calendars.len();
    if count == 0 {
        log::info!("[caldav_ops] No CalDAV calendars found — sync is a no-op");
        return Ok(SyncSummary::default());
    }

    log::info!(
        "[caldav_ops] Found {count} CalDAV calendar(s) across {} account(s)",
        calendars.iter().map(|c| c.company_id.as_str()).collect::<std::collections::BTreeSet<_>>().len(),
    );

    // Pre-fetch accounts to avoid querying per calendar
    let account_ids: Vec<String> = calendars.iter()
        .map(|c| c.company_id.clone())
        .collect::<std::collections::BTreeSet<_>>()
        .into_iter()
        .collect();

    let mut accounts_map: HashMap<String, Account> = HashMap::new();
    for aid in &account_ids {
        let account: Option<Account> = sqlx::query_as(
            "SELECT * FROM accounts WHERE id = ?1"
        )
        .bind(aid)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            log::error!("[caldav_ops] Failed to query account {aid}: {e}");
            SerializedError::from(AppDbError::Database(e))
        })?;

        if let Some(acc) = account {
            accounts_map.insert(aid.clone(), acc);
        }
    }

    // 2-4. Per-calendar sync
    let mut synced_ok = 0usize;
    let mut synced_error = 0usize;

    for cal in &calendars {
        log::debug!(
            "[caldav_ops] Syncing calendar: id={}, account={}, remote_id={}, name={:?}",
            cal.id,
            cal.company_id,
            cal.remote_id,
            cal.display_name,
        );

        let account = match accounts_map.get(&cal.company_id) {
            Some(acc) => acc,
            None => {
                log::error!(
                    "[caldav_ops] Account {} not found for calendar {}",
                    cal.company_id,
                    cal.id,
                );
                synced_error += 1;
                continue;
            }
        };

        match sync_one_calendar(pool, cal, account).await {
            Ok(_event_count) => {
                synced_ok += 1;
            }
            Err(e) => {
                log::error!(
                    "[caldav_ops] Failed to sync calendar {} ({}): {e}",
                    cal.display_name.as_deref().unwrap_or(&cal.id),
                    cal.remote_id,
                );
                synced_error += 1;
            }
        }
    }

    Ok(SyncSummary {
        synced_ok,
        synced_error,
    })
}



#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    /// Helper: create an in-memory pool that tests can use.
    /// Runs all migrations so the `calendars` table exists.
    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory pool");
        crate::db::migrations::run_migrations(&pool)
            .await
            .expect("migrations");
        pool
    }

    #[tokio::test]
    async fn test_sync_all_calendars_empty_db() {
        let pool = create_test_pool().await;
        let summary = sync_all_calendars(&pool).await.unwrap();
        assert_eq!(summary.synced_ok, 0);
        assert_eq!(summary.synced_error, 0);
    }

    #[tokio::test]
    async fn test_sync_all_calendars_no_caldav_calendars() {
        let pool = create_test_pool().await;

        // Insert a test account first
        let now = chrono::Utc::now().timestamp();
        let account_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO accounts (id, email, provider, auth_method, metadata_json, is_active, created_at, updated_at) \
             VALUES (?, ?, ?, ?, '{}', 1, ?, ?)",
        )
        .bind(&account_id)
        .bind("test@example.com")
        .bind("imap")
        .bind("password")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .expect("insert account");

        // Insert a google calendar (not CalDAV)
        let cal_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO calendars (id, account_id, provider, remote_id, display_name, is_primary, is_visible, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)",
        )
        .bind(&cal_id)
        .bind(&account_id)
        .bind("google")
        .bind("remote_1")
        .bind("My Google Calendar")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .expect("insert calendar");

        let summary = sync_all_calendars(&pool).await.unwrap();
        assert_eq!(summary.synced_ok, 0);
        assert_eq!(summary.synced_error, 0);
    }

    #[tokio::test]
    async fn test_sync_all_calendars_with_caldav() {
        let pool = create_test_pool().await;

        let now = chrono::Utc::now().timestamp();
        let account_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO accounts (id, email, provider, auth_method, metadata_json, is_active, created_at, updated_at) \
             VALUES (?, ?, ?, ?, '{}', 1, ?, ?)",
        )
        .bind(&account_id)
        .bind("caldav@example.com")
        .bind("caldav")
        .bind("password")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .expect("insert account");

        // Insert a CalDAV calendar
        let cal_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO calendars (id, account_id, provider, remote_id, display_name, is_primary, is_visible, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)",
        )
        .bind(&cal_id)
        .bind(&account_id)
        .bind("caldav")
        .bind("/calendars/user/default")
        .bind("My CalDAV Calendar")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .expect("insert calendar");

        let summary = sync_all_calendars(&pool).await.unwrap();
        assert_eq!(summary.synced_ok, 0);
        assert_eq!(summary.synced_error, 0);
    }
}
