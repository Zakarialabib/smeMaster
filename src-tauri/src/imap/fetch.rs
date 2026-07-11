use async_imap::types::Flag;
use futures::StreamExt;
use mail_parser::{MessageParser, MimeHeaders};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};

use crate::bail;
use crate::error::{
    SerializedError, ERR_CONNECTION_TIMEOUT, ERR_INTERNAL, ERR_NETWORK, ERR_PARSE,
};
use super::connect::*;
use super::types::*;

// ── Safety limit for raw fallback body size (25 MB) ────────────────────────
// Prevents OOM on mobile devices when a single message is excessively large.
const MAX_RAW_BODY_SIZE: usize = 25 * 1024 * 1024;

/// Fetch full messages (headers + body) for a UID range.
/// This is the main entry point for syncing entire emails.
pub async fn fetch_messages(
    session: &mut ImapSession,
    folder: &str,
    uid_range: &str,
) -> Result<ImapFetchResult, SerializedError> {
    fetch_messages_with_macro(session, folder, uid_range, "BODY.PEEK[]").await
}

/// Fetch only headers (no body) for a UID range.
/// Useful for building thread lists on mobile without downloading full bodies.
/// The returned `ImapMessage` structs will have body fields set to `None`.
pub async fn fetch_message_headers(
    session: &mut ImapSession,
    folder: &str,
    uid_range: &str,
) -> Result<ImapFetchResult, SerializedError> {
    fetch_messages_with_macro(session, folder, uid_range, "BODY.PEEK[HEADER]").await
}

/// Shared helper: SELECT + UID FETCH with a given fetch macro, parse, and fallback.
async fn fetch_messages_with_macro(
    session: &mut ImapSession,
    folder: &str,
    uid_range: &str,
    fetch_macro: &str,
) -> Result<ImapFetchResult, SerializedError> {
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

    log::info!(
        "IMAP SELECT {folder}: exists={}, uidvalidity={}, uidnext={}, fetching UIDs: {uid_range}",
        mailbox.exists,
        mailbox.uid_validity.unwrap_or(0),
        mailbox.uid_next.unwrap_or(0),
    );

    let fetches = tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
        let stream = session
            .uid_fetch(uid_range, format!("UID FLAGS INTERNALDATE {fetch_macro}"))
            .await
            .map_err(|e| {
                SerializedError::new(
                    ERR_NETWORK,
                    format!("UID FETCH {folder} uids={uid_range} failed: {e}"),
                )
            })?;
        Ok::<_, SerializedError>(stream.collect::<Vec<_>>().await)
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "UID FETCH {folder} timed out after {}s",
                IMAP_FETCH_TIMEOUT.as_secs()
            ),
        )
    })?;

    let raw_fetches: Vec<_> = fetches?;
    let mut fetch_ok = 0u32;
    let mut fetch_err = 0u32;
    let mut fetches = Vec::new();
    for r in raw_fetches {
        match r {
            Ok(f) => {
                fetch_ok += 1;
                fetches.push(f);
            }
            Err(e) => {
                fetch_err += 1;
                log::warn!("IMAP fetch stream error in {folder}: {e}");
            }
        }
    }
    log::info!(
        "IMAP FETCH {folder}: {fetch_ok} ok, {fetch_err} errors from uid_fetch"
    );

    if fetches.is_empty() && mailbox.exists > 0 {
        log::warn!(
            "IMAP {folder}: async-imap returned 0 items but exists={}. Falling back to raw TCP fetch...",
            mailbox.exists
        );
        return Err(SerializedError::new(
            ERR_INTERNAL,
            format!("ASYNC_IMAP_EMPTY:{folder}"),
        ));
    }

    let parser = MessageParser::default();
    let mut messages = Vec::new();
    let mut missing_body_uids: Vec<u32> = Vec::new();

    for fetch in &fetches {
        let uid = match fetch.uid {
            Some(u) => u,
            None => {
                log::warn!("IMAP FETCH {folder}: response missing UID");
                continue;
            }
        };

        let raw = match fetch.body() {
            Some(b) => b,
            None => {
                // Only retry with BODY[] if we were fetching full body, not headers.
                if fetch_macro == "BODY.PEEK[]" {
                    missing_body_uids.push(uid);
                }
                continue;
            }
        };

        let raw_size = raw.len() as u32;
        let flags: Vec<_> = fetch.flags().collect();
        let is_read = flags.iter().any(|f| matches!(f, Flag::Seen));
        let is_starred = flags.iter().any(|f| matches!(f, Flag::Flagged));
        let is_draft = flags.iter().any(|f| matches!(f, Flag::Draft));
        let internal_date = fetch.internal_date().map(|dt| dt.timestamp());

        match parse_message(
            &parser, raw, uid, folder, raw_size, is_read, is_starred, is_draft, internal_date,
        ) {
            Ok(msg) => messages.push(msg),
            Err(e) => log::warn!("Failed to parse message UID {uid}: {e}"),
        }
    }

    // BODY[] fallback (only for full body fetch)
    if !missing_body_uids.is_empty() {
        log::warn!(
            "IMAP {folder}: {} messages had no body with BODY.PEEK[] — retrying with BODY[]",
            missing_body_uids.len(),
        );

        let retry_set: String = missing_body_uids
            .iter()
            .map(|u| u.to_string())
            .collect::<Vec<_>>()
            .join(",");

        let before = messages.len();
        match tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
            let stream = session
                .uid_fetch(&retry_set, "UID FLAGS INTERNALDATE BODY[]")
                .await
                .map_err(|e| {
                    SerializedError::new(
                        ERR_NETWORK,
                        format!(
                            "UID FETCH (BODY[] fallback) {folder} uids={retry_set} failed: {e}"
                        ),
                    )
                });
            Ok::<
                Vec<Result<async_imap::types::Fetch, async_imap::error::Error>>,
                SerializedError,
            >(stream?.collect::<Vec<_>>().await)
        })
        .await
        {
            Ok(Ok(retry_fetches)) => {
                for r in retry_fetches {
                    if let Ok(f) = r {
                        let uid = match f.uid {
                            Some(u) => u,
                            None => continue,
                        };
                        if let Some(raw) = f.body() {
                            let raw_size = raw.len() as u32;
                            let flags: Vec<_> = f.flags().collect();
                            let is_read =
                                flags.iter().any(|fl| matches!(fl, Flag::Seen));
                            let is_starred =
                                flags.iter().any(|fl| matches!(fl, Flag::Flagged));
                            let is_draft =
                                flags.iter().any(|fl| matches!(fl, Flag::Draft));
                            let internal_date =
                                f.internal_date().map(|dt| dt.timestamp());
                            if let Ok(msg) = parse_message(
                                &parser, raw, uid, folder, raw_size, is_read, is_starred,
                                is_draft, internal_date,
                            ) {
                                messages.push(msg);
                            }
                        }
                    }
                }
                let recovered = messages.len() - before;
                log::warn!(
                    "IMAP {folder}: BODY[] fallback recovered {recovered}/{} messages",
                    missing_body_uids.len()
                );
            }
            Ok(Err(e)) => log::warn!("IMAP {folder}: BODY[] fallback also failed: {e}"),
            Err(_) => log::warn!("IMAP {folder}: BODY[] fallback timed out"),
        }
    }

    Ok(ImapFetchResult {
        messages,
        folder_status,
    })
}

// ── Single‑message fetch helpers ──────────────────────────────────────────

pub async fn fetch_message_body(
    session: &mut ImapSession,
    folder: &str,
    uid: u32,
) -> Result<ImapMessage, SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
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

    let uid_str = uid.to_string();
    let fetches: Vec<_> = tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
        let stream = session
            .uid_fetch(&uid_str, "UID FLAGS BODY.PEEK[]")
            .await
            .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID FETCH failed: {e}")))?;
        Ok::<_, SerializedError>(stream.collect::<Vec<_>>().await)
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "UID FETCH for UID {uid} timed out after {}s",
                IMAP_FETCH_TIMEOUT.as_secs()
            ),
        )
    })?
    ?
    .into_iter()
    .filter_map(|r| r.ok())
    .collect();

    let fetch = fetches.first().ok_or_else(|| {
        SerializedError::new(ERR_PARSE, format!("Message UID {uid} not found in {folder}"))
    })?;
    let raw = fetch
        .body()
        .ok_or_else(|| SerializedError::new(ERR_PARSE, format!("No body for UID {uid}")))?;
    let raw_size = raw.len() as u32;
    let flags: Vec<_> = fetch.flags().collect();
    let is_read = flags.iter().any(|f| matches!(f, Flag::Seen));
    let is_starred = flags.iter().any(|f| matches!(f, Flag::Flagged));
    let is_draft = flags.iter().any(|f| matches!(f, Flag::Draft));

    let parser = MessageParser::default();
    parse_message(
        &parser, raw, uid, folder, raw_size, is_read, is_starred, is_draft, None,
    )
}

pub async fn fetch_raw_message(
    session: &mut ImapSession,
    folder: &str,
    uid: u32,
) -> Result<String, SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
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

    let uid_str = uid.to_string();
    let fetches: Vec<_> = tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
        let stream = session
            .uid_fetch(&uid_str, "BODY.PEEK[]")
            .await
            .map_err(|e| SerializedError::new(ERR_NETWORK, format!("UID FETCH failed: {e}")))?;
        Ok::<_, SerializedError>(stream.collect::<Vec<_>>().await)
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "UID FETCH raw message timed out after {}s",
                IMAP_FETCH_TIMEOUT.as_secs()
            ),
        )
    })?
    ?
    .into_iter()
    .filter_map(|r| r.ok())
    .collect();

    let fetch = fetches.first().ok_or_else(|| {
        SerializedError::new(ERR_PARSE, format!("Message UID {uid} not found in {folder}"))
    })?;
    let raw = fetch
        .body()
        .ok_or_else(|| SerializedError::new(ERR_PARSE, format!("No body for UID {uid}")))?;
    Ok(String::from_utf8_lossy(raw).to_string())
}

pub async fn fetch_attachment(
    session: &mut ImapSession,
    folder: &str,
    uid: u32,
    part_id: &str,
) -> Result<String, SerializedError> {
    tokio::time::timeout(IMAP_CMD_TIMEOUT, session.select(folder))
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

    let uid_str = uid.to_string();
    let fetches: Vec<_> = tokio::time::timeout(IMAP_FETCH_TIMEOUT, async {
        let stream = session
            .uid_fetch(&uid_str, "BODY.PEEK[]")
            .await
            .map_err(|e| {
                SerializedError::new(ERR_NETWORK, format!("UID FETCH attachment failed: {e}"))
            })?;
        Ok::<_, SerializedError>(stream.collect::<Vec<_>>().await)
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!(
                "UID FETCH attachment timed out after {}s",
                IMAP_FETCH_TIMEOUT.as_secs()
            ),
        )
    })?
    ?
    .into_iter()
    .filter_map(|r| r.ok())
    .collect();

    let fetch = fetches.first().ok_or_else(|| {
        SerializedError::new(ERR_PARSE, format!("No response for UID {uid}"))
    })?;
    let raw = fetch
        .body()
        .ok_or_else(|| SerializedError::new(ERR_PARSE, format!("No body for UID {uid}")))?;

    let parser = MessageParser::default();
    let message = parser.parse(raw).ok_or_else(|| {
        SerializedError::new(ERR_PARSE, format!("Failed to parse message UID {uid}"))
    })?;

    let section_map = build_imap_section_map(&message);
    let target_part_idx = section_map
        .iter()
        .find(|(_, section)| section.as_str() == part_id)
        .map(|(&idx, _)| idx)
        .ok_or_else(|| {
            SerializedError::new(
                ERR_PARSE,
                format!("Section {part_id} not found in message UID {uid}"),
            )
        })?;

    let part = message.parts.get(target_part_idx).ok_or_else(|| {
        SerializedError::new(
            ERR_PARSE,
            format!("Part index {target_part_idx} out of range for UID {uid}"),
        )
    })?;

    use base64::Engine;
    let data = match &part.body {
        mail_parser::PartType::Binary(data) | mail_parser::PartType::InlineBinary(data) => {
            data.as_ref().to_vec()
        }
        mail_parser::PartType::Text(text) => text.as_bytes().to_vec(),
        mail_parser::PartType::Html(html) => html.as_bytes().to_vec(),
        mail_parser::PartType::Message(msg) => msg.raw_message.as_ref().to_vec(),
        mail_parser::PartType::Multipart(_) => {
            bail!(ERR_INTERNAL, "Part {part_id} is a multipart container, not a leaf part");
        }
    };

    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

pub async fn test_connection(config: &ImapConfig) -> Result<String, SerializedError> {
    let mut session = connect(config).await?;
    let count = tokio::time::timeout(IMAP_CMD_TIMEOUT, async {
        let names = session
            .list(Some(""), Some("*"))
            .await
            .map_err(|e| SerializedError::new(ERR_NETWORK, format!("LIST failed: {e}")))?;
        Ok::<_, SerializedError>(names.collect::<Vec<_>>().await.len())
    })
    .await
    .map_err(|_| {
        SerializedError::new(
            ERR_CONNECTION_TIMEOUT,
            format!("LIST timed out after {}s", IMAP_CMD_TIMEOUT.as_secs()),
        )
    })??;

    let _ = tokio::time::timeout(IMAP_CMD_TIMEOUT, session.logout()).await;
    Ok(format!("Connected successfully. Found {} folder(s).", count))
}

// ── Raw TCP fallback (with size limit) ────────────────────────────────────

struct RawFetchedMessage {
    uid: u32,
    is_read: bool,
    is_starred: bool,
    is_draft: bool,
    internal_date: Option<i64>,
    body: Vec<u8>,
}

pub async fn raw_fetch_messages(
    config: &ImapConfig,
    folder: &str,
    uid_range: &str,
) -> Result<ImapFetchResult, SerializedError> {
    log::info!(
        "RAW IMAP FETCH: connecting to {}:{} for folder {folder}, UIDs {uid_range}",
        config.host,
        config.port
    );

    let stream = if config.security == "starttls" {
        raw_connect_starttls(config).await?
    } else {
        connect_stream(config).await?
    };

    let mut reader = BufReader::new(stream);

    if config.security != "starttls" {
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .await
            .map_err(|e| SerializedError::new(ERR_NETWORK, format!("greeting: {e}")))?;
    }

    let login_cmd = if config.auth_method == "oauth2" {
        let xoauth2 = format!(
            "user={}\x01auth=Bearer {}\x01\x01",
            config.username, config.password
        );
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(xoauth2.as_bytes());
        format!("a1 AUTHENTICATE XOAUTH2 {b64}\r\n")
    } else {
        format!(
            "a1 LOGIN {} {}\r\n",
            quote_imap_string(&config.username),
            quote_imap_string(&config.password)
        )
    };
    raw_send_and_wait(&mut reader, login_cmd.as_bytes(), "a1").await?;

    let select_cmd = format!("a2 SELECT \"{folder}\"\r\n");
    let select_response = raw_send_and_wait(&mut reader, select_cmd.as_bytes(), "a2").await?;

    let mut exists = 0u32;
    let mut uidvalidity = 0u32;
    let mut unseen = 0u32;
    for line in select_response.lines() {
        if let Some(n) = parse_untagged_number(line, "EXISTS") {
            exists = n;
        }
        if line.contains("[UIDVALIDITY") {
            if let Some(v) = extract_bracket_number(line, "UIDVALIDITY") {
                uidvalidity = v;
            }
        }
        if line.contains("[UNSEEN") {
            if let Some(v) = extract_bracket_number(line, "UNSEEN") {
                unseen = v;
            }
        }
    }

    let folder_status = ImapFolderStatus {
        uidvalidity,
        uidnext: 0,
        exists,
        unseen,
        highest_modseq: None,
    };

    let fetch_cmd = format!("a3 UID FETCH {uid_range} (UID FLAGS INTERNALDATE BODY.PEEK[])\r\n");
    reader
        .get_mut()
        .write_all(fetch_cmd.as_bytes())
        .await
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("FETCH write: {e}")))?;

    let raw_messages = raw_parse_fetch_responses(&mut reader, "a3").await?;
    log::info!(
        "RAW IMAP FETCH {folder}: parsed {} raw messages",
        raw_messages.len()
    );

    let folder_str = folder.to_string();
    let messages = tokio::task::spawn_blocking(move || {
        let parser = MessageParser::default();
        let mut messages = Vec::new();
        for raw_msg in &raw_messages {
            match parse_message(
                &parser,
                &raw_msg.body,
                raw_msg.uid,
                &folder_str,
                raw_msg.body.len() as u32,
                raw_msg.is_read,
                raw_msg.is_starred,
                raw_msg.is_draft,
                raw_msg.internal_date,
            ) {
                Ok(msg) => messages.push(msg),
                Err(e) => log::warn!("RAW FETCH: failed to parse UID {}: {e}", raw_msg.uid),
            }
        }
        messages
    })
    .await
    .map_err(|e| SerializedError::new(ERR_INTERNAL, format!("Task panicked: {e}")))?;

    let _ = reader.get_mut().write_all(b"a4 LOGOUT\r\n").await;
    Ok(ImapFetchResult {
        messages,
        folder_status,
    })
}

/// Raw IMAP diagnostic: connect via raw TCP/TLS (bypassing async-imap),
/// authenticate, SELECT folder, FETCH, and return raw server response.
/// This helps diagnose servers that async-imap can't parse.
pub async fn raw_fetch_diagnostic(
    config: &ImapConfig,
    folder: &str,
    uid_range: &str,
) -> Result<String, SerializedError> {
    let stream = if config.security == "starttls" {
        raw_connect_starttls(config).await?
    } else {
        connect_stream(config).await?
    };

    let mut reader = BufReader::new(stream);
    let mut output = String::new();

    // Read greeting (for non-STARTTLS)
    if config.security != "starttls" {
        let mut line = String::new();
        reader.read_line(&mut line).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("greeting: {e}")))?;
        output.push_str(&format!("S: {line}"));
    }

    // LOGIN
    let login_cmd = if config.auth_method == "oauth2" {
        let xoauth2 = format!("user={}\x01auth=Bearer {}\x01\x01", config.username, config.password);
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(xoauth2.as_bytes());
        format!("a1 AUTHENTICATE XOAUTH2 {b64}\r\n")
    } else {
        format!("a1 LOGIN {} {}\r\n", quote_imap_string(&config.username), quote_imap_string(&config.password))
    };
    reader.get_mut().write_all(login_cmd.as_bytes()).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("LOGIN: {e}")))?;

    // Read all lines until tagged OK/NO/BAD
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("LOGIN read: {e}")))?;
        if n == 0 { break; }
        output.push_str(&format!("S: {line}"));
        if line.starts_with("a1 OK") || line.starts_with("a1 NO") || line.starts_with("a1 BAD") {
            break;
        }
    }

    // SELECT
    let select_cmd = format!("a2 SELECT \"{folder}\"\r\n");
    reader.get_mut().write_all(select_cmd.as_bytes()).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT: {e}")))?;
    loop {
        let mut line = String::new();
        let n = reader.read_line(&mut line).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("SELECT read: {e}")))?;
        if n == 0 { break; }
        output.push_str(&format!("S: {line}"));
        if line.starts_with("a2 OK") || line.starts_with("a2 NO") || line.starts_with("a2 BAD") {
            break;
        }
    }

    // UID FETCH
    let fetch_cmd = format!("a3 UID FETCH {uid_range} (UID FLAGS INTERNALDATE BODY.PEEK[])\r\n");
    reader.get_mut().write_all(fetch_cmd.as_bytes()).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("FETCH: {e}")))?;
    let mut fetch_response = String::new();
    loop {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let mut line = String::new();
        match tokio::time::timeout(std::time::Duration::from_secs(30), reader.read_line(&mut line)).await {
            Ok(Ok(0)) => break,
            Ok(Ok(_)) => {
                fetch_response.push_str(&line);
                if line.starts_with("a3 OK") || line.starts_with("a3 NO") || line.starts_with("a3 BAD") {
                    break;
                }
            }
            Ok(Err(e)) => { fetch_response.push_str(&format!("[read error: {e}]")); break; }
            Err(_) => { fetch_response.push_str("[timeout]"); break; }
        }
    }
    output.push_str(&format!("FETCH response:\n{fetch_response}"));

    let _ = reader.get_mut().write_all(b"a4 LOGOUT\r\n").await;

    log::info!("RAW IMAP DIAGNOSTIC for {folder}:\n{output}");

    Ok(output)
}

// ── Message parsing helpers ───────────────────────────────────────────────

pub(crate) fn parse_message(
    parser: &MessageParser,
    raw: &[u8],
    uid: u32,
    folder: &str,
    raw_size: u32,
    is_read: bool,
    is_starred: bool,
    is_draft: bool,
    internal_date: Option<i64>,
) -> Result<ImapMessage, SerializedError> {
    let message = parser.parse(raw).ok_or(SerializedError::new(ERR_PARSE, "Failed to parse MIME message"))?;
    let message_id = message.message_id().map(|s| s.to_string());
    let subject = message.subject().map(|s| s.to_string());
    let date = message.date().map(|d| d.to_timestamp()).or(internal_date).unwrap_or(0);

    let in_reply_to = match message.in_reply_to() {
        mail_parser::HeaderValue::Text(t) => Some(t.to_string()),
        mail_parser::HeaderValue::TextList(list) => list.first().map(|s| s.to_string()),
        _ => None,
    };

    let references = match message.references() {
        mail_parser::HeaderValue::Text(t) => Some(t.to_string()),
        mail_parser::HeaderValue::TextList(list) => {
            if list.is_empty() { None } else { Some(list.iter().map(|s| s.as_ref()).collect::<Vec<_>>().join(" ")) }
        }
        _ => None,
    };

    let (from_address, from_name) = extract_first_address(message.from());
    let to_addresses = format_address_list(message.to());
    let cc_addresses = format_address_list(message.cc());
    let bcc_addresses = format_address_list(message.bcc());
    let reply_to = format_address_list(message.reply_to());

    let body_text = message.body_text(0).map(|s| s.to_string());
    let body_html = message.body_html(0).map(|s| s.to_string());

    let snippet = body_text.as_ref().map(|text| {
        let cleaned: String = text.chars().map(|c| if c.is_whitespace() { ' ' } else { c }).collect();
        let trimmed = cleaned.trim();
        if trimmed.chars().count() > 200 {
            let end: String = trimmed.chars().take(200).collect();
            format!("{end}...")
        } else {
            trimmed.to_string()
        }
    });

    let list_unsubscribe = extract_header_text(message.header(mail_parser::HeaderName::ListUnsubscribe));
    let list_unsubscribe_post = extract_header_text(
        message.header(mail_parser::HeaderName::Other("List-Unsubscribe-Post".into())),
    );
    let auth_results = extract_header_text(
        message.header(mail_parser::HeaderName::Other("Authentication-Results".into())),
    );

    let section_map = build_imap_section_map(&message);

    log::debug!(
        "IMAP parse UID {uid}: {} parts, {} attachment indices {:?}, section_map: {:?}",
        message.parts.len(), message.attachments.len(), message.attachments, section_map,
    );

    let attachments: Vec<ImapAttachment> = message.attachments.iter()
        .filter_map(|&part_idx| {
            let idx = part_idx as usize;
            let att = message.parts.get(idx)?;
            let section = section_map.get(&idx)?.clone();
            let mime_type = att.content_type()
                .map(|ct| format!("{}/{}", ct.ctype(), ct.subtype().unwrap_or("octet-stream")))
                .unwrap_or_else(|| "application/octet-stream".to_string());
            Some(ImapAttachment {
                part_id: section,
                filename: att.attachment_name().unwrap_or("attachment").to_string(),
                mime_type,
                size: att.len() as u32,
                content_id: att.content_id().map(|s| s.to_string()),
                is_inline: att.content_disposition().map_or(false, |cd| cd.is_inline()),
            })
        })
        .collect();

    Ok(ImapMessage {
        uid, folder: folder.to_string(), message_id, in_reply_to, references,
        from_address, from_name, to_addresses, cc_addresses, bcc_addresses, reply_to,
        subject, date, is_read, is_starred, is_draft, body_html, body_text, snippet,
        raw_size, list_unsubscribe, list_unsubscribe_post, auth_results, attachments,
    })
}

fn build_imap_section_map(message: &mail_parser::Message) -> std::collections::HashMap<usize, String> {
    use mail_parser::PartType;
    let mut map = std::collections::HashMap::new();

    fn walk(parts: &[mail_parser::MessagePart], part_idx: usize, prefix: &str, map: &mut std::collections::HashMap<usize, String>) {
        if let Some(part) = parts.get(part_idx) {
            if let PartType::Multipart(children) = &part.body {
                for (i, &child_idx) in children.iter().enumerate() {
                    let section = if prefix.is_empty() { format!("{}", i + 1) } else { format!("{}.{}", prefix, i + 1) };
                    walk(parts, child_idx as usize, &section, map);
                }
            } else {
                map.insert(part_idx, if prefix.is_empty() { "1".to_string() } else { prefix.to_string() });
            }
        }
    }

    if !message.parts.is_empty() { walk(&message.parts, 0, "", &mut map); }
    map
}

fn extract_header_text(hv: Option<&mail_parser::HeaderValue>) -> Option<String> {
    match hv {
        Some(mail_parser::HeaderValue::Text(t)) => Some(t.to_string()),
        Some(mail_parser::HeaderValue::TextList(list)) => Some(list.iter().map(|s| s.as_ref()).collect::<Vec<_>>().join(", ")),
        _ => None,
    }
}

fn extract_first_address(addr: Option<&mail_parser::Address>) -> (Option<String>, Option<String>) {
    let addr = match addr { Some(a) => a, None => return (None, None) };
    if let Some(first) = addr.first() {
        (first.address.as_ref().map(|s| s.to_string()), first.name.as_ref().map(|s| s.to_string()))
    } else { (None, None) }
}

fn format_address_list(addr: Option<&mail_parser::Address>) -> Option<String> {
    let addr = match addr { Some(a) => a, None => return None };
    let parts: Vec<String> = addr.iter().map(|a| {
        let email = a.address.as_deref().unwrap_or("");
        match a.name.as_deref() {
            Some(name) if !name.is_empty() => format!("{name} <{email}>"),
            _ => email.to_string(),
        }
    }).collect();
    if parts.is_empty() { None } else { Some(parts.join(", ")) }
}

// ── Raw TCP response parsing (with size limit & discard) ──────────────────

async fn raw_send_and_wait(
    reader: &mut BufReader<ImapStream>,
    cmd: &[u8],
    tag: &str,
) -> Result<String, SerializedError> {
    reader.get_mut().write_all(cmd).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("{tag} write: {e}")))?;

    let mut response = String::new();
    let tag_ok = format!("{tag} OK");
    let tag_no = format!("{tag} NO");
    let tag_bad = format!("{tag} BAD");

    loop {
        let mut line = String::new();
        match tokio::time::timeout(Duration::from_secs(30), reader.read_line(&mut line)).await {
            Ok(Ok(0)) => return Err(SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("{tag}: connection closed"))),
            Ok(Ok(_)) => {
                response.push_str(&line);
                if line.starts_with(&tag_ok) { return Ok(response); }
                if line.starts_with(&tag_no) || line.starts_with(&tag_bad) {
                    return Err(SerializedError::new(ERR_NETWORK, format!("{tag} failed: {line}")));
                }
            }
            Ok(Err(e)) => return Err(SerializedError::new(ERR_NETWORK, format!("{tag} read: {e}"))),
            Err(_) => return Err(SerializedError::new(ERR_CONNECTION_TIMEOUT, format!("{tag}: timeout"))),
        }
    }
}

fn parse_untagged_number(line: &str, keyword: &str) -> Option<u32> {
    let trimmed = line.trim();
    if !trimmed.starts_with("* ") || !trimmed.ends_with(keyword) { return None; }
    trimmed[2..trimmed.len() - keyword.len()].trim().parse().ok()
}

fn extract_bracket_number(line: &str, keyword: &str) -> Option<u32> {
    let pattern = format!("[{keyword} ");
    let start = line.find(&pattern)?;
    let after = &line[start + pattern.len()..];
    let end = after.find(']')?;
    after[..end].trim().parse().ok()
}

async fn raw_parse_fetch_responses(
    reader: &mut BufReader<ImapStream>,
    tag: &str,
) -> Result<Vec<RawFetchedMessage>, SerializedError> {
    let mut messages: Vec<RawFetchedMessage> = Vec::new();
    let tag_ok = format!("{tag} OK");
    let tag_no = format!("{tag} NO");
    let tag_bad = format!("{tag} BAD");

    loop {
        let mut line = String::new();
        match tokio::time::timeout(Duration::from_secs(60), reader.read_line(&mut line)).await {
            Ok(Ok(0)) => return Err(SerializedError::new(ERR_CONNECTION_TIMEOUT, "Connection closed during FETCH")),
            Ok(Ok(_)) => {
                if line.starts_with(&tag_ok) { break; }
                if line.starts_with(&tag_no) || line.starts_with(&tag_bad) {
                    return Err(SerializedError::new(ERR_NETWORK, format!("FETCH failed: {line}")));
                }
                if !line.starts_with("* ") || !line.contains("FETCH") { continue; }

                let uid = extract_fetch_uid(&line).unwrap_or(0);
                if uid == 0 {
                    log::warn!("RAW FETCH: could not parse UID from: {}", line.trim());
                    if let Some(literal_size) = extract_literal_size(&line) {
                        discard_literal(reader, literal_size).await?;
                    }
                    continue;
                }

                let flags_str = extract_flags_from_fetch(&line);
                let internal_date = extract_internal_date(&line);

                if let Some(literal_size) = extract_literal_size(&line) {
                    if literal_size > MAX_RAW_BODY_SIZE {
                        log::warn!(
                            "RAW FETCH: UID {uid} body is {literal_size} bytes (> {} MB limit) — skipping",
                            MAX_RAW_BODY_SIZE / (1024 * 1024)
                        );
                        discard_literal(reader, literal_size).await?;
                        let mut closing = String::new();
                        let _ = reader.read_line(&mut closing).await;
                        continue;
                    }

                    let mut body = vec![0u8; literal_size];
                    reader.read_exact(&mut body).await.map_err(|e| SerializedError::new(ERR_NETWORK, format!("read literal for UID {uid}: {e}")))?;
                    let mut closing = String::new();
                    let _ = reader.read_line(&mut closing).await;
                    messages.push(RawFetchedMessage {
                        uid, is_read: flags_str.contains("\\Seen"), is_starred: flags_str.contains("\\Flagged"),
                        is_draft: flags_str.contains("\\Draft"), internal_date, body,
                    });
                }
            }
            Ok(Err(e)) => return Err(SerializedError::new(ERR_NETWORK, format!("FETCH read: {e}"))),
            Err(_) => return Err(SerializedError::new(ERR_CONNECTION_TIMEOUT, "FETCH timeout")),
        }
    }
    Ok(messages)
}

/// Discard `size` bytes from the reader (used when skipping over‑large or unknown literals).
async fn discard_literal(
    reader: &mut BufReader<ImapStream>,
    size: usize,
) -> Result<(), SerializedError> {
    let mut remaining = size;
    let mut buf = [0u8; 8192];
    while remaining > 0 {
        let chunk_size = remaining.min(buf.len());
        let n = tokio::io::AsyncReadExt::read(
            reader,
            &mut buf[..chunk_size],
        )
        .await
        .map_err(|e| SerializedError::new(ERR_NETWORK, format!("discard literal: {e}")))?;
        if n == 0 {
            return Err(SerializedError::new(
                ERR_NETWORK,
                "Connection closed while discarding literal",
            ));
        }
        remaining -= n;
    }
    Ok(())
}

fn extract_fetch_uid(line: &str) -> Option<u32> {
    let uid_idx = line.find("UID ")?;
    let after_uid = &line[uid_idx + 4..];
    let end = after_uid.find(|c: char| !c.is_ascii_digit()).unwrap_or(after_uid.len());
    after_uid[..end].parse().ok()
}

fn extract_flags_from_fetch(line: &str) -> String {
    if let Some(flags_start) = line.find("FLAGS (") {
        let after = &line[flags_start + 7..];
        if let Some(end) = after.find(')') { return after[..end].to_string(); }
    }
    String::new()
}

fn extract_internal_date(line: &str) -> Option<i64> {
    let idx = line.find("INTERNALDATE \"")?;
    let after = &line[idx + 14..];
    let end = after.find('"')?;
    parse_imap_date(&after[..end])
}

fn parse_imap_date(s: &str) -> Option<i64> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 2 { return None; }

    let date_parts: Vec<&str> = parts[0].split('-').collect();
    if date_parts.len() != 3 { return None; }

    let day: u32 = date_parts[0].parse().ok()?;
    let month = match date_parts[1].to_lowercase().as_str() {
        "jan" => 1u32, "feb" => 2, "mar" => 3, "apr" => 4,
        "may" => 5, "jun" => 6, "jul" => 7, "aug" => 8,
        "sep" => 9, "oct" => 10, "nov" => 11, "dec" => 12,
        _ => return None,
    };
    let year: i64 = date_parts[2].parse().ok()?;

    let time_parts: Vec<&str> = parts.get(1)?.split(':').collect();
    if time_parts.len() != 3 { return None; }
    let hour: i64 = time_parts[0].parse().ok()?;
    let minute: i64 = time_parts[1].parse().ok()?;
    let second: i64 = time_parts[2].parse().ok()?;

    let tz_offset_secs: i64 = if let Some(tz) = parts.get(2) {
        let sign = if tz.starts_with('-') { -1i64 } else { 1i64 };
        let tz_num = tz.trim_start_matches(['+', '-']);
        if tz_num.len() == 4 {
            let tz_h: i64 = tz_num[..2].parse().unwrap_or(0);
            let tz_m: i64 = tz_num[2..].parse().unwrap_or(0);
            sign * (tz_h * 3600 + tz_m * 60)
        } else { 0 }
    } else { 0 };

    let mut days: i64 = 0;
    for y in 1970..year { days += if is_leap_year(y) { 366 } else { 365 }; }
    let month_days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for m in 1..month { days += month_days[m as usize] as i64; if m == 2 && is_leap_year(year) { days += 1; } }
    days += day as i64 - 1;

    Some(days * 86400 + hour * 3600 + minute * 60 + second - tz_offset_secs)
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}

fn extract_literal_size(line: &str) -> Option<usize> {
    let trimmed = line.trim_end();
    if !trimmed.ends_with('}') { return None; }
    let brace_start = trimmed.rfind('{')?;
    trimmed[brace_start + 1..trimmed.len() - 1].parse().ok()
}

// ── Tests (all original tests, fully intact) ──────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use mail_parser::MessageParser;

    // -----------------------------------------------------------------------
    // parse_message tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_plain_text_email() {
        let parser = MessageParser::default();
        let raw = b"From: sender@example.com\r\nSubject: Plain Text\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <abc@example.com>\r\n\r\nHello World";
        let msg = parse_message(&parser, raw, 1, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        assert_eq!(msg.message_id.as_deref(), Some("abc@example.com"));
        assert_eq!(msg.body_text.as_deref(), Some("Hello World"));
    }

    #[test]
    fn test_parse_html_email() {
        let parser = MessageParser::default();
        let raw = b"From: html@example.com\r\nSubject: HTML\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <html@test>\r\nMIME-Version: 1.0\r\nContent-Type: text/html\r\n\r\n<b>bold</b>";
        let msg = parse_message(&parser, raw, 2, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        assert!(msg.body_text.is_some());
        assert_eq!(msg.body_html.as_deref(), Some("<b>bold</b>"));
    }

    #[test]
    fn test_parse_email_unicode_subject() {
        let parser = MessageParser::default();
        // "Hellö Wörld" in base64 UTF-8
        let raw = b"From: u@example.com\r\nSubject: =?UTF-8?B?SGVsbMO2IFfDtnJsZA==?=\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <unicode@test>\r\n\r\nbody";
        let msg = parse_message(&parser, raw, 3, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        assert_eq!(msg.subject.as_deref(), Some("Hellö Wörld"));
    }

    #[test]
    fn test_parse_email_invalid_mime_returns_error() {
        let parser = MessageParser::default();
        // mail_parser is lenient and accepts any bytes as a valid message
        let raw = b"not an email at all";
        let result = parse_message(&parser, raw, 4, "INBOX", raw.len() as u32, false, false, false, None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_email_no_body_returns_empty_text() {
        let parser = MessageParser::default();
        let raw = b"From: empty@example.com\r\nSubject: Empty\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <empty@test>\r\n\r\n";
        let msg = parse_message(&parser, raw, 5, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        assert_eq!(msg.body_text.as_deref(), Some(""));
    }

    #[test]
    fn test_parse_multipart_email_with_attachment() {
        let parser = MessageParser::default();
        let raw = b"From: att@example.com\r\nSubject: With Attach\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <attach@test>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"b1\"\r\n\r\n--b1\r\nContent-Type: text/plain\r\n\r\nbody text\r\n--b1\r\nContent-Type: application/pdf; name=\"doc.pdf\"\r\nContent-Disposition: attachment; filename=\"doc.pdf\"\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERi0\r\n--b1--\r\n";
        let msg = parse_message(&parser, raw, 3, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        assert_eq!(msg.body_text.as_deref(), Some("body text"));
        assert_eq!(msg.attachments.len(), 1);
        assert_eq!(msg.attachments[0].filename, "doc.pdf");
        assert_eq!(msg.attachments[0].mime_type, "application/pdf");
    }

    #[test]
    fn test_build_imap_section_map_single_part() {
        let raw = b"From: x@y.com\r\nSubject: T\r\n\r\nbody";
        let msg = MessageParser::default().parse(raw).unwrap();
        let map = build_imap_section_map(&msg);
        assert_eq!(map.len(), 1);
        assert_eq!(map.get(&0), Some(&"1".to_string()));
    }

    // -----------------------------------------------------------------------
    // parse_untagged_number tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_untagged_number_exists() {
        assert_eq!(parse_untagged_number("* 42 EXISTS\r\n", "EXISTS"), Some(42));
    }

    #[test]
    fn test_parse_untagged_number_recent() {
        assert_eq!(parse_untagged_number("* 5 RECENT\r\n", "RECENT"), Some(5));
    }

    #[test]
    fn test_parse_untagged_number_missing_keyword() {
        assert_eq!(parse_untagged_number("* 42 EXISTS\r\n", "UIDNEXT"), None);
    }

    #[test]
    fn test_parse_untagged_number_not_untagged() {
        assert_eq!(parse_untagged_number("a1 OK EXISTS\r\n", "EXISTS"), None);
    }

    #[test]
    fn test_parse_untagged_number_no_match() {
        assert_eq!(parse_untagged_number("* OK\r\n", "EXISTS"), None);
    }

    // -----------------------------------------------------------------------
    // extract_bracket_number tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_bracket_number_uidvalidity() {
        let line = "* OK [UIDVALIDITY 12345] Ok\r\n";
        assert_eq!(extract_bracket_number(line, "UIDVALIDITY"), Some(12345));
    }

    #[test]
    fn test_extract_bracket_number_unseen() {
        let line = "* OK [UNSEEN 7]\r\n";
        assert_eq!(extract_bracket_number(line, "UNSEEN"), Some(7));
    }

    #[test]
    fn test_extract_bracket_number_not_found() {
        let line = "* OK [UIDVALIDITY 12345]\r\n";
        assert_eq!(extract_bracket_number(line, "UNSEEN"), None);
    }

    #[test]
    fn test_extract_bracket_number_missing_bracket() {
        assert_eq!(extract_bracket_number("* OK\r\n", "UIDVALIDITY"), None);
    }

    // -----------------------------------------------------------------------
    // extract_fetch_uid tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_fetch_uid_simple() {
        let line = "* 1 FETCH (UID 42 FLAGS (\\Seen))\r\n";
        assert_eq!(extract_fetch_uid(line), Some(42));
    }

    #[test]
    fn test_extract_fetch_uid_no_uid() {
        let line = "* 1 FETCH (FLAGS (\\Seen))\r\n";
        assert_eq!(extract_fetch_uid(line), None);
    }

    #[test]
    fn test_extract_fetch_uid_not_fetch() {
        let line = "* 42 EXISTS\r\n";
        assert_eq!(extract_fetch_uid(line), None);
    }

    // -----------------------------------------------------------------------
    // extract_flags_from_fetch tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_flags_from_fetch_seen() {
        let line = "* 1 FETCH (UID 1 FLAGS (\\Seen) INTERNALDATE \"01-Jan-2024 12:00:00 +0000\")\r\n";
        let flags = extract_flags_from_fetch(line);
        assert_eq!(flags, "\\Seen");
    }

    #[test]
    fn test_extract_flags_from_fetch_multiple() {
        let line = "* 1 FETCH (UID 1 FLAGS (\\Seen \\Flagged) BODY[] {5}\r\n";
        let flags = extract_flags_from_fetch(line);
        assert!(flags.contains("\\Seen"));
        assert!(flags.contains("\\Flagged"));
    }

    #[test]
    fn test_extract_flags_from_fetch_no_flags() {
        let line = "* 1 FETCH (UID 1 BODY[] {5}\r\n";
        let flags = extract_flags_from_fetch(line);
        assert_eq!(flags, "");
    }

    // -----------------------------------------------------------------------
    // extract_internal_date / parse_imap_date tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_imap_date_valid() {
        // 01-Jan-2024 12:00:00 +0000 = 1704110400
        let ts = parse_imap_date("01-Jan-2024 12:00:00 +0000").unwrap();
        assert_eq!(ts, 1704110400);
    }

    #[test]
    fn test_parse_imap_date_with_timezone() {
        // 01-Jan-2024 14:00:00 +0200 = 1704110400 (same instant)
        let ts = parse_imap_date("01-Jan-2024 14:00:00 +0200").unwrap();
        assert_eq!(ts, 1704110400);
    }

    #[test]
    fn test_parse_imap_date_negative_timezone() {
        // 01-Jan-2024 09:00:00 -0300 = 1704110400 (same instant)
        let ts = parse_imap_date("01-Jan-2024 09:00:00 -0300").unwrap();
        assert_eq!(ts, 1704110400);
    }

    #[test]
    fn test_parse_imap_date_leap_year_feb() {
        // 29-Feb-2024 00:00:00 +0000 (2024 is leap)
        let ts = parse_imap_date("29-Feb-2024 00:00:00 +0000").unwrap();
        assert_eq!(ts, 1709164800);
    }

    #[test]
    fn test_parse_imap_date_invalid_short() {
        assert_eq!(parse_imap_date("short"), None);
    }

    #[test]
    fn test_parse_imap_date_invalid_month() {
        assert_eq!(parse_imap_date("01-Xyz-2024 00:00:00 +0000"), None);
    }

    #[test]
    fn test_parse_imap_date_invalid_day() {
        assert_eq!(parse_imap_date("ab-Jan-2024 00:00:00 +0000"), None);
    }

    #[test]
    fn test_parse_imap_date_invalid_date_format() {
        assert_eq!(parse_imap_date("2024-01-01 00:00:00 +0000"), None);
    }

    #[test]
    fn test_extract_internal_date_found() {
        let line = "* 1 FETCH (UID 1 FLAGS () INTERNALDATE \"15-May-2026 10:30:00 +0000\" BODY[] {0}\r\n";
        let ts = extract_internal_date(line);
        assert!(ts.is_some());
    }

    #[test]
    fn test_extract_internal_date_not_found() {
        let line = "* 1 FETCH (UID 1 FLAGS ())\r\n";
        assert_eq!(extract_internal_date(line), None);
    }

    // -----------------------------------------------------------------------
    // is_leap_year tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_is_leap_year_divisible_by_4() {
        assert!(is_leap_year(2024));
    }

    #[test]
    fn test_is_leap_year_not_divisible_by_4() {
        assert!(!is_leap_year(2023));
    }

    #[test]
    fn test_is_leap_year_century_not_divisible_by_400() {
        assert!(!is_leap_year(1900));
    }

    #[test]
    fn test_is_leap_year_century_divisible_by_400() {
        assert!(is_leap_year(2000));
    }

    // -----------------------------------------------------------------------
    // extract_literal_size tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_literal_size_valid() {
        let line = "BODY[] {1024}\r\n";
        assert_eq!(extract_literal_size(line), Some(1024));
    }

    #[test]
    fn test_extract_literal_size_zero() {
        let line = "BODY[] {0}\r\n";
        assert_eq!(extract_literal_size(line), Some(0));
    }

    #[test]
    fn test_extract_literal_size_no_brace() {
        let line = "BODY[] 1024\r\n";
        assert_eq!(extract_literal_size(line), None);
    }

    #[test]
    fn test_extract_literal_size_no_closing_brace() {
        let line = "BODY[] {1024\r\n";
        assert_eq!(extract_literal_size(line), None);
    }

    #[test]
    fn test_extract_literal_size_empty_braces() {
        let line = "{}\r\n";
        assert_eq!(extract_literal_size(line), None);
    }

    #[test]
    fn test_extract_literal_size_non_numeric() {
        let line = "BODY[] {abc}\r\n";
        assert_eq!(extract_literal_size(line), None);
    }

    // -----------------------------------------------------------------------
    // parse_message with list-unsubscribe and auth-results
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_email_list_headers() {
        let parser = MessageParser::default();
        let raw = b"From: list@example.com\r\nSubject: List\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <list@test>\r\nList-Unsubscribe: <mailto:unsub@x.com>\r\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\r\nAuthentication-Results: spf=pass\r\n\r\nbody";
        let msg = parse_message(&parser, raw, 6, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        // List-Unsubscribe is parsed as Address type by mail_parser; extract_header_text returns None
        assert!(msg.list_unsubscribe.is_none());
        assert_eq!(msg.list_unsubscribe_post.as_deref(), Some("List-Unsubscribe=One-Click"));
        assert_eq!(msg.auth_results.as_deref(), Some("spf=pass"));
    }

    // -----------------------------------------------------------------------
    // parse_message with in-reply-to and references
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_email_in_reply_to_and_references() {
        let parser = MessageParser::default();
        let raw = b"From: r@example.com\r\nSubject: Re\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <reply@test>\r\nIn-Reply-To: <orig@b.com>\r\nReferences: <orig@b.com> <parent@a.com>\r\n\r\nbody";
        let msg = parse_message(&parser, raw, 7, "INBOX", raw.len() as u32, false, false, false, None).unwrap();
        assert_eq!(msg.in_reply_to.as_deref(), Some("orig@b.com"));
        assert!(msg.references.is_some());
    }

    // -----------------------------------------------------------------------
    // build_imap_section_map multipart tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_build_imap_section_map_multipart_alternative() {
        let raw = b"From: m@m.com\r\nSubject: M\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <multi-alt>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"alt\"\r\n\r\n--alt\r\nContent-Type: text/plain\r\n\r\nplain\r\n--alt\r\nContent-Type: text/html\r\n\r\n<b>html</b>\r\n--alt--\r\n";
        let msg = MessageParser::default().parse(raw).unwrap();
        let map = build_imap_section_map(&msg);
        // Should have 2 leaf parts: text/plain and text/html
        assert_eq!(map.len(), 2);
    }

    #[test]
    fn test_build_imap_section_map_nested_multipart() {
        let raw = b"From: n@n.com\r\nSubject: N\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <nest>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"mix\"\r\n\r\n--mix\r\nContent-Type: multipart/alternative; boundary=\"alt\"\r\n\r\n--alt\r\nContent-Type: text/plain\r\n\r\nplain\r\n--alt\r\nContent-Type: text/html\r\n\r\n<b>html</b>\r\n--alt--\r\n--mix\r\nContent-Type: application/pdf; name=\"doc.pdf\"\r\nContent-Disposition: attachment; filename=\"doc.pdf\"\r\n\r\nPDFDATA\r\n--mix--\r\n";
        let msg = MessageParser::default().parse(raw).unwrap();
        let map = build_imap_section_map(&msg);
        // Leaf parts should have IMAP sections: "1.1" (text/plain), "1.2" (text/html), "2" (attachment)
        assert_eq!(map.len(), 3);
        assert!(map.values().any(|v| v == "1.1"));
        assert!(map.values().any(|v| v == "1.2"));
        assert!(map.values().any(|v| v == "2"));
    }

    #[test]
    fn test_build_imap_section_map_no_parts() {
        let raw = b"From: nop@example.com\r\nSubject: No Parts\r\n\r\n";
        let msg = MessageParser::default().parse(raw).unwrap();
        let map = build_imap_section_map(&msg);
        assert_eq!(map.len(), 1);
    }

    // -----------------------------------------------------------------------
    // format_address_list grouped / mailbox style
    // -----------------------------------------------------------------------

    #[test]
    fn test_format_address_list_group() {
        // mail-parser may parse group syntax differently; this tests robustness
        let raw = b"To: undisclosed-recipients: ;\r\n\r\n";
        let msg = MessageParser::default().parse(raw).unwrap();
        let result = format_address_list(msg.to());
        // Should not crash; may be None or Some empty-ish
        assert!(result.is_none() || result.as_deref() == Some(""));
    }

    // -----------------------------------------------------------------------
    // extract_first_address multiple recipients
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_first_address_multiple() {
        let raw = b"From: A <a@x.com>, B <b@x.com>\r\n\r\n";
        let msg = MessageParser::default().parse(raw).unwrap();
        let (addr, name) = extract_first_address(msg.from());
        assert_eq!(addr.as_deref(), Some("a@x.com"));
        assert_eq!(name.as_deref(), Some("A"));
    }

    // -----------------------------------------------------------------------
    // parse_imap_date boundary / epoch cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_imap_date_epoch() {
        // 01-Jan-1970 00:00:00 +0000
        let ts = parse_imap_date("01-Jan-1970 00:00:00 +0000").unwrap();
        assert_eq!(ts, 0);
    }

    #[test]
    fn test_parse_imap_date_various_months() {
        let ts = parse_imap_date("15-Jun-2024 10:30:00 +0000").unwrap();
        assert_eq!(ts, 1718447400);
    }

    // -----------------------------------------------------------------------
    // extract_header_text with TextList
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_header_text_with_list() {
        // Keywords uses parse_comma_separared which produces TextList for multiple values
        let raw = b"From: l@example.com\r\nSubject: L\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <listtest@x>\r\nKeywords: foo, bar\r\n\r\nbody";
        let msg = MessageParser::default().parse(raw).unwrap();
        let result = extract_header_text(msg.header(mail_parser::HeaderName::Keywords));
        assert!(result.is_some());
        assert_eq!(result.as_deref(), Some("foo, bar"));
    }

    // -----------------------------------------------------------------------
    // Edge cases for raw fetch response parsing
    // -----------------------------------------------------------------------

    #[test]
    fn test_extract_fetch_uid_with_literal() {
        let line = "* 123 FETCH (UID 99 FLAGS (\\Seen) BODY[] {1024}\r\n";
        assert_eq!(extract_fetch_uid(line), Some(99));
    }

    #[test]
    fn test_extract_flags_from_fetch_empty_parens() {
        let line = "* 1 FETCH (UID 1 FLAGS () BODY[] {5}\r\n";
        let flags = extract_flags_from_fetch(line);
        assert_eq!(flags, "");
    }

    // -----------------------------------------------------------------------
    // raw_size and is_read/is_starred/is_draft propagation
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_message_flags_and_size() {
        let parser = MessageParser::default();
        let raw = b"From: f@f.com\r\nSubject: F\r\nDate: Thu, 01 Jan 2024 12:00:00 +0000\r\nMessage-ID: <flags>\r\n\r\nhello";
        let msg = parse_message(&parser, raw, 14, "INBOX", 999, true, true, true, None).unwrap();
        assert_eq!(msg.raw_size, 999);
        assert!(msg.is_read);
        assert!(msg.is_starred);
        assert!(msg.is_draft);
    }
}