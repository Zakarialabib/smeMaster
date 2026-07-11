use async_imap::types::Flag;
use futures::StreamExt;
use mail_parser::MessageParser;

use crate::error::{SerializedError, ERR_CONNECTION_TIMEOUT, ERR_NETWORK};
use super::connect::*;
use super::fetch::parse_message;
use super::types::*;

pub(crate) fn filter_and_sort_uids(uids: impl IntoIterator<Item = u32>, last_uid: u32) -> Vec<u32> {
    let mut result: Vec<u32> = uids.into_iter().filter(|&u| u > last_uid).collect();
    result.sort();
    result
}

pub async fn fetch_new_uids(
    session: &mut ImapSession,
    folder: &str,
    last_uid: u32,
) -> Result<Vec<u32>, SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let query = format!("{}:*", last_uid + 1);
    let uids = tokio::time::timeout(IMAP_SEARCH_TIMEOUT, session.uid_search(&query))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("UID SEARCH timed out after {}s", IMAP_SEARCH_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID SEARCH failed: {e}")))?;

    Ok(filter_and_sort_uids(uids, last_uid))
}

pub async fn search_all_uids(
    session: &mut ImapSession,
    folder: &str,
) -> Result<Vec<u32>, SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let uids = tokio::time::timeout(IMAP_SEARCH_TIMEOUT, session.uid_search("ALL"))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("UID SEARCH ALL timed out after {}s", IMAP_SEARCH_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID SEARCH ALL failed: {e}")))?;

    let mut result: Vec<u32> = uids.into_iter().collect();
    result.sort();
    Ok(result)
}

pub async fn search_folder(
    session: &mut ImapSession,
    folder: &str,
    since_date: Option<String>,
) -> Result<ImapFolderSearchResult, SerializedError> {
    let mailbox = tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()))?
        .map_err(|e| format!("SELECT {folder} failed: {e}"))?;

    let folder_status = ImapFolderStatus {
        uidvalidity: mailbox.uid_validity.unwrap_or(0),
        uidnext: mailbox.uid_next.unwrap_or(0),
        exists: mailbox.exists,
        unseen: mailbox.unseen.unwrap_or(0),
        highest_modseq: mailbox.highest_modseq,
    };

    let search_query = match &since_date {
        Some(date) => format!("SINCE {date}"),
        None => "ALL".to_string(),
    };

    let uids_raw = tokio::time::timeout(IMAP_SEARCH_TIMEOUT, session.uid_search(&search_query))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("UID SEARCH {search_query} {folder} timed out after {}s", IMAP_SEARCH_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID SEARCH {search_query} {folder} failed: {e}")))?;

    let mut uids: Vec<u32> = uids_raw.into_iter().collect();
    uids.sort();

    log::info!(
        "IMAP search_folder {folder}: {} UIDs found (search={search_query}), uidvalidity={}",
        uids.len(), folder_status.uidvalidity,
    );

    Ok(ImapFolderSearchResult { uids, folder_status })
}

pub async fn sync_folder(
    session: &mut ImapSession,
    folder: &str,
    batch_size: u32,
    since_date: Option<String>,
) -> Result<ImapFolderSyncResult, SerializedError> {
    let mailbox = tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}")))?;

    let folder_status = ImapFolderStatus {
        uidvalidity: mailbox.uid_validity.unwrap_or(0),
        uidnext: mailbox.uid_next.unwrap_or(0),
        exists: mailbox.exists,
        unseen: mailbox.unseen.unwrap_or(0),
        highest_modseq: mailbox.highest_modseq,
    };

    let search_query = match &since_date {
        Some(date) => format!("SINCE {date}"),
        None => "ALL".to_string(),
    };

    let uids_raw = tokio::time::timeout(IMAP_SEARCH_TIMEOUT, session.uid_search(&search_query))
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("UID SEARCH {search_query} {folder} timed out after {}s", IMAP_SEARCH_TIMEOUT.as_secs())))?
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID SEARCH {search_query} {folder} failed: {e}")))?;

    let mut uids: Vec<u32> = uids_raw.into_iter().collect();
    uids.sort();

    log::info!(
        "IMAP sync_folder {folder}: {} UIDs found (search={search_query}), uidvalidity={}, batch_size={}",
        uids.len(), folder_status.uidvalidity, batch_size,
    );

    if uids.is_empty() {
        return Ok(ImapFolderSyncResult { uids, messages: vec![], folder_status });
    }

    let parser = MessageParser::default();
    let mut all_messages = Vec::new();
    let mut missing_body_uids: Vec<u32> = Vec::new();
    let bs = batch_size as usize;

    for chunk in uids.chunks(bs) {
        let uid_set: String = chunk.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");

        let fetches = tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
            let stream = session.uid_fetch(&uid_set, "UID FLAGS INTERNALDATE BODY.PEEK[]").await
                .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID FETCH {folder} uids={uid_set} failed: {e}")))?;
            Ok::<_, SerializedError>(stream.collect::<Vec<_>>().await)
        })
        .await
        .map_err(|_| SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("UID FETCH {folder} timed out after {}s", IMAP_FETCH_TIMEOUT.as_secs())))?;

        let raw_fetches: Vec<_> = fetches?;
        for r in raw_fetches {
            match r {
                Ok(f) => {
                    let uid = match f.uid { Some(u) => u, None => { log::warn!("IMAP sync_folder {folder}: response missing UID"); continue; } };
                    let raw = match f.body() {
                        Some(b) => b,
                        None => { missing_body_uids.push(uid); continue; }
                    };
                    let raw_size = raw.len() as u32;
                    let flags: Vec<_> = f.flags().collect();
                    let is_read = flags.iter().any(|fl| matches!(fl, Flag::Seen));
                    let is_starred = flags.iter().any(|fl| matches!(fl, Flag::Flagged));
                    let is_draft = flags.iter().any(|fl| matches!(fl, Flag::Draft));
                    let internal_date = f.internal_date().map(|dt| dt.timestamp());

                    match parse_message(&parser, raw, uid, folder, raw_size, is_read, is_starred, is_draft, internal_date) {
                        Ok(msg) => all_messages.push(msg),
                        Err(e) => log::warn!("sync_folder: failed to parse UID {uid}: {e}"),
                    }
                }
                Err(e) => log::warn!("IMAP sync_folder fetch stream error in {folder}: {e}"),
            }
        }
    }

    if !missing_body_uids.is_empty() {
        log::warn!(
            "IMAP sync_folder {folder}: {} messages had no body with BODY.PEEK[] — retrying with BODY[]",
            missing_body_uids.len(),
        );
        let retry_set: String = missing_body_uids.iter().map(|u| u.to_string()).collect::<Vec<_>>().join(",");
        let before = all_messages.len();
        match tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
            let stream = session.uid_fetch(&retry_set, "UID FLAGS INTERNALDATE BODY[]").await
                .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID FETCH (BODY[] fallback) {folder} uids={retry_set} failed: {e}")));
            Ok::<Vec<Result<async_imap::types::Fetch, async_imap::error::Error>>, SerializedError>(stream?.collect::<Vec<_>>().await)
        }).await {
            Ok(Ok(retry_fetches)) => {
                for r in retry_fetches {
                    if let Ok(f) = r {
                        let uid = match f.uid { Some(u) => u, None => continue };
                        if let Some(raw) = f.body() {
                            let raw_size = raw.len() as u32;
                            let flags: Vec<_> = f.flags().collect();
                            let is_read = flags.iter().any(|fl| matches!(fl, Flag::Seen));
                            let is_starred = flags.iter().any(|fl| matches!(fl, Flag::Flagged));
                            let is_draft = flags.iter().any(|fl| matches!(fl, Flag::Draft));
                            let internal_date = f.internal_date().map(|dt| dt.timestamp());
                            if let Ok(msg) = parse_message(&parser, raw, uid, folder, raw_size, is_read, is_starred, is_draft, internal_date) {
                                all_messages.push(msg);
                            }
                        }
                    }
                }
                let recovered = all_messages.len() - before;
                log::warn!("IMAP sync_folder {folder}: BODY[] fallback recovered {recovered}/{} messages", missing_body_uids.len());
            }
            Ok(Err(e)) => log::warn!("IMAP sync_folder {folder}: BODY[] fallback also failed: {e}"),
            Err(_) => log::warn!("IMAP sync_folder {folder}: BODY[] fallback timed out"),
        }
    }

    log::info!("IMAP sync_folder {folder}: fetched {} messages", all_messages.len());
    Ok(ImapFolderSyncResult { uids, messages: all_messages, folder_status })
}

/// Sync folder headers only (no body) — ideal for mobile thread lists.
/// Returns the same `ImapFolderSyncResult` struct, but message bodies will be empty.
pub async fn sync_folder_headers(
    session: &mut ImapSession,
    folder: &str,
    since_date: Option<String>,
) -> Result<ImapFolderSyncResult, SerializedError> {
    let mailbox = tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_CONNECTION_TIMEOUT,
                format!("SELECT {folder} timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
            )
        })?
        .map_err(|e| {
            SerializedError::new(ERR_NETWORK, format!("SELECT {folder} failed: {e}"))
        })?;

    let folder_status = ImapFolderStatus {
        uidvalidity: mailbox.uid_validity.unwrap_or(0),
        uidnext: mailbox.uid_next.unwrap_or(0),
        exists: mailbox.exists,
        unseen: mailbox.unseen.unwrap_or(0),
        highest_modseq: mailbox.highest_modseq,
    };

    let search_query = match &since_date {
        Some(date) => format!("SINCE {date}"),
        None => "ALL".to_string(),
    };

    let uids_raw = tokio::time::timeout(IMAP_SEARCH_TIMEOUT, session.uid_search(&search_query))
        .await
        .map_err(|_| {
            SerializedError::new(
                ERR_CONNECTION_TIMEOUT,
                format!(
                    "UID SEARCH {search_query} {folder} timed out after {}s",
                    IMAP_SEARCH_TIMEOUT.as_secs()
                ),
            )
        })?
        .map_err(|e| {
            SerializedError::new(
                ERR_NETWORK,
                format!("UID SEARCH {search_query} {folder} failed: {e}"),
            )
        })?;

    let mut uids: Vec<u32> = uids_raw.into_iter().collect();
    uids.sort();

    if uids.is_empty() {
        return Ok(ImapFolderSyncResult {
            uids,
            messages: vec![],
            folder_status,
        });
    }

    // Build a UID range string covering all UIDs (use chunks to avoid huge fetch)
    let batch_size = 500; // safe maximum per FETCH command
    let mut all_messages = Vec::with_capacity(uids.len());

    for chunk in uids.chunks(batch_size) {
        let uid_range = chunk
            .iter()
            .map(|u| u.to_string())
            .collect::<Vec<_>>()
            .join(",");

        // Reuse the improved header-only fetch from fetch.rs
        let result = super::fetch::fetch_message_headers(session, folder, &uid_range).await?;
        all_messages.extend(result.messages);
    }

    log::info!(
        "IMAP sync_folder_headers {folder}: fetched {} headers",
        all_messages.len()
    );

    Ok(ImapFolderSyncResult {
        uids,
        messages: all_messages,
        folder_status,
    })
}

pub async fn delta_check_folders(
    session: &mut ImapSession,
    folders: &[DeltaCheckRequest],
) -> Result<Vec<DeltaCheckResult>, SerializedError> {
    let mut results = Vec::with_capacity(folders.len());

    for req in folders {
        let mailbox = match tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(&req.folder)).await {
            Ok(Ok(m)) => m,
            Ok(Err(e)) => { log::warn!("delta_check: SELECT {} failed: {e}", req.folder); continue; }
            Err(_) => { log::warn!("delta_check: SELECT {} timed out", req.folder); continue; }
        };

        let current_uidvalidity = mailbox.uid_validity.unwrap_or(0);
        let uidvalidity_changed = req.uidvalidity != 0 && current_uidvalidity != req.uidvalidity;

        if uidvalidity_changed {
            results.push(DeltaCheckResult {
                folder: req.folder.clone(),
                uidvalidity: current_uidvalidity,
                new_uids: vec![],
                uidvalidity_changed: true,
            });
            continue;
        }

        let query = format!("{}:*", req.last_uid + 1);
        let new_uids = match tokio::time::timeout(IMAP_SEARCH_TIMEOUT, session.uid_search(&query)).await {
            Ok(Ok(uids)) => filter_and_sort_uids(uids, req.last_uid),
            Ok(Err(e)) => { log::warn!("delta_check: UID SEARCH {} failed: {e}", req.folder); vec![] }
            Err(_) => { log::warn!("delta_check: UID SEARCH {} timed out", req.folder); vec![] }
        };

        results.push(DeltaCheckResult {
            folder: req.folder.clone(),
            uidvalidity: current_uidvalidity,
            new_uids,
            uidvalidity_changed: false,
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_and_sort_all_above() {
        let result = filter_and_sort_uids(vec![5, 6, 7], 4);
        assert_eq!(result, vec![5, 6, 7]);
    }

    #[test]
    fn test_filter_and_sort_some_below() {
        let result = filter_and_sort_uids(vec![1, 5, 2, 6, 3], 4);
        assert_eq!(result, vec![5, 6]);
    }

    #[test]
    fn test_filter_and_sort_all_below() {
        let result = filter_and_sort_uids(vec![1, 2, 3], 5);
        assert!(result.is_empty());
    }

    #[test]
    fn test_filter_and_sort_empty() {
        let result = filter_and_sort_uids(vec![], 5);
        assert!(result.is_empty());
    }

    #[test]
    fn test_filter_and_sort_single_match() {
        let result = filter_and_sort_uids(vec![10], 5);
        assert_eq!(result, vec![10]);
    }

    #[test]
    fn test_filter_and_sort_already_sorted() {
        let result = filter_and_sort_uids(vec![1, 2, 3, 10, 11], 5);
        assert_eq!(result, vec![10, 11]);
    }

    #[test]
    fn test_filter_and_sort_unsorted() {
        let result = filter_and_sort_uids(vec![10, 1, 5, 3, 7, 2], 4);
        assert_eq!(result, vec![5, 7, 10]);
    }

    #[test]
    fn test_filter_and_sort_all_equal_should_filter() {
        let result = filter_and_sort_uids(vec![5, 5, 5], 5);
        assert!(result.is_empty());
    }

    #[test]
    fn test_filter_and_sort_zero_last_uid() {
        let result = filter_and_sort_uids(vec![0, 0, 0], 0);
        assert!(result.is_empty());
    }

    #[test]
    fn test_filter_and_sort_zero_with_positive() {
        let result = filter_and_sort_uids(vec![0, 1, 2], 0);
        assert_eq!(result, vec![1, 2]);
    }
}
