use futures::StreamExt;

use crate::error::{SerializedError, ERR_CONNECTION_TIMEOUT, ERR_NETWORK};
use super::connect::*;

// ── Single‑message flag operations (used when only one message changes) ────

pub async fn set_flags(
    session: &mut ImapSession,
    folder: &str,
    uid_set: &str,
    flag_op: &str,
    flags: &str,
) -> Result<(), SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_CONNECTION_TIMEOUT,
                format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
            )
        })?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let query = format!("{flag_op} {flags}");
    tokio::time::timeout(IMAP_CMD_TIMEOUT, async {
        let stream = session
            .uid_store(uid_set, &query)
            .await
            .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID STORE failed: {e}")))?;
        let _: Vec<_> = stream.collect().await;
        Ok::<_, SerializedError>(())
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!("UID STORE timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
        )
    })?
}

/// Convenience: mark a single message read/unread.
pub async fn mark_read(
    session: &mut ImapSession,
    folder: &str,
    uid: u32,
    read: bool,
) -> Result<(), SerializedError> {
    let uid_set = uid.to_string();
    let flag_op = if read { "+FLAGS" } else { "-FLAGS" };
    set_flags(session, folder, &uid_set, flag_op, "(\\Seen)").await
}

pub async fn move_messages(
    session: &mut ImapSession,
    source_folder: &str,
    uid_set: &str,
    dest_folder: &str,
) -> Result<(), SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(source_folder))
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_CONNECTION_TIMEOUT,
                format!("SELECT {source_folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
            )
        })?
        .map_err(|e| {
            SerializedError::new(ERR_NETWORK, format!("SELECT {source_folder} failed: {e}"))
        })?;

    // Try UID MOVE first
    match tokio::time::timeout(IMAP_CMD_TIMEOUT, session.uid_mv(uid_set, dest_folder)).await {
        Ok(Ok(())) => return Ok(()),
        _ => {
            // Fallback: COPY + STORE +Deleted + precise UID EXPUNGE
            tokio::time::timeout(IMAP_CMD_TIMEOUT, session.uid_copy(uid_set, dest_folder))
                .await
                .map_err(|_| {
                    SerializedError::new(
                        ERR_CONNECTION_TIMEOUT,
                        format!("UID COPY timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
                    )
                })?
                .map_err(|e| {
                    SerializedError::new(ERR_NETWORK, format!("UID COPY failed: {e}"))
                })?;

            tokio::time::timeout(IMAP_CMD_TIMEOUT, async {
                let stream = session
                    .uid_store(uid_set, "+FLAGS (\\Deleted)")
                    .await
                    .map_err(|e| {
                        SerializedError::new(
                            ERR_NETWORK,
                            format!("UID STORE +Deleted failed: {e}"),
                        )
                    })?;
                let _: Vec<_> = stream.collect().await;
                Ok::<_, SerializedError>(())
            })
            .await
            .map_err(|_| {
                SerializedError::new(
                    ERR_CONNECTION_TIMEOUT,
                    format!(
                        "UID STORE +Deleted timed out after {}s",
                        IMAP_CMD_TIMEOUT.as_secs()
                    ),
                )
            })??;

            // Prefer UID EXPUNGE, fall back to full EXPUNGE
            expunge_uids(session, uid_set).await;
        }
    }

    Ok(())
}

pub async fn delete_messages(
    session: &mut ImapSession,
    folder: &str,
    uid_set: &str,
) -> Result<(), SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_CONNECTION_TIMEOUT,
                format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
            )
        })?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    tokio::time::timeout(IMAP_CMD_TIMEOUT, async {
        let stream = session
            .uid_store(uid_set, "+FLAGS (\\Deleted)")
            .await
            .map_err(|e| {
                SerializedError::new(
                    ERR_NETWORK,
                    format!("UID STORE +Deleted failed: {e}"),
                )
            })?;
        let _: Vec<_> = stream.collect().await;
        Ok::<_, SerializedError>(())
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "UID STORE +Deleted timed out after {}s",
                IMAP_CMD_TIMEOUT.as_secs()
            ),
        )
    })??;

    // Prefer UID EXPUNGE, fall back to full EXPUNGE
    expunge_uids(session, uid_set).await;

    Ok(())
}

pub async fn append_message(
    session: &mut ImapSession,
    folder: &str,
    flags: Option<&str>,
    raw_message: &[u8],
) -> Result<(), SerializedError> {
    tokio::time::timeout(IMAP_FETCH_TIMEOUT, session.append(folder, flags, None, raw_message))
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_CONNECTION_TIMEOUT,
                format!("APPEND timed out after {}s", IMAP_FETCH_TIMEOUT.as_secs()),
            )
        })?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("APPEND failed: {e}")))
}

// ── Internal helper: UID EXPUNGE with fallback to full EXPUNGE ─────────────

async fn expunge_uids(session: &mut ImapSession, uid_set: &str) {
    // Try UID EXPUNGE first (RFC 4315) – removes only the given UIDs
    let uid_expunge_ok = tokio::time::timeout(
        IMAP_CMD_TIMEOUT,
        async {
            match session.uid_expunge(uid_set).await {
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

// ── Unit tests (only for pure helper functions) ────────────────────────────

#[cfg(test)]
mod tests {
    fn build_uid_set(uids: &[u32]) -> String {
        uids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",")
    }

    #[test]
    fn test_build_uid_set_empty() {
        assert_eq!(build_uid_set(&[]), "");
    }

    #[test]
    fn test_build_uid_set_single() {
        assert_eq!(build_uid_set(&[42]), "42");
    }

    #[test]
    fn test_build_uid_set_multiple() {
        assert_eq!(build_uid_set(&[1, 2, 3]), "1,2,3");
    }

    #[test]
    fn test_build_uid_set_large_numbers() {
        assert_eq!(build_uid_set(&[999999, 1000000]), "999999,1000000");
    }
}