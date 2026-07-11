use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Manager, Wry,
};
use tokio::sync::Mutex;

use sqlx::SqlitePool;

use crate::{bail, error::{SerializedError, ERR_INTERNAL, ERR_NETWORK}};
use crate::events::{AppEvent, EventBus};
use crate::imap::types::ImapConfig;

/// After this many failed sync attempts for a folder, it is paused so a single
/// broken folder can't abort the whole account sync. The user resumes it later.
const RESUME_RETRY_THRESHOLD: i64 = 3;

use crate::commands::core::{CreateSyncJobRequest, UpsertFolderSyncStateRequest};
use crate::db::tables::core::{accounts, folder_sync_state, sync_jobs};

pub mod caldav_sync;
pub mod persistence;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub last_sync: Option<i64>,
    pub is_syncing: bool,
    pub last_error: Option<String>,
}

pub struct BackgroundSync {
    running: Arc<AtomicBool>,
    interval_mins: Arc<Mutex<u64>>,
    last_sync: Arc<Mutex<Option<i64>>>,
    last_error: Arc<Mutex<Option<String>>>,
    pub registered_accounts: Arc<Mutex<Vec<ImapConfig>>>,
    handle: Option<AppHandle>,
}

impl BackgroundSync {
    pub fn with_handle(handle: AppHandle) -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            interval_mins: Arc::new(Mutex::new(15)),
            last_sync: Arc::new(Mutex::new(None)),
            last_error: Arc::new(Mutex::new(None)),
            registered_accounts: Arc::new(Mutex::new(Vec::new())),
            handle: Some(handle),
        }
    }

    pub async fn schedule_sync(&self, interval_mins: u64) {
        *self.interval_mins.lock().await = interval_mins;

        if self.running.load(Ordering::SeqCst) {
            log::info!("[background_sync] already running — updating interval to {interval_mins} min");
            return;
        }

        self.running.store(true, Ordering::SeqCst);

        let running = self.running.clone();
        let interval_mins = self.interval_mins.clone();
        let last_sync = self.last_sync.clone();
        let last_error = self.last_error.clone();
        let registered_accounts = self.registered_accounts.clone();
        let handle = self.handle.clone();

        tokio::spawn(async move {
            log::info!("[background_sync] sync loop started");
            loop {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                let interval = *interval_mins.lock().await;
                let accounts = registered_accounts.lock().await.clone();
                let result = Self::perform_sync_internal(&handle, accounts).await;

                match result {
                    Ok(()) => {
                        let now = Utc::now().timestamp();
                        *last_sync.lock().await = Some(now);
                        *last_error.lock().await = None;
                        Self::emit_via_eventbus(&handle, AppEvent::SyncComplete {
                            account_id: "all".to_string(),
                            new_count: 0,
                        });
                        log::info!("[background_sync] sync completed at {now}");
                    }
                    Err(e) => {
                        *last_error.lock().await = Some(e.to_string());
                        Self::emit_via_eventbus(&handle, AppEvent::SyncError {
                            account_id: "all".to_string(),
                            error: e.to_string(),
                        });
                        log::error!("[background_sync] sync failed: {e}");
                    }
                }

                tokio::time::sleep(std::time::Duration::from_secs(interval * 60)).await;
            }
            log::info!("[background_sync] sync loop stopped");
        });
    }

    /// Helper: emit an event via EventBus (if handle is available)
    fn emit_via_eventbus(handle: &Option<AppHandle>, event: AppEvent) {
        if let Some(ref h) = handle {
            if let Some(bus) = h.try_state::<EventBus>() {
                bus.emit(event);
            } else {
                log::warn!("[background_sync] EventBus not available for event emission");
            }
        }
    }

    pub async fn cancel_sync(&self) {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[background_sync] cancelled");
    }

    /// Perform the actual sync for all registered accounts
    async fn perform_sync_internal(
        handle: &Option<AppHandle>,
        accounts: Vec<ImapConfig>,
    ) -> Result<(), SerializedError> {
        Self::emit_via_eventbus(handle, AppEvent::SyncStarted { account_id: "all".to_string() });

        if accounts.is_empty() {
            log::info!("[background_sync] sync tick — no accounts registered");
            return Ok(());
        }

        log::info!(
            "[background_sync] starting sync for {} account(s)",
            accounts.len(),
        );

        let mut errors: Vec<String> = Vec::new();

        for config in &accounts {
            Self::emit_via_eventbus(handle, AppEvent::SyncAccountStart {
                account_id: config.username.clone(),
                host: config.host.clone(),
            });

            log::info!(
                "[background_sync] syncing account {}@{}",
                config.username,
                config.host
            );

            match Self::sync_account(handle, config).await {
                Ok(account_result) => {
                    log::info!(
                        "[background_sync] finished {}@{}: {} folder(s) synced",
                        config.username,
                        config.host,
                        account_result
                    );
                    Self::emit_via_eventbus(handle, AppEvent::SyncAccountComplete {
                        account_id: config.username.clone(),
                        new_count: account_result as usize,
                    });
                }
                Err(e) => {
                    let err_msg = format!("account {}@{}: {}", config.username, config.host, e);
                    log::error!("[background_sync] {err_msg}");
                    errors.push(err_msg);
                    Self::emit_via_eventbus(handle, AppEvent::SyncAccountError {
                        account_id: config.username.clone(),
                        error: e.to_string(),
                    });
                }
            }
        }

        // Cleanup idle sessions across all pools after syncing
        Self::cleanup_pools(handle).await;

        if errors.is_empty() {
            Ok(())
        } else {
            bail!(ERR_NETWORK, "{} account(s) failed: {}", errors.len(), errors.join("; "));
        }
    }

    /// Cleanup idle sessions in the pool manager.
    async fn cleanup_pools(handle: &Option<AppHandle>) {
        use crate::imap::session::SessionPoolManager;
        if let Some(h) = handle {
            if let Some(pool_manager) = h.try_state::<SessionPoolManager>() {
                pool_manager
                    .cleanup_all(std::time::Duration::from_secs(300))
                    .await;
            } else {
                log::debug!("[background_sync] SessionPoolManager not available yet for cleanup");
            }
        }
    }

    /// Sync a single IMAP account: acquire session from per-account pool, list folders, sync each one, return session
    async fn sync_account(handle: &Option<AppHandle>, config: &ImapConfig) -> Result<u32, SerializedError> {
        use crate::imap::{folder, sync};
        use crate::imap::session::SessionPoolManager;

        let pool_manager = handle
            .as_ref()
            .and_then(|h| h.try_state::<SessionPoolManager>())
            .ok_or_else(|| SerializedError::new(ERR_INTERNAL, "SessionPoolManager not available"))?;

        // Get or create the per-account pool
        let account_pool = pool_manager.get_or_create(&config.username, 5).await;

        // Acquire session from pool (reuses existing connection or creates new one)
        let mut session = account_pool.acquire(config).await?;
        log::info!(
            "[background_sync] connected to {}:{}",
            config.host,
            config.port
        );

        // Resolve the DB account so folder-sync state can be persisted for resume.
        // A missing/unresolvable account still allows the sync to run, just
        // without a persisted checkpoint (best-effort).
        let pool: Option<SqlitePool> = handle
            .as_ref()
            .map(|h| h.state::<SqlitePool>().inner().clone());
        let account_id: Option<String> = match &pool {
            Some(p) => match accounts::get_by_email(p, &config.username).await {
                Ok(Some(acc)) => Some(acc.id),
                Ok(None) => {
                    log::warn!(
                        "[background_sync] {}: no DB account for '{}'; resume checkpoints disabled",
                        config.host, config.username
                    );
                    None
                }
                Err(e) => {
                    log::warn!("[background_sync] {}: account lookup failed: {e}", config.host);
                    None
                }
            },
            None => None,
        };

        let folders = folder::list_folders(&mut session).await?;
        log::info!(
            "[background_sync] {}: found {} folder(s)",
            config.host,
            folders.len()
        );

        // Resume: collect folders paused by a previous run (or a retry-threshold
        // breach) so we skip them this pass until the user resumes them.
        let paused_folders: std::collections::HashSet<String> = match (&pool, &account_id) {
            (Some(p), Some(aid)) => folder_sync_state::list_paused(p, aid)
                .await
                .map(|rows| rows.into_iter().map(|r| r.folder_path).collect())
                .unwrap_or_default(),
            _ => Default::default(),
        };

        // Track this pass as a sync job so the UI can show a resume-able timeline
        // (report.md §6.2 / §6.4). Started in `discovery`, advanced to
        // `backfill` below, closed as `done` once the folders are processed.
        let job_id: Option<String> = match (&pool, &account_id) {
            (Some(p), Some(aid)) if !folders.is_empty() => {
                let id = uuid::Uuid::new_v4().to_string();
                let req = CreateSyncJobRequest {
                    id: id.clone(),
                    account_id: aid.clone(),
                    phase: Some("discovery".to_string()),
                    status: None,
                    total_folders: Some(folders.len() as i64),
                    estimated_messages: None,
                };
                match sync_jobs::create(p, &req).await {
                    Ok(()) => Some(id),
                    Err(e) => {
                        log::warn!("[background_sync] {}: failed to create sync job: {e}", config.host);
                        None
                    }
                }
            }
            _ => None,
        };
        if let (Some(p), Some(jid)) = (&pool, &job_id) {
            let _ = sync_jobs::set_phase(p, jid, "backfill").await;
        }

        let mut folders_synced = 0u32;
        let mut total_messages = 0u32;

        for f in &folders {
            // Skip spam, trash, and drafts folders for performance
            let special = f.special_use.as_deref();
            if matches!(special, Some("\\Junk" | "\\Trash" | "\\Drafts")) {
                log::info!(
                    "[background_sync] {}: skipping folder '{}' (special_use={:?})",
                    config.host,
                    f.name,
                    special
                );
                continue;
            }

            // Skip folders paused for resume.
            if paused_folders.contains(&f.raw_path) {
                log::info!(
                    "[background_sync] {}: skipping paused folder '{}' (resume later)",
                    config.host,
                    f.name
                );
                continue;
            }

            log::info!(
                "[background_sync] {}: syncing folder '{}' (raw={})",
                config.host,
                f.name,
                f.raw_path
            );

            // Mark the folder as actively backfilling before we fetch (best-effort;
            // a no-op when no checkpoint row exists yet).
            if let (Some(p), Some(aid)) = (&pool, &account_id) {
                let _ = folder_sync_state::set_sync_phase(p, aid, &f.raw_path, "backfill").await;
            }

            match sync::sync_folder(&mut session, &f.raw_path, 50, None).await {
                Ok(result) => {
                    let msg_count = result.messages.len() as u32;
                    log::info!(
                        "[background_sync] {}: folder '{}' synced — {} messages",
                        config.host,
                        f.name,
                        msg_count
                    );
                    folders_synced += 1;
                    total_messages += msg_count;

                    // Persist the resume checkpoint so a future run starts after
                    // this folder. Clears any prior error and marks it done.
                    if let (Some(p), Some(aid)) = (&pool, &account_id) {
                        let max_uid = result.uids.iter().copied().max().unwrap_or(0);
                        let req = UpsertFolderSyncStateRequest {
                            account_id: aid.clone(),
                            folder_path: f.raw_path.clone(),
                            uidvalidity: Some(result.folder_status.uidvalidity as i64),
                            last_uid: max_uid as i64,
                            modseq: result.folder_status.highest_modseq.map(|m| m as i64),
                            last_sync_at: None,
                            sync_phase: Some("done".to_string()),
                            last_error: None,
                            retry_count: None,
                            is_paused: None,
                        };
                        if let Err(e) = folder_sync_state::upsert(p, &req).await {
                            log::warn!(
                                "[background_sync] {}: failed to persist sync state for '{}': {e}",
                                config.host, f.name
                            );
                        }
                    }
                }
                Err(e) => {
                    log::warn!(
                        "[background_sync] {}: folder '{}' sync failed: {}",
                        config.host,
                        f.name,
                        e
                    );

                    // Record the failure and pause the folder once it breaches the
                    // retry threshold, so a single broken folder can't abort the
                    // whole account sync (report.md §6.4).
                    if let (Some(p), Some(aid)) = (&pool, &account_id) {
                        let seed = UpsertFolderSyncStateRequest {
                            account_id: aid.clone(),
                            folder_path: f.raw_path.clone(),
                            uidvalidity: None,
                            last_uid: 0,
                            modseq: None,
                            last_sync_at: None,
                            sync_phase: Some("backfill".to_string()),
                            last_error: None,
                            retry_count: Some(0),
                            is_paused: None,
                        };
                        let _ = folder_sync_state::upsert(p, &seed).await;
                        let _ = folder_sync_state::record_error(p, aid, &f.raw_path, &e.to_string()).await;
                        if let Ok(Some(state)) =
                            folder_sync_state::get(p, aid, &f.raw_path).await
                        {
                            if state.retry_count > RESUME_RETRY_THRESHOLD {
                                let _ = folder_sync_state::set_paused(p, aid, &f.raw_path, true).await;
                                log::warn!(
                                    "[background_sync] {}: folder '{}' paused after {} retries",
                                    config.host, f.name, state.retry_count
                                );
                            }
                        }
                    }
                    // Continue with other folders even if one fails
                }
            }
        }

        // Update progress and close out the sync job for this pass.
        if let (Some(p), Some(jid)) = (&pool, &job_id) {
            let _ = sync_jobs::update_progress(p, jid, folders_synced as i64, total_messages as i64).await;
            let _ = sync_jobs::mark_done(p, jid).await;
        }

        // Return session to per-account pool instead of logging out — enables connection reuse
        account_pool.release(session).await;
        log::info!(
            "[background_sync] session returned to pool for {}:{}",
            config.host,
            config.port
        );

        Ok(folders_synced)
    }

    /// Get the current interval in minutes (read-only accessor for orchestrator)
    pub async fn interval_mins(&self) -> u64 {
        *self.interval_mins.lock().await
    }

    pub async fn get_status(&self) -> SyncStatus {
        SyncStatus {
            last_sync: *self.last_sync.lock().await,
            is_syncing: self.running.load(Ordering::SeqCst),
            last_error: self.last_error.lock().await.clone(),
        }
    }
}

// ---------- Tauri commands ----------

#[tauri::command]
pub async fn schedule_background_sync(
    app: AppHandle,
    interval_mins: u64,
) -> Result<SyncStatus, SerializedError> {
    let state = app.state::<BackgroundSync>();
    state.schedule_sync(interval_mins).await;
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn cancel_background_sync(app: AppHandle) -> Result<SyncStatus, SerializedError> {
    let state = app.state::<BackgroundSync>();
    state.cancel_sync().await;
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn get_background_sync_status(app: AppHandle) -> Result<SyncStatus, SerializedError> {
    let state = app.state::<BackgroundSync>();
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn register_background_accounts(
    app: AppHandle,
    accounts: Vec<ImapConfig>,
) -> Result<(), SerializedError> {
    let state = app.state::<BackgroundSync>();
    let mut reg = state.registered_accounts.lock().await;
    let count = accounts.len();
    *reg = accounts;
    log::info!("[background_sync] registered {count} account(s) for background sync");
    Ok(())
}

#[tauri::command]
pub async fn get_background_sync_prefs(
    app: AppHandle,
) -> Result<persistence::SyncPreferences, SerializedError> {
    let prefs = persistence::load_prefs(&app).await;
    Ok(prefs)
}

#[tauri::command]
pub async fn set_background_sync_prefs(
    app: AppHandle,
    enabled: bool,
    interval_mins: u64,
) -> Result<SyncStatus, SerializedError> {
    let prefs = persistence::SyncPreferences { enabled, interval_minutes: interval_mins };
    persistence::save_prefs(&app, &prefs).await?;

    let state = app.state::<BackgroundSync>();
    if enabled {
        state.schedule_sync(interval_mins).await;
    } else {
        state.cancel_sync().await;
    }
    Ok(state.get_status().await)
}

/// Registers the background sync module as a Tauri v2 plugin.
/// This makes commands accessible from Kotlin via PluginManager.runCommand()
/// when running on Android. The plugin name is "background".
pub fn init() -> TauriPlugin<Wry> {
    Builder::<Wry>::new("background")
        .setup(|app, _api| {
            app.manage(BackgroundSync::with_handle(app.clone()));
            app.manage(caldav_sync::CaldavSync::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            schedule_background_sync,
            cancel_background_sync,
            get_background_sync_status,
            register_background_accounts,
            set_background_sync_prefs,
            get_background_sync_prefs,
            // CalDAV sync commands
            caldav_sync::start_caldav_background_sync,
            caldav_sync::stop_caldav_background_sync,
            caldav_sync::get_caldav_sync_status,
            caldav_sync::trigger_caldav_sync_now,
        ])
        .build()
}
