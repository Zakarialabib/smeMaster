use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapConfig {
    pub host: String,
    pub port: u16,
    pub security: String, // "tls", "starttls", "none"
    pub username: String,
    pub password: String, // plaintext password or OAuth2 access token
    pub auth_method: String, // "password" or "oauth2"
    #[serde(default)]
    pub accept_invalid_certs: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapFolder {
    pub path: String,      // decoded UTF-8 display name
    pub raw_path: String,  // original modified UTF-7 path for IMAP commands
    pub name: String,      // decoded display name (last segment)
    pub delimiter: String,
    pub special_use: Option<String>, // "\Sent", "\Trash", "\Drafts", "\Junk", "\Archive", "\All"
    pub exists: u32,
    pub unseen: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapMessage {
    pub uid: u32,
    pub folder: String,
    pub message_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
    pub from_address: Option<String>,
    pub from_name: Option<String>,
    pub to_addresses: Option<String>,
    pub cc_addresses: Option<String>,
    pub bcc_addresses: Option<String>,
    pub reply_to: Option<String>,
    pub subject: Option<String>,
    pub date: i64,
    pub is_read: bool,
    pub is_starred: bool,
    pub is_draft: bool,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub snippet: Option<String>,
    pub raw_size: u32,
    pub list_unsubscribe: Option<String>,
    pub list_unsubscribe_post: Option<String>,
    pub auth_results: Option<String>,
    pub attachments: Vec<ImapAttachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapAttachment {
    pub part_id: String,
    pub filename: String,
    pub mime_type: String,
    pub size: u32,
    pub content_id: Option<String>,
    pub is_inline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapFolderStatus {
    pub uidvalidity: u32,
    pub uidnext: u32,
    pub exists: u32,
    pub unseen: u32,
    pub highest_modseq: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapFetchResult {
    pub messages: Vec<ImapMessage>,
    pub folder_status: ImapFolderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapFolderSyncResult {
    pub uids: Vec<u32>,
    pub messages: Vec<ImapMessage>,
    pub folder_status: ImapFolderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapFolderSearchResult {
    pub uids: Vec<u32>,
    pub folder_status: ImapFolderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaCheckRequest {
    pub folder: String,
    pub last_uid: u32,
    pub uidvalidity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeltaCheckResult {
    pub folder: String,
    pub uidvalidity: u32,
    pub new_uids: Vec<u32>,
    pub uidvalidity_changed: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_imap_config_default_accept_invalid_certs() {
        let config = ImapConfig {
            host: "imap.example.com".into(),
            port: 993,
            security: "tls".into(),
            username: "test@example.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: false,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains(r#""accept_invalid_certs":false"#));
    }

    #[test]
    fn test_imap_config_serde_roundtrip() {
        let config = ImapConfig {
            host: "imap.example.com".into(),
            port: 993,
            security: "tls".into(),
            username: "test@example.com".into(),
            password: "secret".into(),
            auth_method: "password".into(),
            accept_invalid_certs: true,
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ImapConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.host, config.host);
        assert_eq!(deserialized.port, config.port);
        assert_eq!(deserialized.accept_invalid_certs, true);
    }

    #[test]
    fn test_imap_config_serde_default_accept_invalid_certs() {
        let json = r#"{"host":"imap.example.com","port":993,"security":"tls","username":"u","password":"p","auth_method":"password"}"#;
        let config: ImapConfig = serde_json::from_str(json).unwrap();
        assert!(!config.accept_invalid_certs);
    }

    #[test]
    fn test_imap_message_fields() {
        let msg = ImapMessage {
            uid: 42,
            folder: "INBOX".into(),
            message_id: Some("<abc@example.com>".into()),
            in_reply_to: None,
            references: None,
            from_address: Some("sender@example.com".into()),
            from_name: None,
            to_addresses: Some("recipient@example.com".into()),
            cc_addresses: None,
            bcc_addresses: None,
            reply_to: None,
            subject: Some("Test".into()),
            date: 1234567890,
            is_read: true,
            is_starred: false,
            is_draft: false,
            body_html: None,
            body_text: Some("Hello".into()),
            snippet: None,
            raw_size: 100,
            list_unsubscribe: None,
            list_unsubscribe_post: None,
            auth_results: None,
            attachments: vec![],
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: ImapMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uid, 42);
        assert!(deserialized.is_read);
        assert!(!deserialized.is_starred);
    }

    #[test]
    fn test_imap_folder_serde() {
        let folder = ImapFolder {
            path: "INBOX".into(),
            raw_path: "INBOX".into(),
            name: "Inbox".into(),
            delimiter: "/".into(),
            special_use: Some("\\Inbox".into()),
            exists: 10,
            unseen: 2,
        };
        let json = serde_json::to_string(&folder).unwrap();
        let deserialized: ImapFolder = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.path, "INBOX");
        assert_eq!(deserialized.special_use, Some("\\Inbox".into()));
    }

    #[test]
    fn test_imap_folder_status_serde() {
        let status = ImapFolderStatus {
            uidvalidity: 12345,
            uidnext: 100,
            exists: 50,
            unseen: 3,
            highest_modseq: Some(999),
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: ImapFolderStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uidvalidity, 12345);
        assert_eq!(deserialized.highest_modseq, Some(999));
    }

    #[test]
    fn test_attachment_serde() {
        let att = ImapAttachment {
            part_id: "1.2".into(),
            filename: "report.pdf".into(),
            mime_type: "application/pdf".into(),
            size: 4096,
            content_id: Some("cid:123".into()),
            is_inline: false,
        };
        let json = serde_json::to_string(&att).unwrap();
        let deserialized: ImapAttachment = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.filename, "report.pdf");
        assert!(deserialized.content_id.is_some());
    }
}
