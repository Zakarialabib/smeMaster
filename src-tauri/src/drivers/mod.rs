// ── DriverRegistry — provider-type → ProtocolDriver factory ───────────────
//
// Maps a `provider_type` string (e.g. "imap_smtp", "gmail_api") to the
// correct implementation of the ProtocolDriver trait. Managed as Tauri state
// so that command handlers can dispatch operations without knowing which
// concrete driver is behind an account.

use crate::imap::driver::{DriverError, ProtocolDriver};
use crate::imap::imap_driver::ImapDriver;
use crate::jmap::JmapDriver;
use crate::microsoft_graph::MicrosoftGraphDriver;
use sqlx::SqlitePool;

/// Registry that creates protocol drivers based on account provider type.
///
/// The `pool` field is `pub(crate)` so that command handlers in the
/// `commands` module can access it directly for connection-test helpers
/// that bypass the trait interface.
pub struct DriverRegistry {
    pub(crate) pool: SqlitePool,
}

impl DriverRegistry {
    /// Create a new registry bound to the application's SQLite pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Create a driver by provider-type string.
    ///
    /// Supported types:
    /// - `"imap_smtp"` — returns an `ImapDriver`
    /// - `"microsoft_graph"` — returns a `MicrosoftGraphDriver`
    /// - Other types return a `NOT_IMPLEMENTED` error (planned for Phase 2).
    pub fn create(&self, provider_type: &str) -> Result<Box<dyn ProtocolDriver>, DriverError> {
        match provider_type {
            "imap_smtp" => Ok(Box::new(ImapDriver::new(self.pool.clone()))),
            "gmail_api" => Err(DriverError::new(
                "NOT_IMPLEMENTED",
                "Gmail API driver not yet implemented (Phase 2). Use IMAP/SMTP for now.",
            )),
            "microsoft_graph" => Ok(Box::new(MicrosoftGraphDriver::new(self.pool.clone()))),
            "jmap" => Ok(Box::new(JmapDriver::new(self.pool.clone()))),
            other => Err(DriverError::new(
                "UNKNOWN_PROVIDER",
                format!("Unknown provider type: {other}"),
            )),
        }
    }

    /// Look up the account's `provider_type` from the database and create
    /// the appropriate driver.
    pub async fn create_for_account(
        &self,
        account_id: &str,
    ) -> Result<Box<dyn ProtocolDriver>, DriverError> {
        let provider_type: String = sqlx::query_scalar(
            "SELECT provider_type FROM accounts WHERE id = ?1",
        )
        .bind(account_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            DriverError::new("DB_ERROR", format!("Failed to query account: {e}"))
        })?
        .ok_or_else(|| {
            DriverError::new("NOT_FOUND", format!("Account {account_id} not found"))
        })?;

        self.create(&provider_type)
    }
}
