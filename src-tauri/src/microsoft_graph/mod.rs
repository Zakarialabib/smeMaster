// ── Microsoft Graph driver ────────────────────────────────────────────
//
// Implements ProtocolDriver for Outlook/Hotmail/Live accounts using
// the Microsoft Graph REST API v1.0.
//
// The driver uses the delta query endpoint for both full and incremental
// syncs, following @odata.nextLink pagination and capturing
// @odata.deltaLink for subsequent delta requests.
//
// Token management is handled externally by the OAuth token monitor
// (oauth::monitor). This driver reads the current access_token directly
// from the oauth_tokens table.

use async_trait::async_trait;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::imap::driver::{DriverError, ProtocolDriver, SyncMessage, SyncOutput};

// ── Driver ────────────────────────────────────────────────────────────

pub struct MicrosoftGraphDriver {
    pool: SqlitePool,
    client: reqwest::Client,
}

impl MicrosoftGraphDriver {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            client: reqwest::Client::builder()
                .user_agent("SMEMaster/1.0")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Get the current access token for this account from the oauth_tokens table.
    async fn get_access_token(&self, account_id: &str) -> Result<String, DriverError> {
        let row = sqlx::query_as::<_, (String,)>(
            "SELECT access_token FROM oauth_tokens WHERE account_id = ?1",
        )
        .bind(account_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DriverError::new("DB_ERROR", format!("Token lookup failed: {e}")))?
        .ok_or_else(|| DriverError::new("NO_TOKEN", "No OAuth token found for account"))?;

        Ok(row.0)
    }

    /// List mail folder IDs from Microsoft Graph.
    async fn list_folders(&self, token: &str) -> Result<Vec<String>, DriverError> {
        let resp = self
            .client
            .get("https://graph.microsoft.com/v1.0/me/mailFolders?$select=id,displayName&$top=50")
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| DriverError::new("HTTP_ERROR", format!("Failed to list folders: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            return Err(DriverError::new(
                "API_ERROR",
                format!("Graph API returned {status} when listing folders"),
            ));
        }

        let folders: GraphFolderList = resp.json().await.map_err(|e| {
            DriverError::new("PARSE_ERROR", format!("Failed to parse folder list: {e}"))
        })?;

        Ok(folders.value.into_iter().map(|f| f.id).collect())
    }

    /// Fetch all pages from a delta query URL, returning messages and the new deltaLink.
    async fn fetch_delta_pages(
        &self,
        token: &str,
        url: &str,
    ) -> Result<(Vec<GraphMessage>, Option<String>), DriverError> {
        let mut all_messages = Vec::new();
        let mut next_url = Some(url.to_string());
        let mut delta_link: Option<String> = None;

        while let Some(ref current_url) = next_url {
            let resp = self
                .client
                .get(current_url.as_str())
                .header("Authorization", format!("Bearer {token}"))
                .send()
                .await
                .map_err(|e| {
                    DriverError::new("HTTP_ERROR", format!("Delta query failed: {e}"))
                })?;

            if !resp.status().is_success() {
                return Err(DriverError::new(
                    "API_ERROR",
                    format!("Graph API returned {} during delta query", resp.status()),
                ));
            }

            let page: GraphDeltaResponse = resp.json().await.map_err(|e| {
                DriverError::new(
                    "PARSE_ERROR",
                    format!("Failed to parse delta response: {e}"),
                )
            })?;

            // Skip messages with @removed (deleted messages)
            let active = page
                .value
                .into_iter()
                .filter(|m| m.removed_reason.is_none())
                .collect::<Vec<_>>();

            all_messages.extend(active);
            next_url = page.next_link;

            // The deltaLink appears only on the last page of results
            if page.delta_link.is_some() {
                delta_link = page.delta_link;
            }
        }

        Ok((all_messages, delta_link))
    }

    /// Sync a single folder using the delta endpoint (initial or paginated).
    async fn sync_folder_delta(
        &self,
        token: &str,
        folder_id: &str,
        delta_link: Option<&str>,
    ) -> Result<(Vec<GraphMessage>, Option<String>), DriverError> {
        let url = if let Some(dl) = delta_link {
            dl.to_string()
        } else {
            format!(
                "https://graph.microsoft.com/v1.0/me/mailFolders/{folder_id}/messages/delta\
                 ?$select=id,subject,from,toRecipients,receivedDateTime,body,\
                 isRead,parentFolderId,conversationId&$top=50"
            )
        };

        self.fetch_delta_pages(token, &url).await
    }

    /// Convert a GraphMessage to our unified SyncMessage format.
    fn to_sync_message(msg: GraphMessage) -> SyncMessage {
        let date_ts = msg
            .received_date_time
            .and_then(|d| chrono::DateTime::parse_from_rfc3339(&d).ok())
            .map(|dt| dt.timestamp())
            .unwrap_or(0);

        let from_str = msg
            .from
            .and_then(|f| f.email_address)
            .map(|a| match (a.name, a.address) {
                (Some(n), Some(addr)) => format!("{n} <{addr}>"),
                (Some(n), None) => n,
                (None, Some(addr)) => addr,
                (None, None) => "Unknown".into(),
            })
            .unwrap_or_default();

        let to_str = msg
            .to_recipients
            .map(|recipients| {
                recipients
                    .iter()
                    .filter_map(|r| r.email_address.as_ref())
                    .map(|a| a.address.as_deref().unwrap_or("unknown"))
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();

        let folder_name = msg.parent_folder_id.unwrap_or_else(|| "unknown".into());

        SyncMessage {
            id: msg.id,
            thread_id: msg.conversation_id,
            subject: msg.subject,
            from: Some(from_str),
            to: Some(to_str),
            date: date_ts,
            body_text: msg.body.as_ref().and_then(|b| {
                if b.content_type.as_deref() == Some("text") {
                    b.content.clone()
                } else {
                    None
                }
            }),
            body_html: msg.body.as_ref().and_then(|b| {
                if b.content_type.as_deref() == Some("html") {
                    b.content.clone()
                } else {
                    None
                }
            }),
            is_read: msg.is_read.unwrap_or(false),
            folder: folder_name,
        }
    }
}

// ── Graph API response types ─────────────────────────────────────────

#[derive(Deserialize)]
struct GraphDeltaResponse {
    #[serde(default)]
    value: Vec<GraphMessage>,

    #[serde(default, rename = "@odata.nextLink")]
    #[allow(dead_code)]
    next_link: Option<String>,

    #[serde(default, rename = "@odata.deltaLink")]
    #[allow(dead_code)]
    delta_link: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphMessage {
    id: String,

    #[serde(default)]
    subject: Option<String>,

    #[serde(default)]
    received_date_time: Option<String>,

    #[serde(default)]
    is_read: Option<bool>,

    #[serde(default)]
    parent_folder_id: Option<String>,

    #[serde(default)]
    conversation_id: Option<String>,

    #[serde(default)]
    from: Option<GraphEmailAddressField>,

    #[serde(default)]
    to_recipients: Option<Vec<GraphEmailAddressField>>,

    #[serde(default)]
    body: Option<GraphMessageBody>,

    /// Present when a message has been deleted (delta queries only).
    #[serde(rename = "@removed", default)]
    removed_reason: Option<GraphRemoved>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphEmailAddressField {
    #[serde(default)]
    email_address: Option<GraphEmailAddress>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphEmailAddress {
    #[serde(default)]
    name: Option<String>,

    #[serde(default)]
    address: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphMessageBody {
    #[serde(default)]
    content_type: Option<String>,

    #[serde(default)]
    content: Option<String>,
}

#[derive(Deserialize)]
struct GraphRemoved {
    #[allow(dead_code)]
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Deserialize)]
struct GraphFolderList {
    value: Vec<GraphFolder>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphFolder {
    id: String,

    #[allow(dead_code)]
    #[serde(default)]
    display_name: String,
}

// ── Trait implementation ─────────────────────────────────────────────

#[async_trait]
impl ProtocolDriver for MicrosoftGraphDriver {
    /// Full sync: list all folders, request delta (initial) for each,
    /// follow pagination, and capture the deltaLink checkpoint.
    async fn full_sync(&self, account_id: &str) -> Result<SyncOutput, DriverError> {
        let token = self.get_access_token(account_id).await?;
        let folder_ids = self.list_folders(&token).await?;

        let mut all_messages = Vec::new();
        let mut synced_count: u32 = 0;

        for folder_id in &folder_ids {
            let (messages, _delta_link) = self.sync_folder_delta(&token, folder_id, None).await?;

            let count = messages.len() as u32;
            let converted: Vec<SyncMessage> =
                messages.into_iter().map(Self::to_sync_message).collect();

            synced_count += count;
            all_messages.extend(converted);
        }

        let checkpoint = format!("graph_full:{}", chrono::Utc::now().timestamp());

        log::info!(
            "[graph-driver] full_sync for {account_id}: {synced_count} messages from {} folders",
            folder_ids.len()
        );

        Ok(SyncOutput {
            messages: all_messages,
            new_checkpoint: checkpoint,
            synced_count,
        })
    }

    /// Delta sync: if the checkpoint contains a deltaLink URL, use it directly.
    /// Otherwise, fall back to a full sync.
    async fn delta_sync(
        &self,
        account_id: &str,
        checkpoint: &str,
    ) -> Result<SyncOutput, DriverError> {
        let token = self.get_access_token(account_id).await?;

        log::info!("[graph-driver] delta_sync from checkpoint: {checkpoint}");

        if checkpoint.starts_with("https://") {
            // The checkpoint IS a deltaLink URL — follow it
            let (messages, new_delta_link) =
                self.fetch_delta_pages(&token, checkpoint).await?;

            let count = messages.len() as u32;
            let converted: Vec<SyncMessage> =
                messages.into_iter().map(Self::to_sync_message).collect();

            let new_checkpoint = new_delta_link.unwrap_or_else(|| checkpoint.to_string());

            log::info!(
                "[graph-driver] delta_sync for {account_id}: {count} changes",
            );

            return Ok(SyncOutput {
                messages: converted,
                new_checkpoint,
                synced_count: count,
            });
        }

        // Fallback: no deltaLink — run a full sync
        log::info!(
            "[graph-driver] No deltaLink in checkpoint, falling back to full sync"
        );
        self.full_sync(account_id).await
    }

    /// Send an email via Microsoft Graph.
    ///
    /// NOTE: Microsoft Graph sendMail requires a specific JSON payload,
    /// not raw RFC 2822. This is not yet implemented.
    async fn send(
        &self,
        _account_id: &str,
        _raw_message: &str,
        _thread_id: Option<&str>,
    ) -> Result<String, DriverError> {
        Err(DriverError::new(
            "NOT_IMPLEMENTED",
            "Microsoft Graph sendMail not yet implemented. Use IMAP/SMTP for sending.",
        ))
    }

    /// Test connection — not implemented at the trait level.
    ///
    /// The ProtocolDriver::test_connection() has no account_id parameter,
    /// so it cannot perform an authenticated check. Use the Tauri command
    /// `test_protocol_connection` instead, which loads account config first.
    async fn test_connection(&self) -> Result<(), DriverError> {
        Err(DriverError::new(
            "NOT_IMPLEMENTED",
            "Use test_protocol_connection Tauri command instead",
        ))
    }

    fn provider_type(&self) -> &'static str {
        "microsoft_graph"
    }
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_provider_type() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let driver = MicrosoftGraphDriver::new(pool);
        assert_eq!(driver.provider_type(), "microsoft_graph");
    }

    #[tokio::test]
    async fn test_get_access_token_no_account() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let driver = MicrosoftGraphDriver::new(pool);
        let result = driver.get_access_token("nonexistent").await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "NO_TOKEN");
        assert!(err.message.contains("No OAuth token"));
    }

    #[test]
    fn test_sync_output_serde_roundtrip() {
        let output = SyncOutput {
            messages: vec![],
            new_checkpoint: "graph_checkpoint".into(),
            synced_count: 0,
        };
        let json = serde_json::to_string(&output).unwrap();
        let deserialized: SyncOutput = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.new_checkpoint, "graph_checkpoint");
    }

    #[test]
    fn test_to_sync_message_minimal() {
        let msg = GraphMessage {
            id: "msg-1".into(),
            subject: None,
            received_date_time: None,
            is_read: None,
            parent_folder_id: None,
            conversation_id: None,
            from: None,
            to_recipients: None,
            body: None,
            removed_reason: None,
        };
        let sync = MicrosoftGraphDriver::to_sync_message(msg);
        assert_eq!(sync.id, "msg-1");
        assert!(!sync.is_read);
        assert_eq!(sync.folder, "unknown");
    }

    #[test]
    fn test_graph_message_serde() {
        let json = r#"{
            "id": "AQMkAD",
            "subject": "Hello",
            "receivedDateTime": "2024-06-01T12:00:00Z",
            "isRead": true,
            "parentFolderId": "folder-1",
            "conversationId": "conv-1"
        }"#;
        let msg: GraphMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.id, "AQMkAD");
        assert_eq!(msg.subject.as_deref(), Some("Hello"));
        assert!(msg.is_read.unwrap());
    }

    #[test]
    fn test_graph_message_with_removed() {
        let json = r#"{
            "id": "deleted-msg",
            "@removed": { "reason": "deleted" }
        }"#;
        let msg: GraphMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg.id, "deleted-msg");
        assert!(msg.removed_reason.is_some());
        assert_eq!(
            msg.removed_reason.unwrap().reason.as_deref(),
            Some("deleted")
        );
    }

    #[test]
    fn test_graph_folder_serde() {
        let json = r#"{"id": "folder-1", "displayName": "Inbox"}"#;
        let folder: GraphFolder = serde_json::from_str(json).unwrap();
        assert_eq!(folder.id, "folder-1");
        assert_eq!(folder.display_name, "Inbox");
    }

    #[test]
    fn test_delta_response_with_odata_links() {
        let json = r#"{
            "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#Collection(message)",
            "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/mailFolders/AAMkAD/messages/delta?$skip=50",
            "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/mailFolders/AAMkAD/messages/delta?$deltatoken=abc123",
            "value": []
        }"#;
        let resp: GraphDeltaResponse = serde_json::from_str(json).unwrap();
        assert!(resp.next_link.is_some());
        assert!(resp.delta_link.is_some());
        assert!(resp.value.is_empty());
    }
}
