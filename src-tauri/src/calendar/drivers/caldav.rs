// ── CalDAV Calendar Driver ───────────────────────────────────────────────────
//
// Implements `CalendarDriver` for CalDAV-based calendar providers.
// Extracts the CalDAV-specific HTTP logic that was previously hardwired in
// `src-tauri/src/db/calendar/operations.rs` into a pluggable driver.
//
// The driver handles:
//   - CalDAV REPORT requests for fetching events
//   - iCalendar (VCALENDAR/VEVENT) parsing
//   - Authentication via Basic auth (password) or Bearer token (OAuth)
//   - Connection testing

use async_trait::async_trait;
use base64::Engine;
use sqlx::SqlitePool;

use crate::calendar::driver::{CalendarDriver, CalendarDriverError};
use crate::db::calendar::schema::{Calendar, CalendarEvent};
use crate::db::core::schema::Account;

/// CalDAV protocol driver.
///
/// Holds a `SqlitePool` for credential lookups (OAuth tokens, passwords)
/// and a shared `reqwest::Client` for HTTP requests.
pub struct CalDavDriver {
    pool: SqlitePool,
    http_client: reqwest::Client,
}

impl CalDavDriver {
    /// Create a new CalDAV driver with the application's database pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            http_client: reqwest::Client::builder()
                .user_agent("SMEMaster/1.0")
                .build()
                .expect("Failed to build reqwest Client for CalDavDriver"),
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /// Build the CalDAV REPORT XML body requesting all calendar data.
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
    /// Returns a vector of key-value maps for each VEVENT.
    fn parse_ical_events(ical_text: &str) -> Vec<std::collections::HashMap<String, String>> {
        let mut events = Vec::new();
        let mut current_event: Option<std::collections::HashMap<String, String>> = None;
        let mut in_event = false;

        for line in ical_text.lines() {
            let trimmed = line.trim();
            if trimmed == "BEGIN:VEVENT" {
                current_event = Some(std::collections::HashMap::new());
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
                if let Some(pos) = trimmed.find(':') {
                    let key = trimmed[..pos].to_uppercase();
                    let value = trimmed[pos + 1..].trim().to_string();
                    match key.as_str() {
                        "UID" => {
                            event.insert("uid".to_string(), value);
                        }
                        "SUMMARY" => {
                            event.insert("summary".to_string(), value);
                        }
                        "DESCRIPTION" => {
                            event.insert("description".to_string(), value);
                        }
                        "LOCATION" => {
                            event.insert("location".to_string(), value);
                        }
                        "DTSTART" => {
                            event.insert("dtstart".to_string(), value);
                        }
                        "DTEND" => {
                            event.insert("dtend".to_string(), value);
                        }
                        "STATUS" => {
                            event.insert("status".to_string(), value);
                        }
                        "ORGANIZER" => {
                            event.insert("organizer".to_string(), value);
                        }
                        "DTSTAMP" => {
                            event.insert("dtstamp".to_string(), value);
                        }
                        _ => {}
                    }
                }
            }
        }

        events
    }

    /// Parse an iCalendar datetime string into a Unix timestamp.
    /// Supports UTC (ends with Z), DATE-only (all-day), and TZID-prefixed formats.
    /// Defaults to 0 on failure.
    fn parse_ical_dt(dt_str: &str) -> i64 {
        // Handle UTC format: 20240101T120000Z
        if dt_str.ends_with('Z') {
            let stripped = dt_str.trim_end_matches('Z');
            if let Ok(ts) = chrono::NaiveDateTime::parse_from_str(stripped, "%Y%m%dT%H%M%S") {
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
            return Self::parse_ical_dt(&dt_str[pos + 1..]);
        }
        // Try without timezone info
        if let Ok(ts) = chrono::NaiveDateTime::parse_from_str(dt_str, "%Y%m%dT%H%M%S") {
            return ts.and_utc().timestamp();
        }
        log::warn!("[caldav_driver] Could not parse datetime: {dt_str}");
        0
    }

    /// Convert a parsed iCalendar event map into a `CalendarEvent` struct.
    fn map_event_data(
        account_id: &str,
        calendar_id: &str,
        data: &std::collections::HashMap<String, String>,
        ical_raw: &str,
    ) -> CalendarEvent {
        let uid = data.get("uid").map(|s| s.as_str()).unwrap_or("");
        let summary = data.get("summary").map(|s| s.to_string());
        let description = data.get("description").map(|s| s.to_string());
        let location = data.get("location").map(|s| s.to_string());
        let dtstart = data.get("dtstart").map(|s| s.as_str()).unwrap_or("");
        let dtend = data.get("dtend").map(|s| s.as_str()).unwrap_or("");
        let status = data.get("status").map(|s| s.as_str()).unwrap_or("confirmed");
        let organizer = data.get("organizer").map(|s| s.to_string());

        let start_time = Self::parse_ical_dt(dtstart);
        let end_time = Self::parse_ical_dt(dtend);

        // Detect all-day: DATE format (no T)
        let is_all_day = if dtstart.len() == 8 && !dtstart.contains('T') {
            1
        } else {
            0
        };

        let now = chrono::Utc::now().timestamp();

        CalendarEvent {
            id: uuid::Uuid::new_v4().to_string(),
            company_id: account_id.to_string(),
            calendar_id: Some(calendar_id.to_string()),
            google_event_id: String::new(), // unused for CalDAV
            remote_event_id: Some(uid.to_string()),
            summary,
            description,
            location,
            start_time,
            end_time,
            is_all_day,
            status: status.to_string(),
            organizer_email: organizer,
            attendees_json: None,
            html_link: None,
            etag: None,
            ical_data: Some(ical_raw.to_string()),
            uid: Some(uid.to_string()),
            updated_at: now,
        }
    }

    /// Determine the CalDAV base URL from the account's metadata_json or
    /// derive a reasonable default from the email domain.
    fn get_caldav_base_url(account: &Account) -> String {
        // Try to extract server_url from metadata_json
        if !account.metadata_json.is_empty() && account.metadata_json != "{}" {
            if let Ok(meta) =
                serde_json::from_str::<serde_json::Value>(&account.metadata_json)
            {
                if let Some(url) = meta.get("caldav_server_url").and_then(|v| v.as_str()) {
                    return url.to_string();
                }
            }
        }

        // Fallback: use IMAP host if it looks like a server hostname
        if let Some(host) = &account.imap_host {
            let scheme = if host.contains("://") {
                String::new()
            } else {
                "https://".to_string()
            };
            return format!("{}{}", scheme, host);
        }

        // Last resort: derive from email domain
        let domain = account.email.split('@').nth(1).unwrap_or("localhost");
        format!("https://{domain}")
    }

    /// Build the Authorization header value for CalDAV requests.
    /// Supports basic auth (password) and bearer token (OAuth).
    async fn build_auth_header(&self, account: &Account) -> Result<String, CalendarDriverError> {
        match account.auth_method.as_str() {
            "oauth" | "xoauth2" => {
                // Get OAuth token from oauth_tokens table
                let token: Option<(String,)> = sqlx::query_as(
                    "SELECT access_token FROM oauth_tokens WHERE account_id = ?1",
                )
                .bind(&account.id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| {
                    CalendarDriverError::new(
                        "DB_ERROR",
                        format!("Token lookup failed for {}: {e}", account.email),
                    )
                })?;

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
                        Err(CalendarDriverError::new(
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

    /// Look up an `Account` by id from the database.
    async fn get_account(&self, account_id: &str) -> Result<Account, CalendarDriverError> {
        sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?1")
            .bind(account_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| {
                CalendarDriverError::new(
                    "DB_ERROR",
                    format!("Failed to query account {account_id}: {e}"),
                )
            })?
            .ok_or_else(|| {
                CalendarDriverError::new(
                    "NOT_FOUND",
                    format!("Account {account_id} not found for calendar sync"),
                )
            })
    }
}

// ── CalendarDriver trait implementation ─────────────────────────────────────

#[async_trait]
impl CalendarDriver for CalDavDriver {
    /// List all CalDAV calendars for the account.
    ///
    /// For CalDAV, this queries the local DB for calendars with
    /// `provider = 'caldav'` and the matching account_id.
    async fn list_calendars(
        &self,
        account_id: &str,
    ) -> Result<Vec<Calendar>, CalendarDriverError> {
        let calendars = sqlx::query_as::<_, Calendar>(
            "SELECT * FROM calendars WHERE provider = 'caldav' AND account_id = ?1 \
             ORDER BY display_name ASC",
        )
        .bind(account_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            CalendarDriverError::new(
                "DB_ERROR",
                format!("Failed to query CalDAV calendars for {account_id}: {e}"),
            )
        })?;

        Ok(calendars)
    }

    /// Fetch events from a CalDAV calendar within a time range.
    ///
    /// Sends a CalDAV REPORT request to the server, parses the iCalendar
    /// response, and returns parsed `CalendarEvent` structs.
    async fn fetch_events(
        &self,
        account_id: &str,
        calendar_id: &str,
        _start: i64,
        _end: i64,
    ) -> Result<Vec<CalendarEvent>, CalendarDriverError> {
        let account = self.get_account(account_id).await?;
        let base_url = Self::get_caldav_base_url(&account);
        let report_url = format!(
            "{}{}",
            base_url.trim_end_matches('/'),
            calendar_id
        );

        let auth_header = self.build_auth_header(&account).await?;
        let body = Self::build_caldav_report_body();

        log::info!(
            "[caldav_driver] REPORT {report_url} for account {account_id}",
        );

        let resp = self
            .http_client
            .request(
                reqwest::Method::from_bytes(b"REPORT")
                    .unwrap_or_else(|_| reqwest::Method::GET),
                &report_url,
            )
            .header("Content-Type", "application/xml; charset=utf-8")
            .header("Depth", "1")
            .header("Authorization", &auth_header)
            .body(body)
            .send()
            .await
            .map_err(|e| {
                CalendarDriverError::new(
                    "NETWORK_ERROR",
                    format!("CalDAV REPORT failed for {calendar_id}: {e}"),
                )
            })?;

        if !resp.status().is_success() {
            log::warn!(
                "[caldav_driver] CalDAV REPORT returned {} for {}",
                resp.status(),
                calendar_id,
            );
            return Err(CalendarDriverError::new(
                "CALDAV_ERROR",
                format!("CalDAV server returned {}", resp.status()),
            ));
        }

        let body_text = resp.text().await.map_err(|e| {
            CalendarDriverError::new(
                "PARSE_ERROR",
                format!("Failed to read CalDAV response body: {e}"),
            )
        })?;

        // Parse iCalendar data
        let raw_events = Self::parse_ical_events(&body_text);
        let count = raw_events.len();
        log::info!(
            "[caldav_driver] Parsed {count} VEVENT(s) from {calendar_id}",
        );

        // Map to CalendarEvent structs
        let events: Vec<CalendarEvent> = raw_events
            .iter()
            .map(|data| Self::map_event_data(account_id, calendar_id, data, &body_text))
            .collect();

        Ok(events)
    }

    /// Create an event on the CalDAV server.
    ///
    /// Sends a PUT request with iCalendar data to the calendar URL.
    async fn create_event(
        &self,
        account_id: &str,
        calendar_id: &str,
        event: &CalendarEvent,
    ) -> Result<String, CalendarDriverError> {
        let account = self.get_account(account_id).await?;
        let base_url = Self::get_caldav_base_url(&account);
        let event_url = format!(
            "{}/{}.ics",
            base_url.trim_end_matches('/'),
            calendar_id.trim_end_matches('/'),
        );

        let auth_header = self.build_auth_header(&account).await?;

        // Build iCalendar PUT body from the event data
        let ical_body = Self::build_ical_event_body(event);

        let resp = self
            .http_client
            .put(&event_url)
            .header("Content-Type", "text/calendar; charset=utf-8")
            .header("Authorization", &auth_header)
            .body(ical_body)
            .send()
            .await
            .map_err(|e| {
                CalendarDriverError::new(
                    "NETWORK_ERROR",
                    format!("CalDAV PUT failed for event {}: {e}", event.id),
                )
            })?;

        if !resp.status().is_success() {
            return Err(CalendarDriverError::new(
                "CALDAV_ERROR",
                format!("CalDAV server returned {} on PUT", resp.status()),
            ));
        }

        Ok(event.uid.clone().unwrap_or_else(|| event.id.clone()))
    }

    /// Update an event on the CalDAV server.
    async fn update_event(
        &self,
        account_id: &str,
        event_id: &str,
        event: &CalendarEvent,
    ) -> Result<(), CalendarDriverError> {
        let account = self.get_account(account_id).await?;
        let base_url = Self::get_caldav_base_url(&account);
        let event_url = format!(
            "{}{}{}.ics",
            base_url.trim_end_matches('/'),
            calendar_id(event),
            event_id,
        );

        let auth_header = self.build_auth_header(&account).await?;
        let ical_body = Self::build_ical_event_body(event);

        let resp = self
            .http_client
            .put(&event_url)
            .header("Content-Type", "text/calendar; charset=utf-8")
            .header("Authorization", &auth_header)
            .body(ical_body)
            .send()
            .await
            .map_err(|e| {
                CalendarDriverError::new(
                    "NETWORK_ERROR",
                    format!("CalDAV PUT failed for event {event_id}: {e}"),
                )
            })?;

        if !resp.status().is_success() {
            return Err(CalendarDriverError::new(
                "CALDAV_ERROR",
                format!("CalDAV server returned {} on PUT", resp.status()),
            ));
        }

        Ok(())
    }

    /// Delete an event from the CalDAV server.
    async fn delete_event(
        &self,
        account_id: &str,
        event_id: &str,
    ) -> Result<(), CalendarDriverError> {
        let account = self.get_account(account_id).await?;
        let base_url = Self::get_caldav_base_url(&account);
        let event_url = format!(
            "{}/{}",
            base_url.trim_end_matches('/'),
            event_id,
        );

        let auth_header = self.build_auth_header(&account).await?;

        let resp = self
            .http_client
            .delete(&event_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| {
                CalendarDriverError::new(
                    "NETWORK_ERROR",
                    format!("CalDAV DELETE failed for {event_id}: {e}"),
                )
            })?;

        if !resp.status().is_success() {
            return Err(CalendarDriverError::new(
                "CALDAV_ERROR",
                format!("CalDAV server returned {} on DELETE", resp.status()),
            ));
        }

        Ok(())
    }

    /// Test CalDAV connectivity by performing a PROPFIND on the base URL.
    async fn test_connection(&self, account_id: &str) -> Result<(), CalendarDriverError> {
        let account = self.get_account(account_id).await?;
        let base_url = Self::get_caldav_base_url(&account);
        let auth_header = self.build_auth_header(&account).await?;

        log::info!(
            "[caldav_driver] Testing connection for {account_id} at {base_url}",
        );

        let resp = self
            .http_client
            .request(reqwest::Method::from_bytes(b"PROPFIND").unwrap_or(reqwest::Method::OPTIONS), &base_url)
            .header("Depth", "0")
            .header("Authorization", &auth_header)
            .send()
            .await
            .map_err(|e| {
                CalendarDriverError::new(
                    "NETWORK_ERROR",
                    format!("CalDAV connection test failed for {account_id}: {e}"),
                )
            })?;

        if resp.status().is_success() || resp.status().as_u16() == 207 {
            // 207 Multi-Status is a valid CalDAV response
            log::info!("[caldav_driver] Connection test OK for {account_id}");
            Ok(())
        } else {
            Err(CalendarDriverError::new(
                "CALDAV_ERROR",
                format!(
                    "CalDAV connection test returned {} for {account_id}",
                    resp.status()
                ),
            ))
        }
    }

    fn provider_type(&self) -> &'static str {
        "caldav"
    }
}

// ── Private helpers (standalone functions) ──────────────────────────────────

impl CalDavDriver {
    /// Build an iCalendar VCALENDAR/VEVENT body from a CalendarEvent.
    fn build_ical_event_body(event: &CalendarEvent) -> String {
        let now = chrono::Utc::now();
        let uid = event.uid.as_deref().unwrap_or(&event.id);
        let dtstart = chrono::DateTime::from_timestamp(event.start_time, 0)
            .map(|dt| dt.format("%Y%m%dT%H%M%SZ").to_string())
            .unwrap_or_else(|| "19700101T000000Z".to_string());
        let dtend = chrono::DateTime::from_timestamp(event.end_time, 0)
            .map(|dt| dt.format("%Y%m%dT%H%M%SZ").to_string())
            .unwrap_or_else(|| "19700101T000000Z".to_string());
        let dtstamp = now.format("%Y%m%dT%H%M%SZ").to_string();
        let summary = event.summary.as_deref().unwrap_or("");
        let description = event.description.as_deref().unwrap_or("");
        let location = event.location.as_deref().unwrap_or("");
        let status = &event.status;

        let mut body = format!(
            "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SMEMaster//CalDAV//EN\r\n\
             BEGIN:VEVENT\r\nUID:{uid}\r\nDTSTAMP:{dtstamp}\r\n\
             DTSTART:{dtstart}\r\nDTEND:{dtend}\r\nSUMMARY:{summary}\r\n"
        );

        if !description.is_empty() {
            body.push_str(&format!("DESCRIPTION:{}\r\n", description));
        }
        if !location.is_empty() {
            body.push_str(&format!("LOCATION:{}\r\n", location));
        }
        if let Some(organizer) = &event.organizer_email {
            body.push_str(&format!("ORGANIZER:mailto:{}\r\n", organizer));
        }
        body.push_str(&format!("STATUS:{}\r\n", status));
        body.push_str("END:VEVENT\r\nEND:VCALENDAR\r\n");

        body
    }
}

/// Helper to extract calendar_id from a CalendarEvent (for update URL).
fn calendar_id(event: &CalendarEvent) -> String {
    event.calendar_id.as_deref().unwrap_or("unknown").to_string()
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::SerializedError;

    #[test]
    fn test_parse_ical_events_basic() {
        let ical = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:123\r\nSUMMARY:Test\r\nDTSTART:20240101T120000Z\r\nDTEND:20240101T130000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
        let events = CalDavDriver::parse_ical_events(ical);
        assert_eq!(events.len(), 1);
        let ev = &events[0];
        assert_eq!(ev.get("uid").unwrap(), "123");
        assert_eq!(ev.get("summary").unwrap(), "Test");
        assert_eq!(ev.get("dtstart").unwrap(), "20240101T120000Z");
    }

    #[test]
    fn test_parse_ical_events_multiple() {
        let ical = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:One\r\nDTSTART:20240101T120000Z\r\nDTEND:20240101T130000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nSUMMARY:Two\r\nDTSTART:20240102T120000Z\r\nDTEND:20240102T130000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
        let events = CalDavDriver::parse_ical_events(ical);
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_parse_ical_dt_utc() {
        let ts = CalDavDriver::parse_ical_dt("20240101T120000Z");
        assert_eq!(ts, 1704100800); // 2024-01-01 12:00:00 UTC
    }

    #[test]
    fn test_parse_ical_dt_date() {
        let ts = CalDavDriver::parse_ical_dt("20240101");
        assert!(ts > 0);
    }

    #[test]
    fn test_parse_ical_dt_tzid() {
        let ts = CalDavDriver::parse_ical_dt("TZID=America/New_York:20240101T120000");
        assert!(ts > 0);
    }

    #[test]
    fn test_map_event_data() {
        let mut data = std::collections::HashMap::new();
        data.insert("uid".to_string(), "evt-1".to_string());
        data.insert("summary".to_string(), "Meeting".to_string());
        data.insert("dtstart".to_string(), "20240101T100000Z".to_string());
        data.insert("dtend".to_string(), "20240101T110000Z".to_string());

        let event = CalDavDriver::map_event_data("acc1", "cal1", &data, "RAW_ICAL");
        assert_eq!(event.company_id, "acc1");
        assert_eq!(event.summary.as_deref(), Some("Meeting"));
        assert!(event.start_time > 0);
        assert!(event.end_time > event.start_time);
        assert_eq!(event.ical_data.as_deref(), Some("RAW_ICAL"));
    }

    #[test]
    fn test_build_ical_event_body() {
        let event = CalendarEvent {
            id: "evt-1".to_string(),
            company_id: "acc1".to_string(),
            calendar_id: Some("cal1".to_string()),
            google_event_id: String::new(),
            remote_event_id: Some("evt-1".to_string()),
            summary: Some("Test Event".to_string()),
            description: Some("A test description".to_string()),
            location: Some("Conference Room".to_string()),
            start_time: 1704100800,
            end_time: 1704104400,
            is_all_day: 0,
            status: "confirmed".to_string(),
            organizer_email: Some("organizer@test.com".to_string()),
            attendees_json: None,
            html_link: None,
            etag: None,
            ical_data: None,
            uid: Some("evt-1".to_string()),
            updated_at: 0,
        };

        let body = CalDavDriver::build_ical_event_body(&event);
        assert!(body.contains("BEGIN:VCALENDAR"));
        assert!(body.contains("UID:evt-1"));
        assert!(body.contains("SUMMARY:Test Event"));
        assert!(body.contains("LOCATION:Conference Room"));
        assert!(body.contains("ORGANIZER:mailto:organizer@test.com"));
        assert!(body.contains("STATUS:confirmed"));
        assert!(body.contains("END:VCALENDAR"));
    }

    #[test]
    fn test_caldav_driver_error_from_serialized() {
        let se = SerializedError::new("AUTH_FAILED", "bad token");
        let de: CalendarDriverError = se.into();
        assert_eq!(de.code, "AUTH_FAILED");
        assert_eq!(de.message, "bad token");
    }
}
