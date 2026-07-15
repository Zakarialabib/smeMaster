// ── Protocol-Driver Tauri Commands ──────────────────────────────────
//
// Command handlers that use the DriverRegistry to dispatch operations
// to the correct protocol driver based on each account's provider_type.
// These are provider-agnostic — the same commands work for IMAP, Gmail
// API, Microsoft Graph, and JMAP (once implemented).

use tauri::State;

use crate::drivers::DriverRegistry;
use crate::error::SerializedError;
use crate::imap::driver::{DriverError, SyncOutput};
use crate::imap::imap_driver::test_imap_connection;
use crate::imap::types::ImapConfig;

// ── Helper: convert DriverError → SerializedError for Tauri IPC ─────

fn map_driver_err(e: DriverError) -> SerializedError {
    SerializedError::new(e.code, e.message)
}

// ── Commands ────────────────────────────────────────────────────────

/// Full sync — sync all messages for the given account.
///
/// The account's `provider_type` is looked up from the database and the
/// corresponding protocol driver is created to perform the sync.
#[tauri::command]
pub async fn sync_protocol_full(
    account_id: String,
    registry: State<'_, DriverRegistry>,
) -> Result<SyncOutput, SerializedError> {
    let driver = registry
        .create_for_account(&account_id)
        .await
        .map_err(map_driver_err)?;

    driver
        .full_sync(&account_id)
        .await
        .map_err(map_driver_err)
}

/// Delta sync — sync only changes since the last checkpoint.
///
/// The `checkpoint` string is provider-specific and is returned by a
/// previous full or delta sync operation. A malformed or missing
/// checkpoint will fall back to a full sync on the provider side.
#[tauri::command]
pub async fn sync_protocol_delta(
    account_id: String,
    checkpoint: String,
    registry: State<'_, DriverRegistry>,
) -> Result<SyncOutput, SerializedError> {
    let driver = registry
        .create_for_account(&account_id)
        .await
        .map_err(map_driver_err)?;

    driver
        .delta_sync(&account_id, &checkpoint)
        .await
        .map_err(map_driver_err)
}

/// Send — transmit a raw RFC 2822 email via the account's outbound
/// protocol.
///
/// `raw_message` must be base64url-encoded RFC 2822 content.
/// `thread_id` is optional and provider-specific (used for threading
/// in Gmail API, JMAP, etc.).
#[tauri::command]
pub async fn send_protocol(
    account_id: String,
    raw_message: String,
    thread_id: Option<String>,
    registry: State<'_, DriverRegistry>,
) -> Result<String, SerializedError> {
    let driver = registry
        .create_for_account(&account_id)
        .await
        .map_err(map_driver_err)?;

    driver
        .send(&account_id, &raw_message, thread_id.as_deref())
        .await
        .map_err(map_driver_err)
}

/// Test connection — verify that the account's mail server is
/// reachable with the stored credentials.
///
/// For IMAP/SMTP accounts this loads the account config and runs an
/// IMAP connectivity check. Future provider types (Gmail API,
/// Microsoft Graph, JMAP) will delegate to their driver's
/// `test_connection` once implemented.
#[tauri::command]
pub async fn test_protocol_connection(
    account_id: String,
    registry: State<'_, DriverRegistry>,
) -> Result<(), SerializedError> {
    // Determine provider type from the database
    let pool = &registry.pool;
    let provider_type: String = sqlx::query_scalar(
        "SELECT provider_type FROM accounts WHERE id = ?1",
    )
    .bind(&account_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        SerializedError::new("DATABASE_ERROR", format!("Failed to query account: {e}"))
    })?
    .ok_or_else(|| {
        SerializedError::new("NOT_FOUND", format!("Account {account_id} not found"))
    })?;

    match provider_type.as_str() {
        "imap_smtp" => {
            // Load IMAP config and run the standalone test function.
            // We bypass ImapDriver::test_connection() because the trait
            // method does not accept an account_id and returns
            // NOT_IMPLEMENTED for IMAP.
            let config = load_imap_config_for_test(pool, &account_id).await?;
            test_imap_connection(&config)
                .await
                .map_err(|e| SerializedError::new(e.code, e.message))?;
            Ok(())
        }
        other => {
            // For future provider types — create the driver and
            // call test_connection(). Currently all non-IMAP types
            // return NOT_IMPLEMENTED from DriverRegistry::create.
            let driver = registry.create(other).map_err(map_driver_err)?;
            log::info!(
                "[sync] Testing connection for {} driver",
                driver.provider_type()
            );
            driver.test_connection().await.map_err(map_driver_err)
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────────

/// Load an `ImapConfig` from the database for connection testing.
///
/// This duplicates `ImapDriver::load_imap_config` which is private to
/// the `imap_driver` module. The duplication is intentional — it keeps
/// the test path independent and avoids exposing internal driver
/// internals purely for testing purposes.
async fn load_imap_config_for_test(
    pool: &sqlx::SqlitePool,
    account_id: &str,
) -> Result<ImapConfig, SerializedError> {
    use crate::db::core::schema::Account;

    let account = sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?")
        .bind(account_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            SerializedError::new("DATABASE_ERROR", format!("Failed to load account: {e}"))
        })?
        .ok_or_else(|| {
            SerializedError::new("NOT_FOUND", format!("Account '{account_id}' not found"))
        })?;

    Ok(ImapConfig {
        host: account.imap_host.ok_or_else(|| {
            SerializedError::new("INVALID_CONFIG", "IMAP host not configured")
        })?,
        port: account
            .imap_port
            .ok_or_else(|| {
                SerializedError::new("INVALID_CONFIG", "IMAP port not configured")
            })?
            as u16,
        security: account.imap_security.unwrap_or_else(|| "tls".into()),
        username: account.imap_username.unwrap_or(account.email.clone()),
        password: account
            .imap_password
            .or(account.access_token)
            .ok_or_else(|| {
                SerializedError::new("INVALID_CONFIG", "No IMAP password/token configured")
            })?,
        auth_method: account.auth_method,
        accept_invalid_certs: false,
    })
}

/// Create a draft on the remote Microsoft Graph mailbox.
///
/// The account must use the `microsoft_graph` provider. The raw RFC 2822
/// message is parsed for headers + body, posted to `POST /me/messages`, and
/// the remote draft ID is returned. Used by the composer to keep a server-
/// side copy of in-progress drafts for Microsoft-connected accounts.
#[tauri::command]
pub async fn create_graph_draft(
    account_id: String,
    raw_message: String,
    pool: State<'_, sqlx::SqlitePool>,
) -> Result<String, SerializedError> {
    let driver = crate::microsoft_graph::MicrosoftGraphDriver::new(pool.inner().clone());
    driver
        .create_draft(&account_id, &raw_message)
        .await
        .map_err(|e| SerializedError::new(e.code, e.message))
}
