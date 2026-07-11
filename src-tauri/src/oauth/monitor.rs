use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::RwLock;

/// Information about a single OAuth token that the monitor tracks.
#[derive(Debug, Clone)]
pub struct OAuthTokenInfo {
    pub account_id: String,
    pub refresh_token: String,
    pub expires_at: i64,
    pub provider: String,
    pub client_id: String,
    pub client_secret: Option<String>,
}

/// Proactive OAuth token expiry monitor.
///
/// Periodically reads OAuth tokens from the SQLite database and refreshes
/// any token that is expiring within the next 10 minutes. Runs on a 5-minute
/// interval loop spawned during app setup.
///
/// Thread-safe: uses `Arc<RwLock<HashMap>>` so the map can be read by other
/// parts of the app (e.g. a future status command) while the monitor holds
/// a write lock during reloads.
#[derive(Clone)]
pub struct OAuthTokenMonitor {
    /// In-memory cache of tracked tokens keyed by `account_id`.
    tokens: Arc<RwLock<HashMap<String, OAuthTokenInfo>>>,
}

impl OAuthTokenMonitor {
    /// Create a new empty monitor (no DB access yet).
    pub fn new() -> Self {
        Self {
            tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Convenience constructor: creates a monitor and immediately loads tokens
    /// from the database. Logs a warning (does not panic) if the DB is
    /// inaccessible or empty.
    pub async fn init(app: &AppHandle) -> Self {
        let monitor = Self::new();
        if let Err(e) = monitor.load_tokens(app).await {
            log::warn!("[oauth-monitor] Initial token load failed: {e}");
        }
        monitor
    }

    /// Reload `OAuthTokenInfo` entries from the `oauth_tokens` table using sqlx.
    ///
    /// Only loads rows where `refresh_token IS NOT NULL`.
    /// Joins with `accounts` to get provider-specific config.
    /// This is called both during startup and on every check cycle so that
    /// newly added or removed accounts are picked up automatically.
    pub async fn load_tokens(&self, app: &AppHandle) -> Result<(), String> {
        let pool = app.state::<SqlitePool>();

        let rows = sqlx::query_as::<_, (String, String, Option<i64>, Option<String>, Option<String>, Option<String>)>(
            "SELECT ot.account_id, ot.refresh_token, ot.expires_at, \
                    a.oauth_provider, a.oauth_client_id, a.oauth_client_secret \
             FROM oauth_tokens ot \
             JOIN accounts a ON a.id = ot.account_id \
             WHERE ot.refresh_token IS NOT NULL",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| format!("Query failed: {e}"))?;

        let mut loaded: Vec<OAuthTokenInfo> = Vec::new();
        for (account_id, encrypted_refresh_token, expires_at, provider, client_id, client_secret) in rows {
            // Decrypt the refresh token before storing in memory
            let refresh_token = match super::decrypt_token(app, &encrypted_refresh_token) {
                Ok(t) => t,
                Err(e) => {
                    log::warn!(
                        "[oauth-monitor] Failed to decrypt token for {account_id}: {e}"
                    );
                    continue; // skip this account
                }
            };

            loaded.push(OAuthTokenInfo {
                account_id,
                refresh_token,
                expires_at: expires_at.unwrap_or(0),
                provider: provider.unwrap_or_default(),
                client_id: client_id.unwrap_or_default(),
                client_secret,
            });
        }

        let mut tokens = self.tokens.write().await;
        tokens.clear();
        let count = loaded.len();
        for info in loaded {
            tokens.insert(info.account_id.clone(), info);
        }

        log::debug!("[oauth-monitor] Loaded {count} OAuth token(s) from DB");
        Ok(())
    }

    /// Spawn the proactive refresh loop.
    ///
    /// Checks every **5 minutes** whether any token expires within the
    /// **next 10 minutes** (`now + 600s >= expires_at`). Expired or
    /// near-expiry tokens are refreshed via `oauth_refresh_token`.
    ///
    /// Ownership of `self` is consumed (the caller should clone before
    /// spawning if the monitor is also kept in app state).
    pub async fn run_check_loop(self, app: AppHandle) {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            interval.tick().await;
            self.check_and_refresh(&app).await;
        }
    }

    // ─── Private helpers ──────────────────────────────────────────

    /// Core check: reload tokens, find near-expiry entries, refresh each.
    async fn check_and_refresh(&self, app: &AppHandle) {
        // Reload tokens every cycle so manual changes (add/remove accounts)
        // are picked up without a restart.
        if let Err(e) = self.load_tokens(app).await {
            log::warn!("[oauth-monitor] Token reload failed (will retry): {e}");
            return;
        }

        let candidates: Vec<OAuthTokenInfo> = {
            let tokens = self.tokens.read().await;
            tokens
                .values()
                .filter(|t| {
                    t.expires_at > 0
                        && super::oauth_should_refresh(t.expires_at as u64, Some(600))
                })
                .cloned()
                .collect()
        };

        if candidates.is_empty() {
            return;
        }

        log::info!(
            "[oauth-monitor] {} token(s) expiring within 10 min — refreshing",
            candidates.len()
        );

        for info in &candidates {
            self.refresh_one_token(app, info).await;
        }
    }

    /// Perform the HTTP refresh for a single token and persist the result.
    async fn refresh_one_token(&self, app: &AppHandle, info: &OAuthTokenInfo) {
        let token_url = match info.provider.as_str() {
            "gmail" | "google" => "https://oauth2.googleapis.com/token",
            "outlook" | "microsoft" | "hotmail" | "live" => {
                "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            }
            other => {
                log::error!(
                    "[oauth-monitor] Unknown OAuth provider '{other}' for account {} — skipping",
                    info.account_id
                );
                return;
            }
        };

        log::info!(
            "[oauth-monitor] Refreshing token for {} (provider: {}, expires_at: {})",
            info.account_id,
            info.provider,
            info.expires_at,
        );

        // Use the existing oauth_refresh_token function directly (it is a
        // public async fn in the parent module, not just a Tauri command).
        match super::oauth_refresh_token(
            token_url.to_string(),
            info.refresh_token.clone(),
            info.client_id.clone(),
            info.client_secret.clone(),
            None, // scope – omitted; provider re-uses the original scope
        )
        .await
        {
            Ok(result) => {
                log::info!(
                    "[oauth-monitor] Successfully refreshed token for {}",
                    info.account_id
                );

                // Persist the new access token and optional expiry in SQLite.
                Self::update_token_in_db(app, &info.account_id, &result.access_token, result.expires_at).await;

                // Update in-memory cache so the next check sees fresh data.
                if let Some(expires_at) = result.expires_at {
                    let mut tokens = self.tokens.write().await;
                    if let Some(entry) = tokens.get_mut(&info.account_id) {
                        entry.expires_at = expires_at as i64;
                    }
                }

                // Notify the frontend so it can pick up the new access_token.
                let _ = app.emit(
                    "oauth:token-refreshed",
                    serde_json::json!({ "account_id": &info.account_id }),
                );
            }
            Err(e) => {
                log::error!(
                    "[oauth-monitor] Failed to refresh token for {}: {}",
                    info.account_id,
                    e
                );
            }
        }
    }

    /// Write the refreshed access token (and optional expiry) back to the
    /// `oauth_tokens` table (and `accounts` table for backward compatibility)
    /// using the shared `SqlitePool`.
    async fn update_token_in_db(
        app: &AppHandle,
        account_id: &str,
        access_token: &str,
        expires_at: Option<u64>,
    ) {
        let pool = app.state::<SqlitePool>();

        // Update oauth_tokens table (primary)
        let oauth_result = if let Some(exp) = expires_at {
            sqlx::query(
                "UPDATE oauth_tokens SET access_token = ?1, expires_at = ?2, \
                 refreshed_at = unixepoch() WHERE account_id = ?3",
            )
            .bind(access_token)
            .bind(exp as i64)
            .bind(account_id)
            .execute(&*pool)
            .await
        } else {
            sqlx::query(
                "UPDATE oauth_tokens SET access_token = ?1, refreshed_at = unixepoch() \
                 WHERE account_id = ?2",
            )
            .bind(access_token)
            .bind(account_id)
            .execute(&*pool)
            .await
        };

        match &oauth_result {
            Ok(rows) if rows.rows_affected() == 0 => {
                // No oauth_tokens row yet — insert one
                let now = chrono::Utc::now().timestamp();
                let _ = sqlx::query(
                    "INSERT INTO oauth_tokens (id, account_id, access_token, refresh_token, \
                     token_type, expires_at, scope, created_at, refreshed_at) \
                     VALUES (?1, ?2, ?3, '', 'Bearer', ?4, '', ?5, ?5)",
                )
                .bind(uuid::Uuid::new_v4().to_string())
                .bind(account_id)
                .bind(access_token)
                .bind(expires_at.unwrap_or(0) as i64)
                .bind(now)
                .execute(&*pool)
                .await;
            }
            _ => {}
        }

        // Also update accounts table for backward compatibility during transition
        let acct_result = if let Some(exp) = expires_at {
            sqlx::query(
                "UPDATE accounts SET access_token = ?1, token_expires_at = ?2, \
                 updated_at = unixepoch() WHERE id = ?3",
            )
            .bind(access_token)
            .bind(exp as i64)
            .bind(account_id)
            .execute(&*pool)
            .await
        } else {
            sqlx::query(
                "UPDATE accounts SET access_token = ?1, updated_at = unixepoch() \
                 WHERE id = ?2",
            )
            .bind(access_token)
            .bind(account_id)
            .execute(&*pool)
            .await
        };

        match acct_result {
            Ok(_) => log::debug!("[oauth-monitor] DB updated for {account_id}"),
            Err(e) => log::error!("[oauth-monitor] DB update failed for {account_id}: {e}"),
        }
    }
}

impl Default for OAuthTokenMonitor {
    fn default() -> Self {
        Self::new()
    }
}
