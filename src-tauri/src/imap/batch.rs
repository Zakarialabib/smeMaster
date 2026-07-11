use futures::StreamExt;
use serde::{Deserialize, Serialize};

use crate::error::{SerializedError, ERR_CONNECTION_TIMEOUT, ERR_NETWORK};
use super::connect::ImapSession;

// ---------------------------------------------------------------------------
// Configurable chunk sizes – adjust for mobile if needed
// ---------------------------------------------------------------------------

/// Maximum UIDs per STORE command (flags, delete).
const CHUNK_FLAGS: usize = 100;

/// Maximum UIDs per MOVE / COPY command.
const CHUNK_MOVE: usize = 50;

/// Maximum UIDs per FETCH metadata command.
const CHUNK_METADATA: usize = 200;

// ---------------------------------------------------------------------------
// Batch result types
// ---------------------------------------------------------------------------

/// Result for a single operation within a batch
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchItemResult {
    pub item_id: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Aggregate result for a full batch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub items: Vec<BatchItemResult>,
}

/// Metadata returned for a single message in batch_fetch_metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchMetadata {
    pub uid: u32,
    pub flags: Vec<String>,
    pub internal_date: Option<String>,
    pub size: Option<u32>,
    pub envelope: Option<String>,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Build a UID set string from a slice of UIDs
fn build_uid_set(uids: &[u32]) -> String {
    uids.iter()
        .map(|u| u.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

/// Build a STORE flags string from a slice of flag names.
/// Prepends "\\" if not already present.
fn build_flags_string(flags: &[&str]) -> String {
    let formatted: Vec<String> = flags
        .iter()
        .map(|f| {
            if f.starts_with('\\') {
                f.to_string()
            } else {
                format!("\\{f}")
            }
        })
        .collect();
    format!("({})", formatted.join(" "))
}

/// Generate the FETCH query string from requested fields.
fn build_fetch_query(fields: &[&str]) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for f in fields {
        match *f {
            "FLAGS" => parts.push("FLAGS"),
            "INTERNALDATE" => parts.push("INTERNALDATE"),
            "SIZE" | "RFC822.SIZE" => parts.push("RFC822.SIZE"),
            "ENVELOPE" => parts.push("BODY.PEEK[HEADER]"),
            other => parts.push(other),
        }
    }
    if parts.is_empty() {
        "UID FLAGS INTERNALDATE RFC822.SIZE".to_string()
    } else {
        format!("UID {}", parts.join(" "))
    }
}

// ---------------------------------------------------------------------------
// Low-level helper: apply uid_store to a chunk, returning Ok(()) if the
// server accepted the command (stream is consumed here).
// ---------------------------------------------------------------------------

async fn try_batch_store(
    session: &mut ImapSession,
    uid_set: &str,
    query: &str,
) -> Result<(), SerializedError> {
    match tokio::time::timeout(
        super::connect::IMAP_CMD_TIMEOUT,
        session.uid_store(uid_set, query),
    )
    .await
    {
        Ok(Ok(stream)) => {
            // Consume the stream to release the borrow on session
            let _: Vec<_> = stream.collect().await;
            Ok(())
        }
        Ok(Err(e)) => Err(SerializedError::new(ERR_NETWORK, format!("UID STORE failed: {e}"))),
        Err(_) => Err(SerializedError::new(ERR_CONNECTION_TIMEOUT, "UID STORE timed out")),
    }
}

/// Attempt UID EXPUNGE on a specific set of UIDs (RFC 4315).
/// If the server doesn't support it, fall back to a full EXPUNGE.
async fn expunge_uids(session: &mut ImapSession, uids: &str) {
    // Try UID EXPUNGE first (more precise, no side‑effects)
    let uid_expunge_ok = tokio::time::timeout(
        super::connect::IMAP_CMD_TIMEOUT,
        async {
            match session.uid_expunge(uids).await {
                Ok(stream) => {
                    let _: Vec<_> = stream.collect().await;
                    true
                }
                Err(_) => false,
            }
        },
    )
    .await
    .unwrap_or(false);

    if !uid_expunge_ok {
        // Fallback: full EXPUNGE (removes all messages with \Deleted flag)
        if let Ok(stream) = session.expunge().await {
            let _: Vec<_> = stream.collect().await;
        }
    }
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/// Convenience wrapper for marking messages as read or unread.
pub async fn batch_mark_read(
    session: &mut ImapSession,
    folder: &str,
    uids: &[u32],
    read: bool,
) -> Result<BatchResult, SerializedError> {
    batch_set_flags(session, folder, uids, &["Seen"], read).await
}

/// Batch set or clear flags on multiple messages.
///
/// Processes UIDs in chunks of `CHUNK_FLAGS`. On chunk failure, falls back to
/// individual UIDs so that partial success is reported per‑item.
pub async fn batch_set_flags(
    session: &mut ImapSession,
    folder: &str,
    message_uids: &[u32],
    flags: &[&str],
    is_add: bool,
) -> Result<BatchResult, SerializedError> {
    tokio::time::timeout(
        super::connect::IMAP_CMD_TIMEOUT,
        session.select(folder),
    )
    .await
    .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {folder} timed out")))?
    .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let flag_op = if is_add { "+FLAGS" } else { "-FLAGS" };
    let flags_str = build_flags_string(flags);
    let query = format!("{flag_op} {flags_str}");
    let mut items: Vec<BatchItemResult> = Vec::new();

    for chunk in message_uids.chunks(CHUNK_FLAGS) {
        let uid_set = build_uid_set(chunk);

        match try_batch_store(session, &uid_set, &query).await {
            Ok(()) => {
                for uid in chunk {
                    items.push(BatchItemResult {
                        item_id: uid.to_string(),
                        success: true,
                        error: None,
                    });
                }
            }
            Err(_batch_err) => {
                // Fall back to per-UID
                for uid in chunk {
                    let single = uid.to_string();
                    match try_batch_store(session, &single, &query).await {
                        Ok(()) => {
                            items.push(BatchItemResult {
                                item_id: uid.to_string(),
                                success: true,
                                error: None,
                            });
                        }
                        Err(e) => {
                            items.push(BatchItemResult {
                                item_id: uid.to_string(),
                                success: false,
                                error: Some(e.to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    let succeeded = items.iter().filter(|i| i.success).count();
    Ok(BatchResult {
        total: items.len(),
        succeeded,
        failed: items.len() - succeeded,
        items,
    })
}

/// Batch move messages between folders.
///
/// Uses UID MOVE if the server supports it, otherwise falls back to
/// UID COPY + STORE +FLAGS (\\Deleted) + precise UID EXPUNGE (or full EXPUNGE).
/// Processes in chunks of `CHUNK_MOVE`.
pub async fn batch_move_messages(
    session: &mut ImapSession,
    source_folder: &str,
    dest_folder: &str,
    message_uids: &[u32],
) -> Result<BatchResult, SerializedError> {
    tokio::time::timeout(
        super::connect::IMAP_CMD_TIMEOUT,
        session.select(source_folder),
    )
    .await
    .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {source_folder} timed out")))?
    .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {source_folder} failed: {e}")))?;

    let mut items: Vec<BatchItemResult> = Vec::new();

    for chunk in message_uids.chunks(CHUNK_MOVE) {
        let uid_set = build_uid_set(chunk);

        // Try UID MOVE first
        let move_ok = match tokio::time::timeout(
            super::connect::IMAP_CMD_TIMEOUT,
            session.uid_mv(&uid_set, dest_folder),
        )
        .await
        {
            Ok(Ok(())) => true,
            _ => false,
        };

        if move_ok {
            for uid in chunk {
                items.push(BatchItemResult {
                    item_id: uid.to_string(),
                    success: true,
                    error: None,
                });
            }
        } else {
            // Fallback: COPY + STORE +Deleted + expunge those specific UIDs
            let copy_ok = match tokio::time::timeout(
                super::connect::IMAP_CMD_TIMEOUT,
                session.uid_copy(&uid_set, dest_folder),
            )
            .await
            {
                Ok(Ok(())) => true,
                _ => false,
            };

            if copy_ok {
                // Mark as deleted in source
                let _ = try_batch_store(session, &uid_set, "+FLAGS (\\Deleted)").await;
                // Expunge only these UIDs (or full expunge if UID EXPUNGE not supported)
                expunge_uids(session, &uid_set).await;

                for uid in chunk {
                    items.push(BatchItemResult {
                        item_id: uid.to_string(),
                        success: true,
                        error: None,
                    });
                }
            } else {
                // Both UID MOVE and UID COPY failed — report per UID
                for uid in chunk {
                    let single = uid.to_string();
                    match tokio::time::timeout(
                        super::connect::IMAP_CMD_TIMEOUT,
                        session.uid_copy(&single, dest_folder),
                    )
                    .await
                    {
                        Ok(Ok(())) => {
                            let _ = try_batch_store(session, &single, "+FLAGS (\\Deleted)").await;
                            expunge_uids(session, &single).await;
                            items.push(BatchItemResult {
                                item_id: uid.to_string(),
                                success: true,
                                error: None,
                            });
                        }
                        _ => {
                            items.push(BatchItemResult {
                                item_id: uid.to_string(),
                                success: false,
                                error: Some(String::from(
                                    "Move failed: UID MOVE and UID COPY both failed",
                                )),
                            });
                        }
                    }
                }
            }
        }
    }

    let succeeded = items.iter().filter(|i| i.success).count();
    Ok(BatchResult {
        total: items.len(),
        succeeded,
        failed: items.len() - succeeded,
        items,
    })
}

/// Batch delete messages from a folder.
///
/// Marks messages as deleted, then expunges only the specified UIDs
/// (or falls back to full EXPUNGE). Processes in chunks of `CHUNK_FLAGS`.
pub async fn batch_delete_messages(
    session: &mut ImapSession,
    folder: &str,
    message_uids: &[u32],
) -> Result<BatchResult, SerializedError> {
    tokio::time::timeout(
        super::connect::IMAP_CMD_TIMEOUT,
        session.select(folder),
    )
    .await
    .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {folder} timed out")))?
    .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let mut items: Vec<BatchItemResult> = Vec::new();

    for chunk in message_uids.chunks(CHUNK_FLAGS) {
        let uid_set = build_uid_set(chunk);

        match try_batch_store(session, &uid_set, "+FLAGS (\\Deleted)").await {
            Ok(()) => {
                // Expunge only these UIDs (or full expunge as fallback)
                expunge_uids(session, &uid_set).await;

                for uid in chunk {
                    items.push(BatchItemResult {
                        item_id: uid.to_string(),
                        success: true,
                        error: None,
                    });
                }
            }
            Err(_batch_err) => {
                // Fall back to per-UID
                for uid in chunk {
                    let single = uid.to_string();
                    match try_batch_store(session, &single, "+FLAGS (\\Deleted)").await {
                        Ok(()) => {
                            expunge_uids(session, &single).await;
                            items.push(BatchItemResult {
                                item_id: uid.to_string(),
                                success: true,
                                error: None,
                            });
                        }
                        Err(e) => {
                            items.push(BatchItemResult {
                                item_id: uid.to_string(),
                                success: false,
                                error: Some(e.to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    let succeeded = items.iter().filter(|i| i.success).count();
    Ok(BatchResult {
        total: items.len(),
        succeeded,
        failed: items.len() - succeeded,
        items,
    })
}

/// Batch fetch metadata (flags, internal date, size, envelope) for multiple
/// messages in a folder.
///
/// Supported fields: "FLAGS", "INTERNALDATE", "SIZE" / "RFC822.SIZE", "ENVELOPE"
/// Processes in chunks of `CHUNK_METADATA`.
pub async fn batch_fetch_metadata(
    session: &mut ImapSession,
    folder: &str,
    message_uids: &[u32],
    fields: &[&str],
) -> Result<Vec<BatchMetadata>, SerializedError> {
    tokio::time::timeout(
        super::connect::IMAP_CMD_TIMEOUT,
        session.select(folder),
    )
    .await
    .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {folder} timed out")))?
    .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let query = build_fetch_query(fields);
    let want_envelope = fields.contains(&"ENVELOPE");
    let mut results: Vec<BatchMetadata> = Vec::new();

    for chunk in message_uids.chunks(CHUNK_METADATA) {
        let uid_set = build_uid_set(chunk);

        let fetches: Vec<_> = tokio::time::timeout(
            super::connect::IMAP_FETCH_TIMEOUT,
            session.uid_fetch(&uid_set, &query),
        )
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, "UID FETCH timed out"))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID FETCH failed: {e}")))?
        .collect::<Vec<_>>()
        .await;

        for r in fetches {
            match r {
                Ok(fetch) => {
                    let uid = fetch.uid.unwrap_or(0);
                    let flags: Vec<String> = fetch
                        .flags()
                        .map(|f| format!("{f:?}"))
                        .collect();
                    let internal_date = fetch
                        .internal_date()
                        .map(|dt| dt.to_rfc3339());
                    let size = fetch.size;

                    let envelope = if want_envelope {
                        fetch.body().map(|b| String::from_utf8_lossy(b).to_string())
                    } else {
                        None
                    };

                    results.push(BatchMetadata {
                        uid,
                        flags,
                        internal_date,
                        size,
                        envelope,
                    });
                }
                Err(e) => {
                    log::warn!("batch_fetch_metadata: fetch error: {e}");
                }
            }
        }
    }

    Ok(results)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_uid_set() {
        assert_eq!(build_uid_set(&[]), "");
        assert_eq!(build_uid_set(&[1]), "1");
        assert_eq!(build_uid_set(&[1, 2, 3]), "1,2,3");
        assert_eq!(build_uid_set(&[999, 1000]), "999,1000");
    }

    #[test]
    fn test_build_flags_string_already_prefixed() {
        let result = build_flags_string(&["\\Seen", "\\Flagged"]);
        assert_eq!(result, "(\\Seen \\Flagged)");
    }

    #[test]
    fn test_build_flags_string_no_prefix() {
        let result = build_flags_string(&["Seen", "Flagged"]);
        assert_eq!(result, "(\\Seen \\Flagged)");
    }

    #[test]
    fn test_build_flags_string_empty() {
        let result = build_flags_string(&[]);
        assert_eq!(result, "()");
    }

    #[test]
    fn test_build_fetch_query_default() {
        let q = build_fetch_query(&[]);
        assert_eq!(q, "UID FLAGS INTERNALDATE RFC822.SIZE");
    }

    #[test]
    fn test_build_fetch_query_with_envelope() {
        let q = build_fetch_query(&["FLAGS", "INTERNALDATE", "ENVELOPE"]);
        assert!(q.contains("FLAGS"));
        assert!(q.contains("INTERNALDATE"));
        assert!(q.contains("BODY.PEEK[HEADER]"));
    }

    #[test]
    fn test_build_fetch_query_size_aliases() {
        let q1 = build_fetch_query(&["SIZE"]);
        let q2 = build_fetch_query(&["RFC822.SIZE"]);
        assert!(q1.contains("RFC822.SIZE"));
        assert!(q2.contains("RFC822.SIZE"));
    }

    #[test]
    fn test_batch_result_counts() {
        let items = vec![
            BatchItemResult {
                item_id: "1".into(),
                success: true,
                error: None,
            },
            BatchItemResult {
                item_id: "2".into(),
                success: false,
                error: Some("error".into()),
            },
            BatchItemResult {
                item_id: "3".into(),
                success: true,
                error: None,
            },
        ];
        let result = BatchResult {
            total: items.len(),
            succeeded: items.iter().filter(|i| i.success).count(),
            failed: items.iter().filter(|i| !i.success).count(),
            items,
        };
        assert_eq!(result.total, 3);
        assert_eq!(result.succeeded, 2);
        assert_eq!(result.failed, 1);
    }

    #[test]
    fn test_batch_metadata_serde() {
        let meta = BatchMetadata {
            uid: 42,
            flags: vec!["\\Seen".into()],
            internal_date: Some("2026-01-15T10:30:00+00:00".into()),
            size: Some(2048),
            envelope: None,
        };
        let json = serde_json::to_string(&meta).unwrap();
        let deserialized: BatchMetadata = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.uid, 42);
        assert_eq!(deserialized.flags, vec!["\\Seen"]);
        assert_eq!(deserialized.size, Some(2048));
    }
}