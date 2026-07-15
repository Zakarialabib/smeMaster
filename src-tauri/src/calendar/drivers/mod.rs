// ── CalendarDriverRegistry — provider-type → CalendarDriver factory ─────────
//
// Maps a `provider` string (e.g. "caldav") to the correct implementation of
// the CalendarDriver trait. Managed as Tauri state so that sync orchestrators
// can dispatch operations without knowing which concrete driver is behind a
// calendar account.
//
// Follows the same pattern as `crate::drivers::DriverRegistry` used for email
// protocols (IMAP, JMAP, Microsoft Graph).

pub mod caldav;

use super::driver::{CalendarDriver, CalendarDriverError};
use sqlx::SqlitePool;

/// Registry that creates calendar drivers based on provider type.
///
/// Currently supported:
/// - `"caldav"` — returns a `CalDavDriver`
pub struct CalendarDriverRegistry {
    pool: SqlitePool,
}

impl CalendarDriverRegistry {
    /// Create a new registry bound to the application's SQLite pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Create a calendar driver by provider-type string.
    ///
    /// Supported types:
    /// - `"caldav"` — returns a `CalDavDriver`
    /// - Others return a `CALENDAR_DRIVER_UNSUPPORTED` error.
    pub fn create(
        &self,
        provider: &str,
    ) -> Result<Box<dyn CalendarDriver>, CalendarDriverError> {
        match provider {
            "caldav" => Ok(Box::new(caldav::CalDavDriver::new(self.pool.clone()))),
            other => Err(CalendarDriverError::new(
                "UNSUPPORTED",
                format!("Calendar provider '{other}' is not supported yet"),
            )),
        }
    }

    /// Look up the calendar's `provider` from the database and create
    /// the appropriate driver.
    ///
    /// Reads the `provider` column from the `calendars` table for the given
    /// calendar id.
    pub async fn create_for_calendar(
        &self,
        calendar_id: &str,
    ) -> Result<Box<dyn CalendarDriver>, CalendarDriverError> {
        let provider: String = sqlx::query_scalar(
            "SELECT provider FROM calendars WHERE id = ?1",
        )
        .bind(calendar_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            CalendarDriverError::new("DB_ERROR", format!("Failed to query calendar: {e}"))
        })?
        .ok_or_else(|| {
            CalendarDriverError::new(
                "NOT_FOUND",
                format!("Calendar {calendar_id} not found"),
            )
        })?;

        self.create(&provider)
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_registry_create_caldav() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory pool");
        let registry = CalendarDriverRegistry::new(pool);
        let driver = registry.create("caldav");
        assert!(driver.is_ok());
        assert_eq!(driver.unwrap().provider_type(), "caldav");
    }

    #[tokio::test]
    async fn test_registry_create_unsupported() {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("in-memory pool");
        let registry = CalendarDriverRegistry::new(pool);
        let driver = registry.create("google_calendar");
        assert!(driver.is_err());
        assert_eq!(
            driver.err().unwrap().code,
            "UNSUPPORTED"
        );
    }
}
