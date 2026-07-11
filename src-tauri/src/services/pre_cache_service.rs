// ── PreCacheService ──────────────────────────────────────────────────────────
//
// Background service that fetches full IMAP body parts for the top unread
// messages per account and caches them in the database. Runs on a configurable
// interval (default 5 minutes) to ensure email bodies are available for fast
// offline access and search indexing.
//
// Uses the existing IMAP SessionPoolManager so connections are shared with
// the background sync and IDLE subsystems.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::db::core::schema::Account;
use crate::imap::session::SessionPoolManager;
use crate::imap::types::ImapConfig;

/// Number of unread messages to pre-cache per account per tick.
const TOP_N_UNREAD: u32 = 50;

/// Default interval between pre-cache ticks (seconds).
const DEFAULT_INTERVAL_SECS: u64 = 300; // 5 minutes

/// Maximum body size to cache (10 MB). Larger bodies are skipped to avoid OOM.
const MAX_BODY_CACHE_SIZE: usize = 10 * 1024 * 1024;

/// Background pre-cache orchestrator.
pub struct PreCacheService {
    running: Arc<AtomicBool>,
    interval_secs: Arc<tokio::sync::Mutex<u64>>,
}

impl PreCacheService {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            interval_secs: Arc::new(tokio::sync::Mutex::new(DEFAULT_INTERVAL_SECS)),
        }
    }

    /// Start the pre-cache loop. Idempotent — safe to call multiple times.
    pub fn start(&self, app: AppHandle) {
        if self.running.swap(true, Ordering::SeqCst) {
            log::info!("[pre_cache] already running — skipping duplicate start");
            return;
        }

        let running = self.running.clone();
        let interval = self.interval_secs.clone();

        tokio::spawn(async move {
            log::info!("[pre_cache] service started (interval={DEFAULT_INTERVAL_SECS}s)");

            loop {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                if let Err(e) = Self::run_tick(&app).await {
                    log::error!("[pre_cache] tick failed: {e}");
                }

                let secs = *interval.lock().await;
                tokio::time::sleep(std::time::Duration::from_secs(secs)).await;
            }

            log::info!("[pre_cache] service stopped");
        });
    }

    /// Stop the pre-cache loop gracefully.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[pre_cache] stop requested");
    }
}

impl Drop for PreCacheService {
    fn drop(&mut self) {
        self.stop();
    }
}

impl PreCacheService {

    /// Single pre-cache tick: iterate over active IMAP accounts and cache
    /// body parts for the top N unread messages.
    async fn run_tick(app: &AppHandle) -> Result<(), String> {
        let pool = app.try_state::<SqlitePool>()
            .ok_or_else(|| "SqlitePool not available in app state".to_string())?;

        let accounts = Self::list_active_imap_accounts(&pool).await?;

        if accounts.is_empty() {
            log::debug!("[pre_cache] no active IMAP accounts to pre-cache");
            return Ok(());
        }

        log::info!("[pre_cache] checking {} active account(s)", accounts.len());

        for account in &accounts {
            if let Err(e) = Self::pre_cache_account(app, &pool, account).await {
                log::warn!(
                    "[pre_cache] account {}@{} pre-cache failed: {e}",
                    account.email,
                    account.imap_host.as_deref().unwrap_or("?"),
                );
            }
        }

        Ok(())
    }

    /// Query all active IMAP accounts from the database.
    async fn list_active_imap_accounts(pool: &SqlitePool) -> Result<Vec<Account>, String> {
        let accounts = sqlx::query_as::<_, Account>(
            "SELECT * FROM accounts WHERE is_active = 1 AND provider = 'imap_smtp'",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query active accounts: {e}"))?;

        Ok(accounts)
    }

    /// Pre-cache bodies for a single account: find up to TOP_N_UNREAD uncached
    /// messages, fetch their bodies via IMAP, and update the DB.
    async fn pre_cache_account(
        app: &AppHandle,
        pool: &SqlitePool,
        account: &Account,
    ) -> Result<(), String> {
        // Find up to N uncached messages for this account.
        // We select messages where body_cached = 0 AND body_html IS NULL
        // (bodies that haven't been fetched yet), ordered by date DESC
        // (most recent first).
        let uncached = sqlx::query_as::<_, UncachedMessage>(
            r#"
            SELECT id, imap_uid, imap_folder
            FROM messages
            WHERE account_id = ?1
              AND imap_uid IS NOT NULL
              AND imap_folder IS NOT NULL
              AND imap_folder != ''
              AND body_cached = 0
              AND body_html IS NULL
            ORDER BY date DESC
            LIMIT ?2
            "#,
        )
        .bind(&account.id)
        .bind(TOP_N_UNREAD)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query uncached messages: {e}"))?;

        if uncached.is_empty() {
            log::debug!("[pre_cache] {}: no uncached messages to fetch", account.email);
            return Ok(());
        }

        log::info!(
            "[pre_cache] {}: fetching bodies for {} uncached message(s)",
            account.email,
            uncached.len(),
        );

        // Build an ImapConfig from the account record, decrypting the password.
        let config = Self::build_imap_config(app, account)?;

        // Get the SessionPoolManager from app state.
        let pool_manager = app.try_state::<SessionPoolManager>()
            .ok_or_else(|| "SessionPoolManager not available".to_string())?;

        let account_pool = pool_manager.get_or_create(&account.email, 3).await;

        // Acquire a session from the per-account pool.
        let mut session = account_pool.acquire(&config).await
            .map_err(|e| format!("Failed to acquire IMAP session: {e}"))?;

        let mut cached_count = 0u32;

        // Group messages by folder to minimize SELECT calls.
        use std::collections::HashMap;
        let mut by_folder: HashMap<String, Vec<i64>> = HashMap::new();
        for msg in &uncached {
            if let Some(ref folder) = msg.imap_folder {
                by_folder
                    .entry(folder.clone())
                    .or_default()
                    .push(msg.imap_uid);
            }
        }

        for (folder, uids) in &by_folder {
            let uid_str = uids
                .iter()
                .map(|u| u.to_string())
                .collect::<Vec<_>>()
                .join(",");

            log::debug!(
                "[pre_cache] {}: fetching {} UID(s) from '{}'",
                account.email,
                uids.len(),
                folder,
            );

            match crate::imap::fetch::fetch_messages(&mut session, folder, &uid_str).await {
                Ok(result) => {
                    for msg in &result.messages {
                        // Only update if we actually got body content.
                        if msg.body_html.is_some() || msg.body_text.is_some() {
                            // Skip oversized bodies to avoid OOM / DB bloat.
                            let html_len = msg.body_html.as_ref().map(|s| s.len()).unwrap_or(0);
                            let text_len = msg.body_text.as_ref().map(|s| s.len()).unwrap_or(0);
                            if html_len + text_len > MAX_BODY_CACHE_SIZE {
                                log::warn!(
                                    "[pre_cache] UID {} in '{}': body {} bytes exceeds {} MB limit — skipping",
                                    msg.uid,
                                    folder,
                                    html_len + text_len,
                                    MAX_BODY_CACHE_SIZE / (1024 * 1024),
                                );
                                continue;
                            }

                            let html = msg.body_html.as_deref();
                            let text = msg.body_text.as_deref();
                            let snippet = msg.snippet.as_deref();

                            if let Err(e) = sqlx::query(
                                r#"
                                UPDATE messages
                                SET body_html = ?1,
                                    body_text = ?2,
                                    snippet = ?3,
                                    body_cached = 1
                                WHERE account_id = ?4 AND imap_uid = ?5 AND imap_folder = ?6
                                "#,
                            )
                            .bind(html)
                            .bind(text)
                            .bind(snippet)
                            .bind(&account.id)
                            .bind(msg.uid as i64)
                            .bind(folder)
                            .execute(pool)
                            .await
                            {
                                log::warn!(
                                    "[pre_cache] failed to update UID {} in '{}': {e}",
                                    msg.uid,
                                    folder,
                                );
                                continue;
                            }

                            cached_count += 1;
                        }
                    }
                }
                Err(e) => {
                    log::warn!(
                        "[pre_cache] {}: fetch failed for folder '{}': {e}",
                        account.email,
                        folder,
                    );
                    // Continue with next folder on error.
                }
            }
        }

        // Return session to pool.
        account_pool.release(session).await;

        log::info!(
            "[pre_cache] {}: cached {cached_count}/{} message body(ies)",
            account.email,
            uncached.len(),
        );

        Ok(())
    }

    /// Build an ImapConfig from an Account row, decrypting stored credentials.
    fn build_imap_config(app: &AppHandle, account: &Account) -> Result<ImapConfig, String> {
        let host = account
            .imap_host
            .as_deref()
            .ok_or_else(|| format!("Account {} has no IMAP host configured", account.email))?;

        let port = account
            .imap_port
            .map(|p| p as u16)
            .ok_or_else(|| format!("Account {} has no IMAP port configured", account.email))?;

        let security = account
            .imap_security
            .as_deref()
            .unwrap_or("tls")
            .to_string();

        let username = account
            .imap_username
            .as_deref()
            .unwrap_or(&account.email)
            .to_string();

        // Decrypt the stored password or OAuth token.
        let password = if let Some(ref enc) = account.imap_password {
            crate::oauth::decrypt_token(app, enc)
                .map_err(|e| format!("Failed to decrypt IMAP password for {}: {e}", account.email))?
        } else if let Some(ref enc) = account.access_token {
            crate::oauth::decrypt_token(app, enc)
                .map_err(|e| format!("Failed to decrypt access token for {}: {e}", account.email))?
        } else {
            return Err(format!("Account {} has no IMAP password or access token", account.email));
        };

        Ok(ImapConfig {
            host: host.to_string(),
            port,
            security,
            username,
            password,
            auth_method: account.auth_method.clone(),
            accept_invalid_certs: false,
        })
    }
}

/// Lightweight row for uncached messages (only the fields we need).
#[derive(Debug, sqlx::FromRow)]
struct UncachedMessage {
    #[allow(dead_code)]
    id: String,
    imap_uid: i64,
    imap_folder: Option<String>,
}
