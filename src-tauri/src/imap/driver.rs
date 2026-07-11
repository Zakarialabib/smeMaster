use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::error::SerializedError;

// ── DriverError ─────────────────────────────────────────────────────────────

/// Error type returned by all ProtocolDriver methods.
/// Serializable for Tauri IPC, convertible from SerializedError.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverError {
    pub code: String,
    pub message: String,
}

impl DriverError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl std::fmt::Display for DriverError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for DriverError {}

impl From<SerializedError> for DriverError {
    fn from(e: SerializedError) -> Self {
        DriverError {
            code: e.code,
            message: e.message,
        }
    }
}

impl From<DriverError> for SerializedError {
    fn from(e: DriverError) -> Self {
        SerializedError::new(e.code, e.message)
    }
}

impl From<String> for DriverError {
    fn from(msg: String) -> Self {
        DriverError {
            code: "DRIVER_ERROR".to_string(),
            message: msg,
        }
    }
}

impl From<&str> for DriverError {
    fn from(msg: &str) -> Self {
        DriverError::from(msg.to_string())
    }
}

// ── SyncMessage ─────────────────────────────────────────────────────────────

/// A single synced email message in the unified format.
/// All providers (IMAP, Gmail API, Microsoft Graph, JMAP) produce this.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMessage {
    pub id: String,
    pub thread_id: Option<String>,
    pub subject: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub date: i64,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub is_read: bool,
    pub folder: String,
}

// ── SyncOutput ──────────────────────────────────────────────────────────────

/// Result of a sync operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOutput {
    pub messages: Vec<SyncMessage>,
    pub new_checkpoint: String,
    pub synced_count: u32,
}

// ── ProtocolDriver trait ────────────────────────────────────────────────────

/// Unified protocol driver for email providers.
/// Each provider (IMAP, Gmail API, Microsoft Graph, JMAP) implements this.
#[async_trait]
pub trait ProtocolDriver: Send + Sync {
    /// Fully sync all messages since `checkpoint` (or from beginning).
    async fn full_sync(&self, account_id: &str) -> Result<SyncOutput, DriverError>;

    /// Incrementally sync changes since last checkpoint.
    async fn delta_sync(
        &self,
        account_id: &str,
        checkpoint: &str,
    ) -> Result<SyncOutput, DriverError>;

    /// Send a raw email (RFC 2822 base64url).
    async fn send(
        &self,
        account_id: &str,
        raw_message: &str,
        thread_id: Option<&str>,
    ) -> Result<String, DriverError>;

    /// Test connection with stored credentials.
    async fn test_connection(&self) -> Result<(), DriverError>;

    /// Get the provider type identifier.
    fn provider_type(&self) -> &'static str;
}

// ── Helper: convert ImapMessage to SyncMessage ──────────────────────────────

impl From<crate::imap::types::ImapMessage> for SyncMessage {
    fn from(m: crate::imap::types::ImapMessage) -> Self {
        SyncMessage {
            id: format!("{}:{}", m.folder, m.uid),
            thread_id: m.message_id.clone(),
            subject: m.subject,
            from: m
                .from_name
                .zip(m.from_address.clone())
                .map(|(name, addr)| format!("{name} <{addr}>"))
                .or(m.from_address),
            to: m.to_addresses,
            date: m.date,
            body_text: m.body_text,
            body_html: m.body_html,
            is_read: m.is_read,
            folder: m.folder,
        }
    }
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal driver implementation for testing trait-object creation.
    struct TestDriver;

    #[async_trait]
    impl ProtocolDriver for TestDriver {
        async fn full_sync(&self, _account_id: &str) -> Result<SyncOutput, DriverError> {
            Ok(SyncOutput {
                messages: vec![],
                new_checkpoint: "cp1".into(),
                synced_count: 0,
            })
        }

        async fn delta_sync(
            &self,
            _account_id: &str,
            _checkpoint: &str,
        ) -> Result<SyncOutput, DriverError> {
            Ok(SyncOutput {
                messages: vec![],
                new_checkpoint: "cp2".into(),
                synced_count: 0,
            })
        }

        async fn send(
            &self,
            _account_id: &str,
            _raw_message: &str,
            _thread_id: Option<&str>,
        ) -> Result<String, DriverError> {
            Ok("test-message-id".into())
        }

        async fn test_connection(&self) -> Result<(), DriverError> {
            Ok(())
        }

        fn provider_type(&self) -> &'static str {
            "test"
        }
    }

    #[tokio::test]
    async fn test_trait_object_creation() {
        let driver: Box<dyn ProtocolDriver> = Box::new(TestDriver);
        assert_eq!(driver.provider_type(), "test");
        let output = driver.full_sync("acc1").await.unwrap();
        assert_eq!(output.synced_count, 0);
        assert_eq!(output.new_checkpoint, "cp1");
    }

    #[tokio::test]
    async fn test_trait_object_delta_sync() {
        let driver: Box<dyn ProtocolDriver> = Box::new(TestDriver);
        let output = driver.delta_sync("acc1", "cp0").await.unwrap();
        assert_eq!(output.new_checkpoint, "cp2");
    }

    #[tokio::test]
    async fn test_trait_object_send() {
        let driver: Box<dyn ProtocolDriver> = Box::new(TestDriver);
        let msg_id = driver.send("acc1", "raw_message", None).await.unwrap();
        assert_eq!(msg_id, "test-message-id");
    }

    #[tokio::test]
    async fn test_trait_object_test_connection() {
        let driver: Box<dyn ProtocolDriver> = Box::new(TestDriver);
        driver.test_connection().await.unwrap();
    }

    #[test]
    fn test_sync_message_serde_roundtrip() {
        let msg = SyncMessage {
            id: "INBOX:42".into(),
            thread_id: Some("<abc@test>".into()),
            subject: Some("Test".into()),
            from: Some("Alice <alice@test>".into()),
            to: Some("bob@test".into()),
            date: 1700000000,
            body_text: Some("Hello".into()),
            body_html: None,
            is_read: true,
            folder: "INBOX".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: SyncMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "INBOX:42");
        assert!(deserialized.is_read);
    }

    #[test]
    fn test_sync_output_serde_roundtrip() {
        let output = SyncOutput {
            messages: vec![],
            new_checkpoint: "chk_001".into(),
            synced_count: 0,
        };
        let json = serde_json::to_string(&output).unwrap();
        let deserialized: SyncOutput = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.new_checkpoint, "chk_001");
    }

    #[test]
    fn test_driver_error_from_serialized() {
        let se = SerializedError::new("AUTH_FAILED", "bad credentials");
        let de: DriverError = se.into();
        assert_eq!(de.code, "AUTH_FAILED");
        assert_eq!(de.message, "bad credentials");
    }

    #[test]
    fn test_driver_error_roundtrip() {
        let de = DriverError::new("NETWORK_ERROR", "connection lost");
        let se: SerializedError = de.clone().into();
        let de2: DriverError = se.into();
        assert_eq!(de.code, de2.code);
        assert_eq!(de.message, de2.message);
    }

    #[test]
    fn test_imap_to_sync_message_conversion() {
        let imap = crate::imap::types::ImapMessage {
            uid: 42,
            folder: "INBOX".into(),
            message_id: Some("<abc@test>".into()),
            in_reply_to: None,
            references: None,
            from_address: Some("alice@test".into()),
            from_name: Some("Alice".into()),
            to_addresses: Some("bob@test".into()),
            cc_addresses: None,
            bcc_addresses: None,
            reply_to: None,
            subject: Some("Hello".into()),
            date: 1700000000,
            is_read: true,
            is_starred: false,
            is_draft: false,
            body_html: Some("<p>Hi</p>".into()),
            body_text: Some("Hi".into()),
            snippet: None,
            raw_size: 100,
            list_unsubscribe: None,
            list_unsubscribe_post: None,
            auth_results: None,
            attachments: vec![],
        };
        let sync: SyncMessage = imap.into();
        assert_eq!(sync.id, "INBOX:42");
        assert_eq!(sync.from.as_deref(), Some("Alice <alice@test>"));
        assert_eq!(sync.subject.as_deref(), Some("Hello"));
        assert!(sync.is_read);
    }
}
