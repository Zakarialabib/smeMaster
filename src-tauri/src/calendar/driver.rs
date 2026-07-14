// ── CalendarDriver trait ─────────────────────────────────────────────────────
//
// Pluggable protocol driver for calendar providers (CalDAV, Google Calendar,
// Microsoft Graph, etc.). Follows the same pattern as `imap::driver::ProtocolDriver`
// used for email protocols — each provider implements the trait and is registered
// via `CalendarDriverRegistry`.
//
// See also: `crate::imap::driver` for the email-side equivalent pattern.

use async_trait::async_trait;

use crate::db::calendar::schema::{Calendar, CalendarEvent};

// ── CalendarDriverError ──────────────────────────────────────────────────────

/// Error type returned by all `CalendarDriver` methods.
/// Serializable across IPC via `From` impls for `SerializedError`.
#[derive(Debug, Clone)]
pub struct CalendarDriverError {
    /// Machine-readable error code (e.g. `"NETWORK_ERROR"`, `"AUTH_FAILED"`).
    pub code: String,
    /// Human-readable error description.
    pub message: String,
}

impl CalendarDriverError {
    /// Create a new error with the given code and message.
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl std::fmt::Display for CalendarDriverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for CalendarDriverError {}

impl From<String> for CalendarDriverError {
    fn from(msg: String) -> Self {
        CalendarDriverError::new("CALENDAR_DRIVER_ERROR", msg)
    }
}

impl From<&str> for CalendarDriverError {
    fn from(msg: &str) -> Self {
        CalendarDriverError::from(msg.to_string())
    }
}

impl From<crate::error::SerializedError> for CalendarDriverError {
    fn from(e: crate::error::SerializedError) -> Self {
        CalendarDriverError {
            code: e.code,
            message: e.message,
        }
    }
}

impl From<CalendarDriverError> for crate::error::SerializedError {
    fn from(e: CalendarDriverError) -> Self {
        crate::error::SerializedError::new(e.code, e.message)
    }
}

// ── CalendarDriver trait ─────────────────────────────────────────────────────

/// Unified protocol driver for calendar providers.
///
/// Each provider (CalDAV, Google Calendar API, Microsoft Graph, etc.)
/// implements this trait. Methods return `CalendarDriverError` for all
/// failure modes (network, auth, parse, etc.).
#[async_trait]
pub trait CalendarDriver: Send + Sync {
    /// List all calendars visible to the account.
    ///
    /// * `account_id` — the local account/company identifier.
    /// * Returns a list of remote `Calendar` descriptors.
    async fn list_calendars(
        &self,
        account_id: &str,
    ) -> Result<Vec<Calendar>, CalendarDriverError>;

    /// Fetch events within a time range from a remote calendar.
    ///
    /// * `account_id` — the local account/company identifier (used for auth).
    /// * `calendar_id` — the remote calendar identifier (e.g. a CalDAV URL path).
    /// * `start` — start of the time window in Unix epoch seconds.
    /// * `end` — end of the time window in Unix epoch seconds.
    /// * Returns parsed `CalendarEvent` rows (not yet persisted).
    async fn fetch_events(
        &self,
        account_id: &str,
        calendar_id: &str,
        start: i64,
        end: i64,
    ) -> Result<Vec<CalendarEvent>, CalendarDriverError>;

    /// Create an event on the remote calendar.
    ///
    /// * `account_id` — the local account/company identifier (used for auth).
    /// * `calendar_id` — the remote calendar identifier.
    /// * `event` — the event to create (id may be ignored/generated).
    /// * Returns the remote provider's event identifier.
    async fn create_event(
        &self,
        account_id: &str,
        calendar_id: &str,
        event: &CalendarEvent,
    ) -> Result<String, CalendarDriverError>;

    /// Update an existing event on the remote calendar.
    ///
    /// * `account_id` — the local account/company identifier (used for auth).
    /// * `event_id` — the remote provider's event identifier.
    /// * `event` — the updated event data.
    async fn update_event(
        &self,
        account_id: &str,
        event_id: &str,
        event: &CalendarEvent,
    ) -> Result<(), CalendarDriverError>;

    /// Delete an event from the remote calendar.
    ///
    /// * `account_id` — the local account/company identifier (used for auth).
    /// * `event_id` — the remote provider's event identifier.
    async fn delete_event(
        &self,
        account_id: &str,
        event_id: &str,
    ) -> Result<(), CalendarDriverError>;

    /// Test connectivity and authentication with the provider.
    ///
    /// * `account_id` — the local account/company identifier.
    async fn test_connection(&self, account_id: &str) -> Result<(), CalendarDriverError>;

    /// Provider type identifier (e.g. `"caldav"`, `"google_calendar"`).
    fn provider_type(&self) -> &'static str;
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal driver implementation for testing trait-object creation.
    struct TestCalendarDriver;

    #[async_trait]
    impl CalendarDriver for TestCalendarDriver {
        async fn list_calendars(
            &self,
            _account_id: &str,
        ) -> Result<Vec<Calendar>, CalendarDriverError> {
            Ok(vec![])
        }

        async fn fetch_events(
            &self,
            _account_id: &str,
            _calendar_id: &str,
            _start: i64,
            _end: i64,
        ) -> Result<Vec<CalendarEvent>, CalendarDriverError> {
            Ok(vec![])
        }

        async fn create_event(
            &self,
            _account_id: &str,
            _calendar_id: &str,
            _event: &CalendarEvent,
        ) -> Result<String, CalendarDriverError> {
            Ok("test-event-id".to_string())
        }

        async fn update_event(
            &self,
            _account_id: &str,
            _event_id: &str,
            _event: &CalendarEvent,
        ) -> Result<(), CalendarDriverError> {
            Ok(())
        }

        async fn delete_event(
            &self,
            _account_id: &str,
            _event_id: &str,
        ) -> Result<(), CalendarDriverError> {
            Ok(())
        }

        async fn test_connection(
            &self,
            _account_id: &str,
        ) -> Result<(), CalendarDriverError> {
            Ok(())
        }

        fn provider_type(&self) -> &'static str {
            "test_calendar"
        }
    }

    #[tokio::test]
    async fn test_trait_object_creation() {
        let driver: Box<dyn CalendarDriver> = Box::new(TestCalendarDriver);
        assert_eq!(driver.provider_type(), "test_calendar");
        let calendars = driver.list_calendars("acc1").await.unwrap();
        assert!(calendars.is_empty());
    }

    #[tokio::test]
    async fn test_trait_object_fetch_events() {
        let driver: Box<dyn CalendarDriver> = Box::new(TestCalendarDriver);
        let events = driver.fetch_events("acc1", "cal1", 0, 100).await.unwrap();
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn test_trait_object_create_event() {
        let driver: Box<dyn CalendarDriver> = Box::new(TestCalendarDriver);
        let event = CalendarEvent {
            id: String::new(),
            company_id: "acc1".to_string(),
            calendar_id: Some("cal1".to_string()),
            google_event_id: String::new(),
            remote_event_id: None,
            summary: Some("Test".to_string()),
            description: None,
            location: None,
            start_time: 100,
            end_time: 200,
            is_all_day: 0,
            status: "confirmed".to_string(),
            organizer_email: None,
            attendees_json: None,
            html_link: None,
            etag: None,
            ical_data: None,
            uid: None,
            updated_at: 0,
        };
        let id = driver.create_event("acc1", "cal1", &event).await.unwrap();
        assert_eq!(id, "test-event-id");
    }

    #[tokio::test]
    async fn test_driver_error_display() {
        let err = CalendarDriverError::new("AUTH_FAILED", "bad credentials");
        assert_eq!(format!("{err}"), "[AUTH_FAILED] bad credentials");
    }

    #[tokio::test]
    async fn test_driver_error_conversion() {
        let err = CalendarDriverError::new("NETWORK_ERROR", "connection lost");
        let se: crate::error::SerializedError = err.into();
        assert_eq!(se.code, "NETWORK_ERROR");
        let back: CalendarDriverError = se.into();
        assert_eq!(back.code, "NETWORK_ERROR");
    }
}
