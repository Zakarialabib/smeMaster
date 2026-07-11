use async_imap::types::NameAttribute;
use futures::StreamExt;

use crate::error::{SerializedError, ERR_CONNECTION_TIMEOUT, ERR_NETWORK};
use super::connect::*;
use super::types::*;

pub async fn list_folders(session: &mut ImapSession) -> Result<Vec<ImapFolder>, SerializedError> {
    let names_stream = tokio::time::timeout(IMAP_CMD_TIMEOUT, session.list(Some(""), Some("*")))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("LIST timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("LIST failed: {e}")))?;

    let names: Vec<_> = tokio::time::timeout(IMAP_CMD_TIMEOUT, names_stream.collect::<Vec<_>>())
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("LIST stream timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))?
        .into_iter()
        .filter_map(|r| r.ok())
        .collect();

    let mut folders = Vec::new();
    for name in &names {
        let raw_path = name.name().to_string();
        let delimiter = name.delimiter().unwrap_or("/").to_string();
        let path = utf7_imap::decode_utf7_imap(raw_path.clone());
        let display_name = path.rsplit_once(&delimiter)
            .map(|(_, last)| last.to_string())
            .unwrap_or_else(|| path.clone());

        let special_use = detect_special_use(name);

        let (exists, unseen) = match tokio::time::timeout(
            IMAP_CMD_TIMEOUT,
            session.status(&raw_path, "(MESSAGES UNSEEN)"),
        ).await {
            Ok(Ok(mailbox)) => (mailbox.exists, mailbox.unseen.unwrap_or(0)),
            _ => (0, 0),
        };

        folders.push(ImapFolder {
            path, raw_path, name: display_name, delimiter, special_use, exists, unseen,
        });
    }

    Ok(folders)
}

pub async fn get_folder_status(
    session: &mut ImapSession,
    folder: &str,
) -> Result<ImapFolderStatus, SerializedError> {
    let mailbox = tokio::time::timeout(
        IMAP_CMD_TIMEOUT,
        session.status(folder, "(UIDVALIDITY UIDNEXT MESSAGES UNSEEN)"),
    )
    .await
    .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("STATUS timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))?
    .map_err(|e| SerializedError::new(ERR_NETWORK, format!("STATUS failed: {e}")))?;

    Ok(ImapFolderStatus {
        uidvalidity: mailbox.uid_validity.unwrap_or(0),
        uidnext: mailbox.uid_next.unwrap_or(0),
        exists: mailbox.exists,
        unseen: mailbox.unseen.unwrap_or(0),
        highest_modseq: mailbox.highest_modseq,
    })
}

fn detect_special_use(name: &async_imap::types::Name) -> Option<String> {
    for attr in name.attributes() {
        let special = match attr {
            NameAttribute::Sent => Some("\\Sent"),
            NameAttribute::Trash => Some("\\Trash"),
            NameAttribute::Drafts => Some("\\Drafts"),
            NameAttribute::Junk => Some("\\Junk"),
            NameAttribute::Archive => Some("\\Archive"),
            NameAttribute::All => Some("\\All"),
            NameAttribute::Flagged => Some("\\Flagged"),
            _ => None,
        };
        if let Some(s) = special { return Some(s.to_string()); }
    }

    detect_special_use_by_name(name.name())
}

fn detect_special_use_by_name(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    match lower.as_str() {
        "inbox" => Some("\\Inbox".to_string()),
        "sent" | "sent messages" | "sent items" | "[gmail]/sent mail" => Some("\\Sent".to_string()),
        "trash" | "deleted" | "deleted items" | "deleted messages" | "bin" | "corbeille" | "unsolbox" | "[gmail]/trash" => Some("\\Trash".to_string()),
        "drafts" | "draft" | "draftbox" | "brouillons" | "[gmail]/drafts" => Some("\\Drafts".to_string()),
        "junk" | "spam" | "junk e-mail" | "[gmail]/spam" => Some("\\Junk".to_string()),
        "archive" | "archives" | "[gmail]/all mail" => Some("\\Archive".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_by_name_inbox() {
        assert_eq!(detect_special_use_by_name("inbox"), Some("\\Inbox".to_string()));
    }

    #[test]
    fn test_detect_by_name_inbox_case_insensitive() {
        assert_eq!(detect_special_use_by_name("INBOX"), Some("\\Inbox".to_string()));
    }

    #[test]
    fn test_detect_by_name_sent() {
        assert_eq!(detect_special_use_by_name("sent"), Some("\\Sent".to_string()));
    }

    #[test]
    fn test_detect_by_name_sent_messages() {
        assert_eq!(detect_special_use_by_name("sent messages"), Some("\\Sent".to_string()));
    }

    #[test]
    fn test_detect_by_name_sent_items() {
        assert_eq!(detect_special_use_by_name("sent items"), Some("\\Sent".to_string()));
    }

    #[test]
    fn test_detect_by_name_gmail_sent() {
        assert_eq!(detect_special_use_by_name("[gmail]/sent mail"), Some("\\Sent".to_string()));
    }

    #[test]
    fn test_detect_by_name_trash() {
        assert_eq!(detect_special_use_by_name("trash"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_deleted() {
        assert_eq!(detect_special_use_by_name("deleted"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_deleted_items() {
        assert_eq!(detect_special_use_by_name("deleted items"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_deleted_messages() {
        assert_eq!(detect_special_use_by_name("deleted messages"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_bin() {
        assert_eq!(detect_special_use_by_name("bin"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_corbeille() {
        assert_eq!(detect_special_use_by_name("corbeille"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_unsolbox() {
        assert_eq!(detect_special_use_by_name("unsolbox"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_gmail_trash() {
        assert_eq!(detect_special_use_by_name("[gmail]/trash"), Some("\\Trash".to_string()));
    }

    #[test]
    fn test_detect_by_name_drafts() {
        assert_eq!(detect_special_use_by_name("drafts"), Some("\\Drafts".to_string()));
    }

    #[test]
    fn test_detect_by_name_draft() {
        assert_eq!(detect_special_use_by_name("draft"), Some("\\Drafts".to_string()));
    }

    #[test]
    fn test_detect_by_name_draftbox() {
        assert_eq!(detect_special_use_by_name("draftbox"), Some("\\Drafts".to_string()));
    }

    #[test]
    fn test_detect_by_name_brouillons() {
        assert_eq!(detect_special_use_by_name("brouillons"), Some("\\Drafts".to_string()));
    }

    #[test]
    fn test_detect_by_name_gmail_drafts() {
        assert_eq!(detect_special_use_by_name("[gmail]/drafts"), Some("\\Drafts".to_string()));
    }

    #[test]
    fn test_detect_by_name_junk() {
        assert_eq!(detect_special_use_by_name("junk"), Some("\\Junk".to_string()));
    }

    #[test]
    fn test_detect_by_name_spam() {
        assert_eq!(detect_special_use_by_name("spam"), Some("\\Junk".to_string()));
    }

    #[test]
    fn test_detect_by_name_junk_email() {
        assert_eq!(detect_special_use_by_name("junk e-mail"), Some("\\Junk".to_string()));
    }

    #[test]
    fn test_detect_by_name_gmail_spam() {
        assert_eq!(detect_special_use_by_name("[gmail]/spam"), Some("\\Junk".to_string()));
    }

    #[test]
    fn test_detect_by_name_archive() {
        assert_eq!(detect_special_use_by_name("archive"), Some("\\Archive".to_string()));
    }

    #[test]
    fn test_detect_by_name_archives() {
        assert_eq!(detect_special_use_by_name("archives"), Some("\\Archive".to_string()));
    }

    #[test]
    fn test_detect_by_name_gmail_all_mail() {
        assert_eq!(detect_special_use_by_name("[gmail]/all mail"), Some("\\Archive".to_string()));
    }

    #[test]
    fn test_detect_by_name_custom_folder() {
        assert_eq!(detect_special_use_by_name("custom_folder"), None);
    }

    #[test]
    fn test_detect_by_name_work_emails() {
        assert_eq!(detect_special_use_by_name("work emails"), None);
    }

    #[test]
    fn test_detect_by_name_empty() {
        assert_eq!(detect_special_use_by_name(""), None);
    }

    #[test]
    fn test_detect_by_name_case_insensitive_sent() {
        assert_eq!(detect_special_use_by_name("SENT"), Some("\\Sent".to_string()));
    }

    #[test]
    fn test_detect_by_name_case_insensitive_trash() {
        assert_eq!(detect_special_use_by_name("Trash"), Some("\\Trash".to_string()));
    }
}
