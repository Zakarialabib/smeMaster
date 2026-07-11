// ── Calendar domain operations ─────────────────────────────────────────────
//
// High-level operations that orchestrate multiple table queries.
// This module provides the `sync_all_calendars` entry point used by the
// background CalDAV sync loop.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use base64::Engine;
use uuid::Uuid;

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

/// Build a CalDAV REPORT XML body requesting all calendar data.
fn build_caldav_report_body() -> String {
    r#"<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:C="urn:ietf:params:xml:ns:caldav"
                  xmlns:D="DAV:">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR"/>
  </C:filter>
</C:calendar-query>"#
    .to_string()
}

/// Parse an iCalendar text blob and extract VEVENT entries.
/// Returns a vector of (uid, summary, description, location, dtstart, dtend, ical_raw) tuples.
fn parse_ical_events(ical_text: &str) -> Vec<HashMap<String, String>> {
    let mut events = Vec::new();
    let mut current_event: Option<HashMap<String, String>> = None;
    let mut in_event = false;

    for line in ical_text.lines() {
        let trimmed = line.trim();
        if trimmed == "BEGIN:VEVENT" {
            current_event = Some(HashMap::new());
            in_event = true;
            continue;
        }
        if trimmed == "END:VEVENT" {
            if let Some(event) = current_event.take() {
                events.push(event);
            }
            in_event = false;
            continue;
        }
        if !in_event {
            continue;
        }
        if let Some(event) = &mut current_event {
            // Handle key:value lines (may have folded continuation)
            if let Some(pos) = trimmed.find(':') {
                let key = trimmed[..pos].to_uppercase();
                let value = trimmed[pos + 1..].trim().to_string();
                match key.as_str() {
                    "UID" => { event.insert("uid".to_string(), value); }
                    "SUMMARY" => { event.insert("summary".to_string(), value); }
                    "DESCRIPTION" => { event.insert("description".to_string(), value); }
                    "LOCATION" => { event.insert("location".to_string(), value); }
                    "DTSTART" => { event.insert("dtstart".to_string(), value); }
                    "DTEND" => { event.insert("dtend".to_string(), value); }
                    "STATUS" => { event.insert("status".to_string(), value); }
                    "ORGANIZER" => { event.insert("organizer".to_string(), value); }
                    "DTSTAMP" => { event.insert("dtstamp".to_string(), value); }
                    _ => {}
                }
            }
        }
    }

    events
}

/// Parse an iCalendar datetime string into a Unix timestamp.
/// Supports UTC (ends with Z) and local with TZID prefix.
/// Defaults to 0 on failure.
fn parse_ical_dt(dt_str: &str) -> i64 {
    // Handle UTC format: 20240101T120000Z
    if dt_str.ends_with('Z') {
        let stripped = dt_str.trim_end_matches('Z');
        if let Ok(ts) = chrono::NaiveDateTime::parse_from_str(
            stripped,
            "%Y%m%dT%H%M%S",
        ) {
            return ts.and_utc().timestamp();
        }
    }
    // Handle DATE format: 20240101 (all-day)
    if dt_str.len() == 8 && !dt_str.contains('T') {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(dt_str, "%Y%m%d") {
            return d.and_hms_opt(0, 0, 0)
                .map(|dt| dt.and_utc().timestamp())
                .unwrap_or(0);
        }
    }
    // Handle TZID prefix: TZID=America/New_York:20240101T120000
    if let Some(pos) = dt_str.find(':') {
        return parse_ical_dt(&dt_str[pos + 1..]);
    }
    // Try without timezone info
    if let Ok(ts) = chrono::NaiveDateTime::parse_from_str(dt_str, "%Y%m%dT%H%M%S") {
        return ts.and_utc().timestamp();
    }
    log::warn!("[caldav_ops] Could not parse datetime: {dt_str}");
    0
}

/// Upsert a single event into the calendar_events table.
async fn upsert_event(
    pool: &SqlitePool,
    account_id: &str,
    calendar_id: &str,
    event_data: &HashMap<String, String>,
    ical_raw: &str,
) -> Result<(), SerializedError> {
    let uid = event_data.get("uid").map(|s| s.as_str()).unwrap_or("");
    let summary = event_data.get("summary").map(|s| s.as_str());
    let description = event_data.get("description").map(|s| s.as_str());
    let location = event_data.get("location").map(|s| s.as_str());
    let dtstart = event_data.get("dtstart").map(|s| s.as_str()).unwrap_or("");
    let dtend = event_data.get("dtend").map(|s| s.as_str()).unwrap_or("");
    let status = event_data.get("status").map(|s| s.as_str()).unwrap_or("confirmed");
    let organizer = event_data.get("organizer").map(|s| s.as_str());

    let start_time = parse_ical_dt(dtstart);
    let end_time = parse_ical_dt(dtend);

    // Detect all-day: DATE format (no T) or dtstart == dtend on same day
    let is_all_day = if dtstart.len() == 8 && !dtstart.contains('T') { 1 } else { 0 };

    let now = chrono::Utc::now().timestamp();
    let event_id = Uuid::new_v4().to_string();

    // Use UID as remote_event_id — check if it already exists
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
        // Update
        sqlx::query(
            "UPDATE calendar_events SET summary = ?1, description = ?2, location = ?3, \
             start_time = ?4, end_time = ?5, is_all_day = ?6, status = ?7, \
             organizer_email = ?8, ical_data = ?9, updated_at = ?10 \
             WHERE id = ?11"
        )
        .bind(summary)
        .bind(description)
        .bind(location)
        .bind(start_time)
        .bind(end_time)
        .bind(is_all_day)
        .bind(status)
        .bind(organizer)
        .bind(ical_raw)
        .bind(now)
        .bind(&existing_id)
        .execute(pool)
        .await
        .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    } else {
        // Insert
        sqlx::query(
            "INSERT INTO calendar_events (id, account_id, calendar_id, google_event_id, \
             remote_event_id, summary, description, location, start_time, end_time, \
             is_all_day, status, organizer_email, ical_data, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"
        )
        .bind(&event_id)
        .bind(account_id)
        .bind(calendar_id)
        .bind("") // google_event_id — unused for CalDAV
        .bind(uid)
        .bind(summary)
        .bind(description)
        .bind(location)
        .bind(start_time)
        .bind(end_time)
        .bind(is_all_day)
        .bind(status)
        .bind(organizer)
        .bind(ical_raw)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| SerializedError::from(AppDbError::Database(e)))?;
    }

    Ok(())
}

/// Synchronise a single CalDAV calendar by sending a REPORT request to the
/// server and upserting returned VEVENT data.
async fn sync_one_calendar(
    pool: &SqlitePool,
    cal: &Calendar,
    account: &Account,
) -> Result<usize, SerializedError> {
    // Build the CalDAV URL from the account's metadata_json or fallback.
    let base_url = get_caldav_base_url(account);
    let report_url = format!(
        "{}{}",
        base_url.trim_end_matches('/'),
        cal.remote_id
    );

        // Determine authentication
        let auth_header = build_auth_header(pool, account).await?;

    let client = reqwest::Client::builder()
        .user_agent("SMEMaster/1.0")
        .build()
        .map_err(|e| SerializedError::new("HTTP_CLIENT", format!("Failed to build HTTP client: {e}")))?;

    let body = build_caldav_report_body();

    log::info!(
        "[caldav_ops] REPORT {report_url} for calendar {} ({})",
        cal.display_name.as_deref().unwrap_or(cal.id.as_str()),
        cal.remote_id,
    );

    let resp = client
        .request(reqwest::Method::from_bytes(b"REPORT").unwrap_or_else(|_| reqwest::Method::GET), &report_url)
        .header("Content-Type", "application/xml; charset=utf-8")
        .header("Depth", "1")
        .header("Authorization", &auth_header)
        .body(body)
        .send()
        .await
        .map_err(|e| {
            SerializedError::new(
                "NETWORK_ERROR",
                format!("CalDAV REPORT failed for {}: {e}", cal.remote_id),
            )
        })?;

    if !resp.status().is_success() {
        log::warn!(
            "[caldav_ops] CalDAV REPORT returned {} for {}",
            resp.status(),
            cal.remote_id,
        );
        return Err(SerializedError::new(
            "CALDAV_ERROR",
            format!("CalDAV server returned {}", resp.status()),
        ));
    }

    // The response is typically multipart/alternative or text/calendar
    let _content_type = resp.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/calendar")
        .to_string();

    let body_text = resp.text().await.map_err(|e| {
        SerializedError::new("PARSE_ERROR", format!("Failed to read CalDAV response body: {e}"))
    })?;

    // Parse iCalendar data
    let events = parse_ical_events(&body_text);
    let count = events.len();
    log::info!(
        "[caldav_ops] Parsed {count} VEVENT(s) from {}",
        cal.remote_id,
    );

    // Upsert each event
    for event_data in &events {
        upsert_event(pool, &cal.company_id, &cal.id, event_data, &body_text).await?;
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

/// Determine the CalDAV base URL from the account's metadata_json or
/// construct a reasonable default from the email domain.
fn get_caldav_base_url(account: &Account) -> String {
    // Try to extract server_url from metadata_json
    if !account.metadata_json.is_empty() && account.metadata_json != "{}" {
        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&account.metadata_json) {
            if let Some(url) = meta.get("caldav_server_url").and_then(|v| v.as_str()) {
                return url.to_string();
            }
        }
    }

    // Fallback: use IMAP host if it looks like a server hostname
    if let Some(host) = &account.imap_host {
        let scheme = if host.contains("://") { String::new() } else { "https://".to_string() };
        return format!("{}{}", scheme, host);
    }

    // Last resort: derive from email domain
    let domain = account.email.split('@').nth(1).unwrap_or("localhost");
    format!("https://{domain}")
}

/// Build the Authorization header value for CalDAV requests.
/// Supports basic auth (password) and bearer token (OAuth).
async fn build_auth_header(
    pool: &SqlitePool,
    account: &Account,
) -> Result<String, SerializedError> {
    match account.auth_method.as_str() {
        "oauth" | "xoauth2" => {
            // Get OAuth token from oauth_tokens table
            let token: Option<(String,)> = sqlx::query_as(
                "SELECT access_token FROM oauth_tokens WHERE account_id = ?1"
            )
            .bind(&account.id)
            .fetch_optional(pool)
            .await
            .map_err(|e| SerializedError::new("DB_ERROR", format!("Token lookup failed: {e}")))?;

            if let Some((access_token,)) = token {
                Ok(format!("Bearer {}", access_token))
            } else {
                // Fall back to basic auth if we have a password
                if let Some(password) = &account.imap_password {
                    let username = account.imap_username.as_deref().unwrap_or(&account.email);
                    let encoded = base64::engine::general_purpose::STANDARD
                        .encode(format!("{username}:{password}"));
                    Ok(format!("Basic {encoded}"))
                } else {
                    Err(SerializedError::new(
                        "AUTH_FAILED",
                        format!("No OAuth token or password for account {}", account.email),
                    ))
                }
            }
        }
        "password" | _ => {
            // Basic auth with imap_username / imap_password
            let username = account.imap_username.as_deref().unwrap_or(&account.email);
            let password = account.imap_password.as_deref().unwrap_or("");
            let encoded = base64::engine::general_purpose::STANDARD
                .encode(format!("{username}:{password}"));
            Ok(format!("Basic {encoded}"))
        }
    }
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
