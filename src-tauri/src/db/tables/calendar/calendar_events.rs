// ── CalendarEvents query functions ───────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::calendar::schema::CalendarEvent;

/// List events for an account with optional calendar_id and time-range filters.
///
/// When `calendar_id` is `None`, events from all calendars are returned.
/// When `start_from` and/or `end_until` are `Some`, only events whose time
/// range overlaps the given window are included. Results are ordered by
/// `start_time ASC`.
#[allow(clippy::too_many_arguments)]
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
    calendar_id: Option<&str>,
    start_from: Option<i64>,
    end_until: Option<i64>,
) -> Result<Vec<CalendarEvent>, AppDbError> {
    let mut conditions: Vec<String> = vec!["company_id = ?".to_string()];

    if calendar_id.is_some() {
        conditions.push("calendar_id = ?".to_string());
    }
    if start_from.is_some() {
        conditions.push("start_time >= ?".to_string());
    }
    if end_until.is_some() {
        conditions.push("end_time <= ?".to_string());
    }

    let where_sql = conditions.join(" AND ");
    let sql = format!("SELECT * FROM calendar_events WHERE {where_sql} ORDER BY start_time ASC");

    let mut q = sqlx::query_as::<_, CalendarEvent>(sqlx::AssertSqlSafe(sql.clone()));
    q = q.bind(company_id);

    if let Some(cal_id) = calendar_id {
        q = q.bind(cal_id);
    }
    if let Some(from) = start_from {
        q = q.bind(from);
    }
    if let Some(until) = end_until {
        q = q.bind(until);
    }

    q.fetch_all(pool).await.map_err(AppDbError::Database)
}

/// Fetch a single calendar event by its primary key.
///
/// Returns `AppDbError::NotFound` when no event matches.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<CalendarEvent, AppDbError> {
    sqlx::query_as::<_, CalendarEvent>("SELECT * FROM calendar_events WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?
        .ok_or_else(|| AppDbError::NotFound(format!("CalendarEvent with id '{id}' not found")))
}

/// Fetch a calendar event by its Google event ID.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — Owning account/company id (scopes the lookup).
/// - `google_event_id` — Remote Google event identifier.
///
/// # Returns
/// The `CalendarEvent` row.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, or
/// `AppDbError::NotFound` with message
/// `CalendarEvent with google_event_id '<google_event_id>' not found` when no
/// event matches.
pub async fn get_by_google_id(
    pool: &SqlitePool,
    company_id: &str,
    google_event_id: &str,
) -> Result<CalendarEvent, AppDbError> {
    sqlx::query_as::<_, CalendarEvent>(
        "SELECT * FROM calendar_events WHERE company_id = ? AND google_event_id = ?",
    )
    .bind(company_id)
    .bind(google_event_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| {
        AppDbError::NotFound(format!(
            "CalendarEvent with google_event_id '{google_event_id}' not found"
        ))
    })
}

/// Create a new calendar event and return the full row.
///
/// Auto-generates `id` (UUID v4) and sets `updated_at` to the current epoch
/// second.
#[allow(clippy::too_many_arguments)]
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    calendar_id: Option<&str>,
    google_event_id: &str,
    remote_event_id: Option<&str>,
    summary: Option<&str>,
    description: Option<&str>,
    location: Option<&str>,
    start_time: i64,
    end_time: i64,
    is_all_day: bool,
    status: &str,
    organizer_email: Option<&str>,
    attendees_json: Option<&str>,
    html_link: Option<&str>,
    etag: Option<&str>,
    ical_data: Option<&str>,
    uid: Option<&str>,
) -> Result<CalendarEvent, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let all_day = if is_all_day { 1_i64 } else { 0_i64 };

    sqlx::query_as::<_, CalendarEvent>(
        r#"
        INSERT INTO calendar_events (
            id, company_id, calendar_id, google_event_id, remote_event_id,
            summary, description, location,
            start_time, end_time, is_all_day, status,
            organizer_email, attendees_json, html_link, etag, ical_data, uid,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(calendar_id)
    .bind(google_event_id)
    .bind(remote_event_id)
    .bind(summary)
    .bind(description)
    .bind(location)
    .bind(start_time)
    .bind(end_time)
    .bind(all_day)
    .bind(status)
    .bind(organizer_email)
    .bind(attendees_json)
    .bind(html_link)
    .bind(etag)
    .bind(ical_data)
    .bind(uid)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields on a calendar event.
///
/// Only `Some` fields are applied; `None` fields are left unchanged.
/// The `updated_at` timestamp is always bumped.
#[allow(clippy::too_many_arguments)]
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    summary: Option<Option<&str>>,
    description: Option<Option<&str>>,
    location: Option<Option<&str>>,
    start_time: Option<i64>,
    end_time: Option<i64>,
    is_all_day: Option<bool>,
    status: Option<&str>,
    organizer_email: Option<Option<&str>>,
    attendees_json: Option<Option<&str>>,
    html_link: Option<Option<&str>>,
    etag: Option<Option<&str>>,
    ical_data: Option<Option<&str>>,
    uid: Option<Option<&str>>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let mut sets: Vec<String> = Vec::new();

    macro_rules! set_str {
        ($col:ident, $val:expr) => {
            if let Some(v) = $val {
                if let Some(s) = v {
                    sets.push(format!("\"{}\" = '{}'", stringify!($col), s.replace('\'', "''")));
                } else {
                    sets.push(format!("\"{}\" = NULL", stringify!($col)));
                }
            }
        };
    }

    macro_rules! set_i64 {
        ($col:ident, $val:expr) => {
            if let Some(v) = $val {
                sets.push(format!("\"{}\" = {v}", stringify!($col)));
            }
        };
    }

    set_str!(summary, summary);
    set_str!(description, description);
    set_str!(location, location);
    set_i64!(start_time, start_time);
    set_i64!(end_time, end_time);

    if let Some(v) = is_all_day {
        sets.push(format!("\"is_all_day\" = {}", if v { 1 } else { 0 }));
    }

    if let Some(v) = status {
        sets.push(format!("\"status\" = '{}'", v.replace('\'', "''")));
    }

    set_str!(organizer_email, organizer_email);
    set_str!(attendees_json, attendees_json);
    set_str!(html_link, html_link);
    set_str!(etag, etag);
    set_str!(ical_data, ical_data);
    set_str!(uid, uid);

    if sets.is_empty() {
        return Ok(());
    }

    sets.push(format!("\"updated_at\" = {now}"));

    let sql = format!("UPDATE calendar_events SET {} WHERE id = ?", sets.join(", "));
    sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a calendar event by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — Primary key of the event to delete.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, or
/// `AppDbError::NotFound` with message
/// `CalendarEvent with id '<id>' not found` when no row matched the key.
///
/// # Notes
/// The `id` is supplied as a positional `?` bind (not interpolated), so the
/// `delete_or_not_found` helper — which requires an interpolated id — is not a
/// drop-in here; the mapping is kept inline to preserve the parameterized SQL.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM calendar_events WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("CalendarEvent with id '{id}' not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    /// Insert a calendar row so FK constraints on `calendar_id` pass.
    async fn insert_test_calendar(pool: &sqlx::SqlitePool, id: &str, company_id: &str) {
        sqlx::query(
            "INSERT OR IGNORE INTO calendars (id, company_id, provider, remote_id, display_name) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(company_id)
        .bind("google")
        .bind(id)
        .bind("Test Calendar")
        .execute(pool)
        .await
        .unwrap();
    }

    /// Helper to create a minimal calendar event for testing.
    async fn create_test_event(
        pool: &sqlx::SqlitePool,
        company_id: &str,
        calendar_id: Option<&str>,
        google_event_id: &str,
        summary: Option<&str>,
        start_time: i64,
        end_time: i64,
    ) -> CalendarEvent {
        create(
            pool,
            company_id,
            calendar_id,
            google_event_id,
            None,          // remote_event_id
            summary,
            None,          // description
            None,          // location
            start_time,
            end_time,
            false,         // is_all_day
            "confirmed",
            None,          // organizer_email
            None,          // attendees_json
            None,          // html_link
            None,          // etag
            None,          // ical_data
            None,          // uid
        )
        .await
        .expect("create event should succeed")
    }

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        insert_test_calendar(&pool, "cal1", "acc1").await;
        let now = chrono::Utc::now().timestamp();

        let event = create_test_event(&pool, "acc1", Some("cal1"), "google_event_1", Some("Meeting"), now, now + 3600).await;

        assert_eq!(event.company_id, "acc1");
        assert_eq!(event.google_event_id, "google_event_1");
        assert_eq!(event.summary, Some("Meeting".to_string()));
        assert_eq!(event.status, "confirmed");
        assert_eq!(event.start_time, now);
        assert_eq!(event.end_time, now + 3600);
        assert_eq!(event.is_all_day, 0);
        assert!(event.updated_at > 0);

        let fetched = get_by_id(&pool, &event.id).await.expect("get_by_id should succeed");
        assert_eq!(fetched.id, event.id);
        assert_eq!(fetched.summary, event.summary);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_google_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        insert_test_calendar(&pool, "cal1", "acc1").await;
        let now = chrono::Utc::now().timestamp();

        create_test_event(&pool, "acc1", Some("cal1"), "google_123", Some("Test"), now, now + 1800).await;

        let fetched = get_by_google_id(&pool, "acc1", "google_123")
            .await
            .expect("get_by_google_id should succeed");
        assert_eq!(fetched.google_event_id, "google_123");
        assert_eq!(fetched.company_id, "acc1");
    }

    #[tokio::test]
    async fn test_get_by_google_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_google_id(&pool, "acc1", "no-such-event").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list_all_events() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_account(&pool, "acc2").await;
        insert_test_calendar(&pool, "cal1", "acc1").await;
        insert_test_calendar(&pool, "cal2", "acc2").await;
        let now = chrono::Utc::now().timestamp();

        create_test_event(&pool, "acc1", Some("cal1"), "e1", Some("First"), now, now + 600).await;
        create_test_event(&pool, "acc1", Some("cal1"), "e2", Some("Second"), now + 100, now + 700).await;
        create_test_event(&pool, "acc2", Some("cal2"), "e3", Some("Other"), now, now + 300).await;

        // List all for acc1
        let events = list(&pool, "acc1", None, None, None).await.expect("list should succeed");
        assert_eq!(events.len(), 2);

        // List all for acc2
        let events2 = list(&pool, "acc2", None, None, None).await.unwrap();
        assert_eq!(events2.len(), 1);
    }

    #[tokio::test]
    async fn test_list_with_calendar_filter() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        insert_test_calendar(&pool, "cal_a", "acc1").await;
        insert_test_calendar(&pool, "cal_b", "acc1").await;
        let now = chrono::Utc::now().timestamp();

        create_test_event(&pool, "acc1", Some("cal_a"), "e1", Some("Cal A"), now, now + 600).await;
        create_test_event(&pool, "acc1", Some("cal_b"), "e2", Some("Cal B"), now, now + 600).await;

        let cal_a_events = list(&pool, "acc1", Some("cal_a"), None, None).await.unwrap();
        assert_eq!(cal_a_events.len(), 1);
        assert_eq!(cal_a_events[0].calendar_id.as_deref(), Some("cal_a"));
    }

    #[tokio::test]
    async fn test_list_with_time_range() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let now = chrono::Utc::now().timestamp();

        create_test_event(&pool, "acc1", None, "e1", Some("Past"), now - 7200, now - 3600).await;
        create_test_event(&pool, "acc1", None, "e2", Some("Present"), now - 300, now + 300).await;
        create_test_event(&pool, "acc1", None, "e3", Some("Future"), now + 3600, now + 7200).await;

        // Events starting after now-1000
        let upcoming = list(&pool, "acc1", None, Some(now - 1000), None).await.unwrap();
        assert_eq!(upcoming.len(), 2); // Present + Future
        assert_eq!(upcoming[0].summary.as_deref(), Some("Present"));
        assert_eq!(upcoming[1].summary.as_deref(), Some("Future"));

        // Events ending before now+1000
        let past = list(&pool, "acc1", None, None, Some(now - 500)).await.unwrap();
        assert_eq!(past.len(), 1);
        assert_eq!(past[0].summary.as_deref(), Some("Past"));

        // Events within a window
        let window = list(&pool, "acc1", None, Some(now - 1000), Some(now + 1000)).await.unwrap();
        assert_eq!(window.len(), 1);
        assert_eq!(window[0].summary.as_deref(), Some("Present"));
    }

    #[tokio::test]
    async fn test_update() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let now = chrono::Utc::now().timestamp();

        let event = create_test_event(&pool, "acc1", None, "update_test", Some("Original"), now, now + 3600).await;

        update(
            &pool,
            &event.id,
            Some(Some("Updated Summary")),
            Some(Some("Updated description")),
            Some(Some("New Location")),
            Some(now + 100),
            Some(now + 3700),
            Some(true),
            Some("cancelled"),
            Some(Some("org@example.com")),
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .expect("update should succeed");

        let updated = get_by_id(&pool, &event.id).await.unwrap();
        assert_eq!(updated.summary, Some("Updated Summary".to_string()));
        assert_eq!(updated.description, Some("Updated description".to_string()));
        assert_eq!(updated.location, Some("New Location".to_string()));
        assert_eq!(updated.start_time, now + 100);
        assert_eq!(updated.end_time, now + 3700);
        assert_eq!(updated.is_all_day, 1);
        assert_eq!(updated.status, "cancelled");
        assert!(updated.updated_at >= event.updated_at);
    }

    #[tokio::test]
    async fn test_update_set_null_fields() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let now = chrono::Utc::now().timestamp();

        let event = create(
            &pool, "acc1", None, "null_test", Some("remote_id"),
            Some("Summary"), Some("Desc"), Some("Loc"),
            now, now + 3600, false, "confirmed",
            Some("org@test.com"), Some("[{\"email\":\"a@b.com\"}]"),
            Some("https://link"), Some("etag123"), Some("ical data"), Some("uid123"),
        )
        .await
        .expect("create should succeed");

        // Set various fields to NULL
        update(
            &pool, &event.id,
            Some(None),  // summary → NULL
            Some(None),  // description → NULL
            Some(None),  // location → NULL
            None, None, None, None,
            Some(None),  // organizer_email → NULL
            Some(None),  // attendees_json → NULL
            Some(None),  // html_link → NULL
            Some(None),  // etag → NULL
            Some(None),  // ical_data → NULL
            Some(None),  // uid → NULL
        )
        .await
        .expect("update null fields should succeed");

        let updated = get_by_id(&pool, &event.id).await.unwrap();
        assert!(updated.summary.is_none());
        assert!(updated.description.is_none());
        assert!(updated.location.is_none());
        assert!(updated.organizer_email.is_none());
        assert!(updated.attendees_json.is_none());
        assert!(updated.html_link.is_none());
        assert!(updated.etag.is_none());
        assert!(updated.ical_data.is_none());
        assert!(updated.uid.is_none());
    }

    #[tokio::test]
    async fn test_update_no_changes() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let now = chrono::Utc::now().timestamp();
        let event = create_test_event(&pool, "acc1", None, "nochange", Some("Test"), now, now + 600).await;

        update(
            &pool, &event.id,
            None, None, None, None, None, None, None,
            None, None, None, None, None, None,
        )
        .await
        .expect("empty update should succeed");

        let updated = get_by_id(&pool, &event.id).await.unwrap();
        assert!(updated.updated_at >= event.updated_at);
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let now = chrono::Utc::now().timestamp();
        let event = create_test_event(&pool, "acc1", None, "del_test", Some("Gone"), now, now + 600).await;

        delete(&pool, &event.id).await.expect("delete should succeed");

        let err = get_by_id(&pool, &event.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_full_crud_cycle() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        insert_test_calendar(&pool, "cal_final", "acc1").await;
        let now = chrono::Utc::now().timestamp();

        let event = create_test_event(&pool, "acc1", Some("cal_final"), "crud_event", Some("CRUD Event"), now, now + 3600).await;
        assert_eq!(event.summary.as_deref(), Some("CRUD Event"));

        let list_all = list(&pool, "acc1", None, None, None).await.unwrap();
        assert_eq!(list_all.len(), 1);

        update(&pool, &event.id, Some(Some("Updated CRUD")), None, None, None, None, None, None, None, None, None, None, None, None)
            .await
            .unwrap();
        let updated = get_by_id(&pool, &event.id).await.unwrap();
        assert_eq!(updated.summary, Some("Updated CRUD".to_string()));

        delete(&pool, &event.id).await.unwrap();
        assert!(list(&pool, "acc1", None, None, None).await.unwrap().is_empty());
    }
}
