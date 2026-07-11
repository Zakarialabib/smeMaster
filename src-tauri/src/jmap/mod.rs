// ── JMAP (JSON Meta Application Protocol) Driver ─────────────────────────
//
// Implements the ProtocolDriver trait for Yahoo / FastMail accounts using
// JMAP.  Uses OAuth 2.0 access tokens (stored in `oauth_tokens`) to
// authenticate, discovers the JMAP session via `/.well-known/jmap`, and
// issues JSON-RPC-style method calls to the session's API URL.
//
// References:
//   - RFC 8620 (JMAP Core)
//   - RFC 8621 (JMAP Mail)
//   - https://jmap.io/
//   - https://developer.yahoo.com/oauth2/guide/
//   - https://www.fastmail.help/hc/en-us/articles/360058752854-JMAP

use async_trait::async_trait;
use chrono;
use log;
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use sqlx::SqlitePool;

use crate::imap::driver::{DriverError, ProtocolDriver, SyncMessage, SyncOutput};

// ── JMAP Capability URIs ─────────────────────────────────────────────────

/// Core JMAP capability (RFC 8620).
const JMAP_CORE_CAPABILITY: &str = "urn:ietf:params:jmap:core";

/// Mail capability (RFC 8621).
const JMAP_MAIL_CAPABILITY: &str = "urn:ietf:params:jmap:mail";

// ── Session Resource (/.well-known/jmap) ─────────────────────────────────

/// The JMAP session object returned by `GET /.well-known/jmap`.
///
/// Tells the client which API URL to use and which accounts are available.
#[derive(Debug, Deserialize)]
struct JmapSession {
    #[serde(rename = "apiUrl")]
    api_url: String,
    #[serde(rename = "downloadUrl")]
    #[allow(dead_code)]
    download_url: Option<String>,
    #[serde(rename = "uploadUrl")]
    #[allow(dead_code)]
    upload_url: Option<String>,
    #[serde(rename = "eventSourceUrl")]
    #[allow(dead_code)]
    event_source_url: Option<String>,
    accounts: std::collections::HashMap<String, JmapAccount>,
    #[serde(rename = "primaryAccounts")]
    #[allow(dead_code)]
    primary_accounts: Option<std::collections::HashMap<String, String>>,
}

/// A single account within a JMAP session.
#[derive(Debug, Deserialize)]
struct JmapAccount {
    name: String,
    #[allow(dead_code)]
    is_personal: bool,
    #[allow(dead_code)]
    is_read_only: bool,
    #[serde(rename = "accountCapabilities")]
    #[allow(dead_code)]
    account_capabilities: serde_json::Value,
}

// ── JMAP Request / Response Envelopes ────────────────────────────────────

/// JMAP request envelope — a `using` array and a list of method calls.
#[derive(Debug, Serialize)]
struct JmapRequest {
    #[serde(rename = "using")]
    using: Vec<String>,
    #[serde(rename = "methodCalls")]
    method_calls: Vec<serde_json::Value>,
}

/// JMAP response envelope — a list of method responses and a session state.
#[derive(Debug, Deserialize)]
struct JmapResponse {
    #[serde(rename = "methodResponses")]
    method_responses: Vec<serde_json::Value>,
    #[serde(rename = "sessionState")]
    #[allow(dead_code)]
    session_state: String,
}

// ── Email Properties ─────────────────────────────────────────────────────

/// Email properties we request from JMAP Email/get.
const EMAIL_PROPERTIES: &[&str] = &[
    "id",
    "threadId",
    "subject",
    "from",
    "to",
    "receivedAt",
    "bodyValues",
    "htmlBody",
    "textBody",
    "isRead",
    "mailboxIds",
];

// ── JmapDriver ───────────────────────────────────────────────────────────

/// JMAP implementation of the [`ProtocolDriver`] trait.
///
/// Uses `reqwest` to talk to the JMAP API.  Requires a SQLite pool to look
/// up OAuth tokens and account metadata (email → domain → session discovery).
pub struct JmapDriver {
    pool: SqlitePool,
    client: reqwest::Client,
}

impl JmapDriver {
    /// Create a new `JmapDriver` bound to the given SQLite pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            client: reqwest::Client::builder()
                .user_agent("SMEMaster/1.0")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────

    /// Look up the OAuth 2.0 access token for this account from
    /// `oauth_tokens`.
    async fn get_access_token(&self, account_id: &str) -> Result<String, DriverError> {
        let row = sqlx::query_as::<_, (String,)>(
            "SELECT access_token FROM oauth_tokens WHERE account_id = ?1",
        )
        .bind(account_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            DriverError::new("DB_ERROR", format!("Token lookup failed: {e}"))
        })?
        .ok_or_else(|| DriverError::new("NO_TOKEN", "No OAuth token found for account"))?;

        Ok(row.0)
    }

    /// Look up the account's email address and extract the domain part.
    async fn get_email_domain(&self, account_id: &str) -> Result<String, DriverError> {
        let email: String = sqlx::query_scalar("SELECT email FROM accounts WHERE id = ?1")
            .bind(account_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| {
                DriverError::new("DB_ERROR", format!("Account lookup failed: {e}"))
            })?
            .ok_or_else(|| DriverError::new("NOT_FOUND", "Account not found"))?;

        let domain = email
            .split('@')
            .nth(1)
            .ok_or_else(|| DriverError::new("INVALID_EMAIL", "Email has no domain"))?;

        Ok(domain.to_string())
    }

    /// Discover the JMAP session by fetching `/.well-known/jmap` from the
    /// account's domain.
    async fn discover_session(
        &self,
        domain: &str,
        token: &str,
    ) -> Result<JmapSession, DriverError> {
        let url = format!("https://{domain}/.well-known/jmap");
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| {
                DriverError::new("DISCOVERY_FAILED", format!("Session discovery failed: {e}"))
            })?;

        if !resp.status().is_success() {
            return Err(DriverError::new(
                "DISCOVERY_FAILED",
                format!("Session discovery returned {}", resp.status()),
            ));
        }

        let session: JmapSession = resp.json().await.map_err(|e| {
            DriverError::new("PARSE_ERROR", format!("Failed to parse session: {e}"))
        })?;

        Ok(session)
    }

    /// Find the primary email account ID from a JMAP session.  Falls back
    /// to iterating all accounts if `primaryAccounts` is not provided.
    fn find_mail_account(&self, session: &JmapSession) -> Result<(String, String), DriverError> {
        // Try primaryAccounts for mail capability first
        if let Some(ref primary) = session.primary_accounts {
            if let Some(account_id) = primary.get(JMAP_MAIL_CAPABILITY) {
                if let Some(account) = session.accounts.get(account_id) {
                    return Ok((account_id.clone(), account.name.clone()));
                }
            }
        }

        // Fallback: find any account with mail capability
        for (id, account) in &session.accounts {
            if account
                .account_capabilities
                .as_object()
                .and_then(|caps| caps.get(JMAP_MAIL_CAPABILITY))
                .is_some()
            {
                return Ok((id.clone(), account.name.clone()));
            }
        }

        Err(DriverError::new(
            "NO_MAIL_ACCOUNT",
            "No mail account found in JMAP session",
        ))
    }

    /// Execute a single JMAP API call (POST to the session's `apiUrl`).
    async fn jmap_call(
        &self,
        api_url: &str,
        token: &str,
        using: Vec<&str>,
        methods: Vec<serde_json::Value>,
    ) -> Result<JmapResponse, DriverError> {
        let request = JmapRequest {
            using: using.into_iter().map(String::from).collect(),
            method_calls: methods,
        };

        let resp = self
            .client
            .post(api_url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| DriverError::new("API_ERROR", format!("JMAP call failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(DriverError::new(
                "API_ERROR",
                format!("JMAP API returned {}", resp.status()),
            ));
        }

        let jmap_resp: JmapResponse = resp.json().await.map_err(|e| {
            DriverError::new("PARSE_ERROR", format!("Failed to parse response: {e}"))
        })?;

        Ok(jmap_resp)
    }
}

#[async_trait]
impl ProtocolDriver for JmapDriver {
    /// Full sync — fetches mailbox list, queries email IDs, and retrieves
    /// full email data for the first page (up to 50 messages).
    async fn full_sync(&self, account_id: &str) -> Result<SyncOutput, DriverError> {
        let token = self.get_access_token(account_id).await?;
        let domain = self.get_email_domain(account_id).await?;
        let session = self.discover_session(&domain, &token).await?;
        let (jmap_account_id, _account_name) = self.find_mail_account(&session)?;

        log::info!(
            "[jmap-driver] full_sync for {account_id}: session at {}",
            session.api_url
        );

        // ── Step 1: Fetch mailbox list ───────────────────────────────
        let mailbox_method = serde_json::json!([
            "Mailbox/get",
            {
                "accountId": jmap_account_id,
                "properties": ["id", "name"]
            },
            "a0"
        ]);

        let resp = self
            .jmap_call(
                &session.api_url,
                &token,
                vec![JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
                vec![mailbox_method],
            )
            .await?;

        // Build a map of mailbox_id → mailbox_name
        let mut mailbox_names: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        for method_resp in &resp.method_responses {
            if let Some(name) = method_resp.get(0).and_then(|v| v.as_str()) {
                if name == "Mailbox/get" {
                    if let Some(data) = method_resp.get(1) {
                        if let Some(list) = data.get("list").and_then(|v| v.as_array()) {
                            for mb in list {
                                if let Some(id) = mb.get("id").and_then(|v| v.as_str()) {
                                    let name = mb
                                        .get("name")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or(id);
                                    mailbox_names.insert(id.to_string(), name.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        log::info!(
            "[jmap-driver] Discovered {} mailboxes",
            mailbox_names.len()
        );

        // ── Step 2: Query email IDs ──────────────────────────────────
        let email_query_method = serde_json::json!([
            "Email/query",
            {
                "accountId": jmap_account_id,
                "limit": 50
            },
            "a1"
        ]);

        let resp2 = self
            .jmap_call(
                &session.api_url,
                &token,
                vec![JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
                vec![email_query_method],
            )
            .await?;

        // Extract email IDs and queryState for checkpoint
        let mut email_ids: Vec<String> = Vec::new();
        let query_state: String = resp2
            .method_responses
            .first()
            .and_then(|r| r.get(1))
            .and_then(|d| d.get("queryState"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        for method_resp in &resp2.method_responses {
            if let Some(name) = method_resp.get(0).and_then(|v| v.as_str()) {
                if name == "Email/query" {
                    if let Some(data) = method_resp.get(1) {
                        if let Some(ids) = data.get("ids").and_then(|v| v.as_array()) {
                            for id_val in ids {
                                if let Some(id) = id_val.as_str() {
                                    email_ids.push(id.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        log::info!(
            "[jmap-driver] Query returned {} email IDs (state: {query_state})",
            email_ids.len()
        );

        // ── Step 3: Fetch full email data ────────────────────────────
        let mut all_messages = Vec::new();

        if !email_ids.is_empty() {
            let get_method = serde_json::json!([
                "Email/get",
                {
                    "accountId": jmap_account_id,
                    "ids": email_ids,
                    "properties": EMAIL_PROPERTIES
                },
                "a2"
            ]);

            let resp3 = self
                .jmap_call(
                    &session.api_url,
                    &token,
                    vec![JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
                    vec![get_method],
                )
                .await?;

            for method_resp in &resp3.method_responses {
                if let Some(name) = method_resp.get(0).and_then(|v| v.as_str()) {
                    if name == "Email/get" {
                        if let Some(data) = method_resp.get(1) {
                            if let Some(emails) = data.get("list").and_then(|v| v.as_array()) {
                                for email_val in emails {
                                    let email_id = email_val
                                        .get("id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();

                                    let date_str = email_val
                                        .get("receivedAt")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");

                                    let date_ts = chrono::DateTime::parse_from_rfc3339(date_str)
                                        .ok()
                                        .map(|dt| dt.timestamp())
                                        .unwrap_or(0);

                                    let subject = email_val
                                        .get("subject")
                                        .and_then(|v| v.as_str())
                                        .map(String::from);

                                    let from = email_val
                                        .get("from")
                                        .and_then(|v| v.as_array())
                                        .and_then(|arr| arr.first())
                                        .map(|f| {
                                            let name =
                                                f.get("name").and_then(|v| v.as_str());
                                            let email =
                                                f.get("email").and_then(|v| v.as_str());
                                            match (name, email) {
                                                (Some(n), Some(e)) => {
                                                    format!("{n} <{e}>")
                                                }
                                                (Some(n), None) => n.to_string(),
                                                (None, Some(e)) => e.to_string(),
                                                _ => String::new(),
                                            }
                                        });

                                    let to = email_val
                                        .get("to")
                                        .and_then(|v| v.as_array())
                                        .map(|arr| {
                                            arr.iter()
                                                .filter_map(|r| {
                                                    r.get("email")
                                                        .and_then(|v| v.as_str())
                                                })
                                                .collect::<Vec<_>>()
                                                .join(", ")
                                        });

                                    let is_read = email_val
                                        .get("isRead")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(false);

                                    // Extract body from bodyValues
                                    let body_values = email_val
                                        .get("bodyValues")
                                        .and_then(|v| v.as_object());

                                    let body_text = email_val
                                        .get("textBody")
                                        .and_then(|v| v.as_array())
                                        .and_then(|parts| parts.first())
                                        .and_then(|part| part.get("partId"))
                                        .and_then(|part_id| part_id.as_str())
                                        .and_then(|pid| {
                                            body_values.and_then(|bv| bv.get(pid))
                                        })
                                        .and_then(|v| v.get("value"))
                                        .and_then(|v| v.as_str())
                                        .map(String::from);

                                    let body_html = email_val
                                        .get("htmlBody")
                                        .and_then(|v| v.as_array())
                                        .and_then(|parts| parts.first())
                                        .and_then(|part| part.get("partId"))
                                        .and_then(|part_id| part_id.as_str())
                                        .and_then(|pid| {
                                            body_values.and_then(|bv| bv.get(pid))
                                        })
                                        .and_then(|v| v.get("value"))
                                        .and_then(|v| v.as_str())
                                        .map(String::from);

                                    // Resolve folder name from mailboxIds
                                    let mailbox_ids = email_val
                                        .get("mailboxIds")
                                        .and_then(|v| v.as_object())
                                        .map(|obj| {
                                            obj.keys().cloned().collect::<Vec<_>>()
                                        })
                                        .unwrap_or_default();

                                    let folder = mailbox_ids
                                        .first()
                                        .and_then(|id| mailbox_names.get(id))
                                        .cloned()
                                        .unwrap_or_else(|| "unknown".to_string());

                                    all_messages.push(SyncMessage {
                                        id: email_id,
                                        thread_id: email_val
                                            .get("threadId")
                                            .and_then(|v| v.as_str())
                                            .map(String::from),
                                        subject,
                                        from,
                                        to,
                                        date: date_ts,
                                        body_text,
                                        body_html,
                                        is_read,
                                        folder,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        let synced_count = all_messages.len() as u32;
        let checkpoint = format!(
            "jmap_full:{}:{}",
            query_state,
            chrono::Utc::now().timestamp()
        );

        log::info!(
            "[jmap-driver] full_sync for {account_id}: {synced_count} messages synced"
        );

        Ok(SyncOutput {
            messages: all_messages,
            new_checkpoint: checkpoint,
            synced_count,
        })
    }

    /// Delta sync — fetches only changed/new/removed emails since the
    /// last checkpoint using JMAP `Email/changes`.
    ///
    /// Checkpoint format: `jmap_full:{queryState}:{timestamp}` or
    /// `jmap_delta:{sinceState}:{timestamp}`.
    /// Extracts the queryState / sinceState and uses it as the
    /// `sinceQueryState` parameter of `Email/changes`.
    async fn delta_sync(
        &self,
        account_id: &str,
        checkpoint: &str,
    ) -> Result<SyncOutput, DriverError> {
        log::info!(
            "[jmap-driver] Delta sync requested from checkpoint: {checkpoint}"
        );

        // Parse the checkpoint to extract the queryState
        let since_state = checkpoint
            .split(':')
            .nth(1)
            .unwrap_or("")
            .to_string();

        if since_state.is_empty() || since_state == "unknown" {
            log::warn!(
                "[jmap-driver] Checkpoint has no valid queryState — falling back to full sync"
            );
            return self.full_sync(account_id).await;
        }

        let token = self.get_access_token(account_id).await?;
        let domain = self.get_email_domain(account_id).await?;
        let session = self.discover_session(&domain, &token).await?;
        let (jmap_account_id, _account_name) = self.find_mail_account(&session)?;

        log::info!(
            "[jmap-driver] delta_sync for {account_id}: sinceQueryState={since_state}"
        );

        // ── Step 1: Email/changes to get changed/removed ID sets ──
        let changes_method = serde_json::json!([
            "Email/changes",
            {
                "accountId": jmap_account_id,
                "sinceQueryState": since_state
            },
            "b0"
        ]);

        let resp = self
            .jmap_call(
                &session.api_url,
                &token,
                vec![JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
                vec![changes_method],
            )
            .await?;

        // Extract changed and removed IDs, plus new state
        let mut changed_ids: Vec<String> = Vec::new();
        let mut removed_ids: Vec<String> = Vec::new();
        let mut new_state: String = since_state.clone();

        for method_resp in &resp.method_responses {
            if let Some(name) = method_resp.get(0).and_then(|v| v.as_str()) {
                if name == "Email/changes" {
                    if let Some(data) = method_resp.get(1) {
                        if let Some(changed) = data.get("changed").and_then(|v| v.as_array()) {
                            for id_val in changed {
                                if let Some(id) = id_val.as_str() {
                                    changed_ids.push(id.to_string());
                                }
                            }
                        }
                        if let Some(removed) = data.get("removed").and_then(|v| v.as_array()) {
                            for id_val in removed {
                                if let Some(id) = id_val.as_str() {
                                    removed_ids.push(id.to_string());
                                }
                            }
                        }
                        new_state = data
                            .get("newState")
                            .and_then(|v| v.as_str())
                            .unwrap_or(&since_state)
                            .to_string();
                    }
                }
            }
        }

        // If there are no changes, return empty result with updated checkpoint
        if changed_ids.is_empty() && removed_ids.is_empty() {
            log::info!(
                "[jmap-driver] delta_sync for {account_id}: no changes since checkpoint"
            );
            let checkpoint = format!(
                "jmap_delta:{}:{}",
                new_state,
                chrono::Utc::now().timestamp()
            );
            return Ok(SyncOutput {
                messages: Vec::new(),
                new_checkpoint: checkpoint,
                synced_count: 0,
            });
        }

        log::info!(
            "[jmap-driver] delta_sync: {} changed, {} removed",
            changed_ids.len(),
            removed_ids.len(),
        );

        // ── Step 2: Fetch full data for changed emails via Email/get ──
        let mut all_messages = Vec::new();

        if !changed_ids.is_empty() {
            // Fetch mailbox names first so we can resolve folder names
            let mailbox_method = serde_json::json!([
                "Mailbox/get",
                {
                    "accountId": jmap_account_id,
                    "properties": ["id", "name"]
                },
                "b1"
            ]);

            let mb_resp = self
                .jmap_call(
                    &session.api_url,
                    &token,
                    vec![JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
                    vec![mailbox_method],
                )
                .await?;

            let mut mailbox_names: std::collections::HashMap<String, String> =
                std::collections::HashMap::new();
            for method_resp in &mb_resp.method_responses {
                if let Some(name) = method_resp.get(0).and_then(|v| v.as_str()) {
                    if name == "Mailbox/get" {
                        if let Some(data) = method_resp.get(1) {
                            if let Some(list) = data.get("list").and_then(|v| v.as_array()) {
                                for mb in list {
                                    if let Some(id) = mb.get("id").and_then(|v| v.as_str()) {
                                        let name = mb
                                            .get("name")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or(id);
                                        mailbox_names.insert(id.to_string(), name.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Fetch the changed emails
            let get_method = serde_json::json!([
                "Email/get",
                {
                    "accountId": jmap_account_id,
                    "ids": changed_ids,
                    "properties": EMAIL_PROPERTIES
                },
                "b2"
            ]);

            let resp3 = self
                .jmap_call(
                    &session.api_url,
                    &token,
                    vec![JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
                    vec![get_method],
                )
                .await?;

            // Parse email data (same logic as full_sync)
            for method_resp in &resp3.method_responses {
                if let Some(name) = method_resp.get(0).and_then(|v| v.as_str()) {
                    if name == "Email/get" {
                        if let Some(data) = method_resp.get(1) {
                            if let Some(emails) = data.get("list").and_then(|v| v.as_array()) {
                                for email_val in emails {
                                    let email_id = email_val
                                        .get("id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();

                                    let date_str = email_val
                                        .get("receivedAt")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("");

                                    let date_ts = chrono::DateTime::parse_from_rfc3339(date_str)
                                        .ok()
                                        .map(|dt| dt.timestamp())
                                        .unwrap_or(0);

                                    let subject = email_val
                                        .get("subject")
                                        .and_then(|v| v.as_str())
                                        .map(String::from);

                                    let from = email_val
                                        .get("from")
                                        .and_then(|v| v.as_array())
                                        .and_then(|arr| arr.first())
                                        .map(|f| {
                                            let name =
                                                f.get("name").and_then(|v| v.as_str());
                                            let email =
                                                f.get("email").and_then(|v| v.as_str());
                                            match (name, email) {
                                                (Some(n), Some(e)) => format!("{n} <{e}>"),
                                                (Some(n), None) => n.to_string(),
                                                (None, Some(e)) => e.to_string(),
                                                _ => String::new(),
                                            }
                                        });

                                    let to = email_val
                                        .get("to")
                                        .and_then(|v| v.as_array())
                                        .map(|arr| {
                                            arr.iter()
                                                .filter_map(|r| {
                                                    r.get("email")
                                                        .and_then(|v| v.as_str())
                                                })
                                                .collect::<Vec<_>>()
                                                .join(", ")
                                        });

                                    let is_read = email_val
                                        .get("isRead")
                                        .and_then(|v| v.as_bool())
                                        .unwrap_or(false);

                                    let body_values = email_val
                                        .get("bodyValues")
                                        .and_then(|v| v.as_object());

                                    let body_text = email_val
                                        .get("textBody")
                                        .and_then(|v| v.as_array())
                                        .and_then(|parts| parts.first())
                                        .and_then(|part| part.get("partId"))
                                        .and_then(|part_id| part_id.as_str())
                                        .and_then(|pid| {
                                            body_values.and_then(|bv| bv.get(pid))
                                        })
                                        .and_then(|v| v.get("value"))
                                        .and_then(|v| v.as_str())
                                        .map(String::from);

                                    let body_html = email_val
                                        .get("htmlBody")
                                        .and_then(|v| v.as_array())
                                        .and_then(|parts| parts.first())
                                        .and_then(|part| part.get("partId"))
                                        .and_then(|part_id| part_id.as_str())
                                        .and_then(|pid| {
                                            body_values.and_then(|bv| bv.get(pid))
                                        })
                                        .and_then(|v| v.get("value"))
                                        .and_then(|v| v.as_str())
                                        .map(String::from);

                                    let mailbox_ids = email_val
                                        .get("mailboxIds")
                                        .and_then(|v| v.as_object())
                                        .map(|obj| {
                                            obj.keys().cloned().collect::<Vec<_>>()
                                        })
                                        .unwrap_or_default();

                                    let folder = mailbox_ids
                                        .first()
                                        .and_then(|id| mailbox_names.get(id))
                                        .cloned()
                                        .unwrap_or_else(|| "unknown".to_string());

                                    all_messages.push(SyncMessage {
                                        id: email_id,
                                        thread_id: email_val
                                            .get("threadId")
                                            .and_then(|v| v.as_str())
                                            .map(String::from),
                                        subject,
                                        from,
                                        to,
                                        date: date_ts,
                                        body_text,
                                        body_html,
                                        is_read,
                                        folder,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        let synced_count = all_messages.len() as u32;
        let checkpoint = format!(
            "jmap_delta:{}:{}",
            new_state,
            chrono::Utc::now().timestamp()
        );

        log::info!(
            "[jmap-driver] delta_sync for {account_id}: {synced_count} messages synced"
        );

        Ok(SyncOutput {
            messages: all_messages,
            new_checkpoint: checkpoint,
            synced_count,
        })
    }

    /// Send — not yet implemented for JMAP.
    ///
    /// JMAP `Email/set` can create/send emails, but the raw RFC 2822
    /// format needs to be converted to JMAP Email representations.
    /// For now this falls back to IMAP/SMTP.
    async fn send(
        &self,
        _account_id: &str,
        _raw_message: &str,
        _thread_id: Option<&str>,
    ) -> Result<String, DriverError> {
        Err(DriverError::new(
            "NOT_IMPLEMENTED",
            "JMAP send not yet implemented. Use IMAP/SMTP for sending.",
        ))
    }

    /// Test connection — not available at the trait level without an
    /// account_id.  Use `test_protocol_connection` Tauri command instead.
    async fn test_connection(&self) -> Result<(), DriverError> {
        Err(DriverError::new(
            "NOT_IMPLEMENTED",
            "Use test_protocol_connection Tauri command instead",
        ))
    }

    fn provider_type(&self) -> &'static str {
        "jmap"
    }
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_provider_type() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let driver = JmapDriver::new(pool);
        assert_eq!(driver.provider_type(), "jmap");
    }

    #[tokio::test]
    async fn test_get_access_token_no_account() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let driver = JmapDriver::new(pool);
        let result = driver.get_access_token("nonexistent").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_email_domain() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

        // Create a minimal accounts table for the query
        sqlx::query(
            "CREATE TABLE accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query("INSERT INTO accounts (id, email) VALUES ('a1', 'user@yahoo.com')")
            .execute(&pool)
            .await
            .unwrap();

        let driver = JmapDriver::new(pool);
        let domain = driver.get_email_domain("a1").await.unwrap();
        assert_eq!(domain, "yahoo.com");
    }

    #[tokio::test]
    async fn test_get_email_domain_no_account() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let driver = JmapDriver::new(pool);
        let result = driver.get_email_domain("nonexistent").await;
        assert!(result.is_err());
    }

    #[test]
    fn test_jmap_request_serialization() {
        let req = JmapRequest {
            using: vec!["urn:ietf:params:jmap:core".into()],
            method_calls: vec![serde_json::json!([
                "Mailbox/get",
                { "accountId": "a1", "properties": ["id", "name"] },
                "a0"
            ])],
        };
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("Mailbox/get"));
        assert!(json.contains("a0"));
    }

    #[test]
    fn test_jmap_response_deserialization() {
        let data = r#"{
            "methodResponses": [
                ["Mailbox/get", {"list": [{"id": "m1", "name": "INBOX"}], "state": "s1"}, "a0"]
            ],
            "sessionState": "ss1"
        }"#;
        let resp: JmapResponse = serde_json::from_str(data).unwrap();
        assert_eq!(resp.method_responses.len(), 1);
        assert_eq!(resp.session_state, "ss1");
    }

    #[test]
    fn test_jmap_session_deserialization() {
        let data = r#"{
            "apiUrl": "https://jmap.example.com/api/",
            "downloadUrl": "https://jmap.example.com/download/{accountId}/{blobId}",
            "accounts": {
                "a1": {
                    "name": "user@example.com",
                    "isPersonal": true,
                    "isReadOnly": false,
                    "accountCapabilities": {}
                }
            },
            "primaryAccounts": {
                "urn:ietf:params:jmap:mail": "a1"
            }
        }"#;
        let session: JmapSession = serde_json::from_str(data).unwrap();
        assert_eq!(session.api_url, "https://jmap.example.com/api/");
        assert!(session.accounts.contains_key("a1"));
    }

    #[test]
    fn test_jmap_session_no_primary_accounts() {
        // Ensure find_mail_account works even without primaryAccounts
        let data = r#"{
            "apiUrl": "https://jmap.example.com/api/",
            "accounts": {
                "a1": {
                    "name": "user@example.com",
                    "isPersonal": true,
                    "isReadOnly": false,
                    "accountCapabilities": {
                        "urn:ietf:params:jmap:mail": {}
                    }
                }
            },
            "primaryAccounts": null
        }"#;
        let session: JmapSession = serde_json::from_str(data).unwrap();
        assert_eq!(session.api_url, "https://jmap.example.com/api/");

        let driver = JmapDriver::new(SqlitePool::connect_lazy("sqlite::memory:").unwrap());
        let result = driver.find_mail_account(&session).unwrap();
        assert_eq!(result.0, "a1");
    }

    #[test]
    fn test_jmap_session_no_mail_account() {
        // Session exists but has no mail capability
        let data = r#"{
            "apiUrl": "https://jmap.example.com/api/",
            "accounts": {
                "a1": {
                    "name": "user@example.com",
                    "isPersonal": true,
                    "isReadOnly": false,
                    "accountCapabilities": {}
                }
            },
            "primaryAccounts": {}
        }"#;
        let session: JmapSession = serde_json::from_str(data).unwrap();

        let driver = JmapDriver::new(SqlitePool::connect_lazy("sqlite::memory:").unwrap());
        let result = driver.find_mail_account(&session);
        assert!(result.is_err());
    }
}
