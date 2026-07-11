use async_trait::async_trait;
use sqlx::SqlitePool;

use super::connect;
use super::driver::{DriverError, ProtocolDriver, SyncMessage, SyncOutput};
use super::fetch;
use super::folder;
use super::sync;
use super::types::ImapConfig;
use crate::db::core::schema::Account;
use crate::smtp::client as smtp_client;
use crate::smtp::types::SmtpConfig;

// ── ImapDriver ──────────────────────────────────────────────────────────────

/// IMAP/SMTP implementation of the ProtocolDriver trait.
///
/// Requires access to the SqlitePool to look up account credentials
/// when performing operations for a given `account_id`.
pub struct ImapDriver {
    pool: SqlitePool,
}

impl ImapDriver {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Load an account from the database and build an ImapConfig.
    async fn load_imap_config(&self, account_id: &str) -> Result<ImapConfig, DriverError> {
        let account = sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?")
            .bind(account_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DriverError::new("DATABASE_ERROR", format!("Failed to load account: {e}")))?
            .ok_or_else(|| DriverError::new("NOT_FOUND", format!("Account '{account_id}' not found")))?;

        Ok(ImapConfig {
            host: account
                .imap_host
                .ok_or_else(|| DriverError::new("INVALID_CONFIG", "IMAP host not configured"))?,
            port: account
                .imap_port
                .ok_or_else(|| DriverError::new("INVALID_CONFIG", "IMAP port not configured"))?
                as u16,
            security: account.imap_security.unwrap_or_else(|| "tls".into()),
            username: account.imap_username.unwrap_or(account.email.clone()),
            password: account
                .imap_password
                .or(account.access_token)
                .ok_or_else(|| DriverError::new("INVALID_CONFIG", "No IMAP password/token configured"))?,
            auth_method: account.auth_method,
            accept_invalid_certs: false,
        })
    }

    /// Load SMTP settings for an account and build an SmtpConfig.
    async fn load_smtp_config(&self, account_id: &str) -> Result<SmtpConfig, DriverError> {
        let account = sqlx::query_as::<_, Account>("SELECT * FROM accounts WHERE id = ?")
            .bind(account_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DriverError::new("DATABASE_ERROR", format!("Failed to load account: {e}")))?
            .ok_or_else(|| DriverError::new("NOT_FOUND", format!("Account '{account_id}' not found")))?;

        Ok(SmtpConfig {
            host: account
                .smtp_host
                .ok_or_else(|| DriverError::new("INVALID_CONFIG", "SMTP host not configured"))?,
            port: account
                .smtp_port
                .ok_or_else(|| DriverError::new("INVALID_CONFIG", "SMTP port not configured"))?
                as u16,
            security: account.smtp_security.unwrap_or_else(|| "tls".into()),
            username: account.smtp_username.unwrap_or(account.email.clone()),
            password: account
                .smtp_password
                .or(account.access_token)
                .ok_or_else(|| DriverError::new("INVALID_CONFIG", "No SMTP password/token configured"))?,
            auth_method: account.auth_method,
            accept_invalid_certs: false,
            timeout_secs: Some(30),
        })
    }
}

#[async_trait]
impl ProtocolDriver for ImapDriver {
    /// Full sync: connect to IMAP, list all folders, and sync each one.
    async fn full_sync(&self, account_id: &str) -> Result<SyncOutput, DriverError> {
        let config = self.load_imap_config(account_id).await?;
        let mut session = connect::connect(&config).await?;

        let folders = folder::list_folders(&mut session).await?;
        let mut all_messages = Vec::new();
        let mut total_count: u32 = 0;

        // Use today's date as default "since_date" — full sync pulls recent mail
        let since_date = Some(
            chrono::Utc::now()
                .format("%d-%b-%Y")
                .to_string()
                .to_uppercase(),
        );

        for fld in &folders {
            let result = sync::sync_folder(&mut session, &fld.raw_path, 500, since_date.clone())
                .await
                .map_err(|e| DriverError::from(e))?;

            let synced: Vec<SyncMessage> = result
                .messages
                .into_iter()
                .map(Into::into)
                .collect();

            total_count += synced.len() as u32;
            all_messages.extend(synced);
        }

        // Build checkpoint from the folders' UIDVALIDITY values
        let checkpoint = format!("full_sync:{}", chrono::Utc::now().timestamp());

        let _ = session.logout().await;

        log::info!(
            "[imap-driver] full_sync for {account_id}: {total_count} messages from {} folders",
            folders.len()
        );

        Ok(SyncOutput {
            messages: all_messages,
            new_checkpoint: checkpoint,
            synced_count: total_count,
        })
    }

    /// Delta sync: parse checkpoint for last_uid, connect, and fetch new UIDs.
    async fn delta_sync(
        &self,
        account_id: &str,
        checkpoint: &str,
    ) -> Result<SyncOutput, DriverError> {
        let config = self.load_imap_config(account_id).await?;
        let mut session = connect::connect(&config).await?;

        // Parse checkpoint format: "delta:<folder>:<last_uid>:<uidvalidity>"
        let parts: Vec<&str> = checkpoint.split(':').collect();
        let folder = parts.get(1).copied().unwrap_or("INBOX");
        let last_uid: u32 = parts
            .get(2)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let new_uids = sync::fetch_new_uids(&mut session, folder, last_uid).await?;

        if new_uids.is_empty() {
            let _ = session.logout().await;
            return Ok(SyncOutput {
                messages: vec![],
                new_checkpoint: checkpoint.to_string(),
                synced_count: 0,
            });
        }

        // Fetch actual messages for the new UIDs
        let uid_set = new_uids
            .iter()
            .map(|u| u.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let fetch_result = fetch::fetch_messages(&mut session, folder, &uid_set).await?;

        let messages: Vec<SyncMessage> = fetch_result
            .messages
            .into_iter()
            .map(Into::into)
            .collect();

        let new_max_uid = new_uids.iter().max().copied().unwrap_or(last_uid);
        let new_checkpoint = format!("delta:{folder}:{new_max_uid}:{}", fetch_result.folder_status.uidvalidity);

        let _ = session.logout().await;

        let synced_count = messages.len() as u32;

        log::info!(
            "[imap-driver] delta_sync for {account_id}/{folder}: {synced_count} new messages",
        );

        Ok(SyncOutput {
            messages,
            new_checkpoint,
            synced_count,
        })
    }

    /// Send raw email via SMTP using the existing smtp::client.
    async fn send(
        &self,
        account_id: &str,
        raw_message: &str,
        _thread_id: Option<&str>,
    ) -> Result<String, DriverError> {
        let smtp_config = self.load_smtp_config(account_id).await?;

        let send_result = smtp_client::send_raw_email(&smtp_config, raw_message)
            .await
            .map_err(|e| DriverError::from(e))?;

        if send_result.success {
            log::info!("[imap-driver] send for {account_id}: email sent successfully");
            // Return a basic message ID — the SMTP response doesn't always include one
            Ok(format!("sent:{}", chrono::Utc::now().timestamp()))
        } else {
            Err(DriverError::new(
                "SEND_FAILED",
                send_result.message,
            ))
        }
    }

    /// Test connection: connect to IMAP and immediately log out.
    async fn test_connection(&self) -> Result<(), DriverError> {
        // test_connection doesn't have account_id - it uses stored config from the driver
        // For the ProtocolDriver trait, test_connection is parameterless.
        // We'll return an error suggesting the caller use a more specific method.
        Err(DriverError::new(
            "NOT_IMPLEMENTED",
            "Use test_imap_connection(config) or implement account-aware test",
        ))
    }

    fn provider_type(&self) -> &'static str {
        "imap_smtp"
    }
}

/// Convenience: test an IMAP connection directly from an ImapConfig.
pub async fn test_imap_connection(config: &ImapConfig) -> Result<String, DriverError> {
    let result = fetch::test_connection(config).await?;
    Ok(result)
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_imap_driver_provider_type() {
        let pool = sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap();
        let driver = ImapDriver::new(pool);
        assert_eq!(driver.provider_type(), "imap_smtp");
    }

    #[test]
    fn test_imap_driver_provider_type_str() {
        let driver = create_mock_driver();
        assert_eq!(driver.provider_type(), "imap_smtp");
    }

    fn create_mock_driver() -> ImapDriver {
        // Use a minimal in-memory pool for tests that don't actually hit the DB
        let pool = futures::executor::block_on(async {
            sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()
        });
        ImapDriver::new(pool)
    }

    #[test]
    fn test_test_connection_returns_not_implemented() {
        let pool = futures::executor::block_on(async {
            sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()
        });
        let driver = ImapDriver::new(pool);
        let result = futures::executor::block_on(driver.test_connection());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "NOT_IMPLEMENTED");
    }
}
