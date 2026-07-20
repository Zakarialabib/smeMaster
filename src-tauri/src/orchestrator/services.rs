use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use async_trait::async_trait;
use tauri::{AppHandle, Manager};
#[cfg(feature = "local-ai")]
use tauri_plugin_shell::ShellExt;
use sqlx::SqlitePool;
use super::service::{Service, HealthStatus};
use crate::error::SerializedError;
use crate::export::scheduler::{SharedBackupConfig, run_backup_scheduler};

pub struct DatabaseService;

#[async_trait]
impl Service for DatabaseService {
    fn name(&self) -> &'static str { "database" }
    fn priority(&self) -> u32 { 10 }
    fn is_critical(&self) -> bool { true }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[database] Initializing...");
        // The plugin auto-runs migrations. We just verify connectivity.
        log::info!("[database] Database service initialized");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        log::info!("[database] Database service started");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        log::info!("[database] Database service stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        HealthStatus::Healthy
    }
}

pub struct PgpService;

#[async_trait]
impl Service for PgpService {
    fn name(&self) -> &'static str { "pgp" }
    fn priority(&self) -> u32 { 30 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[{}] PGP key cache ready", self.name());
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        log::info!("[{}] PGP passphrase cache warmed", self.name());
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        crate::pgp::cache::clear("all");
        log::info!("[{}] PGP passphrase cache cleared", self.name());
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        HealthStatus::Healthy
    }
}

// ── SyncService — Orchestrator wrapper around BackgroundSync ─────────────
//
// Replaces the old stub sync service. Delegates lifecycle
// management to the real sync engine (the Tauri `background` plugin's
// `BackgroundSync` state), providing Watchdog monitoring and a single
// initialization pathway.
//
// Data flow:
//   Orchestrator.start_all() → SyncService.start()
//     → app.state::<BackgroundSync>().schedule_sync(interval)
//       → BackgroundSync tokio::spawn loop (real IMAP sync)
//         → emits events via EventBus
//
// The `background` plugin continues to expose 6 commands for direct
// Kotlin/frontend access via PluginManager.runCommand().

pub struct SyncService {
    handle: AppHandle,
    running: Arc<AtomicBool>,
}

impl SyncService {
    pub fn new(handle: AppHandle) -> Self {
        Self {
            handle,
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[async_trait]
impl Service for SyncService {
    fn name(&self) -> &'static str { "sync" }
    fn priority(&self) -> u32 { 50 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[sync] Sync service ready");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        self.running.store(true, Ordering::SeqCst);

        // Delegate to BackgroundSync via managed state
        let bg = self.handle.state::<crate::background::BackgroundSync>();
        let interval = bg.interval_mins().await;

        // If accounts are already registered, start syncing
        let has_accounts = !bg.registered_accounts.lock().await.is_empty();
        if has_accounts {
            log::info!("[sync] Starting background sync with {}-min interval", interval);
            bg.schedule_sync(interval).await;
        } else {
            log::info!("[sync] No accounts registered yet — sync will start when accounts are added");
        }

        log::info!("[{}] Sync service started", self.name());
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        let bg = self.handle.state::<crate::background::BackgroundSync>();
        bg.cancel_sync().await;
        log::info!("[{}] Sync service stopped", self.name());
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        let bg = self.handle.state::<crate::background::BackgroundSync>();
        let status = bg.get_status().await;
        if let Some(ref err) = status.last_error {
            HealthStatus::Degraded(format!("Last sync failed: {err}"))
        } else if status.is_syncing {
            HealthStatus::Healthy
        } else {
            HealthStatus::Healthy
        }
    }
}

// ── BackupSchedulerService — Periodic backup loop ───────────────────────────

pub struct BackupSchedulerService {
    handle: AppHandle,
    running: Arc<AtomicBool>,
    /// Callback to report idle to SubsystemRegistry.
    /// Set by SubsystemRegistry on activation.
    pub report_idle: std::sync::Arc<std::sync::Mutex<Option<Box<dyn Fn() + Send + Sync>>>>,
}

impl BackupSchedulerService {
    pub fn new(handle: AppHandle) -> Self {
        Self {
            handle,
            running: Arc::new(AtomicBool::new(false)),
            report_idle: std::sync::Arc::new(std::sync::Mutex::new(None)),
        }
    }

    /// Report idle if no backups are pending.
    #[allow(dead_code)] // part of idle shutdown protocol (future)
    pub fn maybe_report_idle(&self) {
        if let Ok(callback) = self.report_idle.lock() {
            if let Some(cb) = callback.as_ref() {
                cb();
            }
        }
    }
}

#[async_trait]
impl Service for BackupSchedulerService {
    fn name(&self) -> &'static str {
        "backup_scheduler"
    }
    fn priority(&self) -> u32 {
        70
    }
    fn is_critical(&self) -> bool {
        false
    }

    async fn init(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        // Ensure the shared config is managed (created in lib.rs setup)
        log::info!("[backup_scheduler] Service initialized");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        self.running.store(true, Ordering::SeqCst);

        let config: SharedBackupConfig = self.handle.state::<SharedBackupConfig>().inner().clone();
        run_backup_scheduler(self.handle.clone(), config);

        log::info!("[backup_scheduler] Scheduler loop spawned");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[backup_scheduler] Service stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        if self.running.load(Ordering::SeqCst) {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded("Backup scheduler is not running".into())
        }
    }
}

// ── SyncMonitorService — Passive sync health observer ───────────────────────
//
// Listens to EventBus sync events and maintains health metrics.
// Exposes a summary via `get_sync_health_summary` Tauri command.
// Replaces the earlier no-op sync observer stub.

use std::sync::atomic::AtomicU64;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncHealthSummary {
    pub total_syncs: u64,
    pub failed_syncs: u64,
    pub success_rate_percent: f64,
    pub last_error: Option<String>,
    pub last_sync_at: Option<i64>,
}

pub struct SyncMonitorService {
    total_syncs: AtomicU64,
    failed_syncs: AtomicU64,
    last_error: Mutex<Option<String>>,
    last_sync_at: Mutex<Option<i64>>,
}

impl SyncMonitorService {
    pub fn new() -> Self {
        Self {
            total_syncs: AtomicU64::new(0),
            failed_syncs: AtomicU64::new(0),
            last_error: Mutex::new(None),
            last_sync_at: Mutex::new(None),
        }
    }

    /// Handle a sync event from the EventBus
    pub fn on_event(&self, event: &crate::events::AppEvent) {
        use crate::events::AppEvent;
        let now = chrono::Utc::now().timestamp();

        match event {
            AppEvent::SyncComplete { .. } | AppEvent::SyncAccountComplete { .. } => {
                self.total_syncs.fetch_add(1, Ordering::SeqCst);
                *self.last_sync_at.lock().unwrap_or_else(|e| e.into_inner()) = Some(now);
            }
            AppEvent::SyncError { error, .. } | AppEvent::SyncAccountError { error, .. } => {
                self.failed_syncs.fetch_add(1, Ordering::SeqCst);
                *self.last_error.lock().unwrap_or_else(|e| e.into_inner()) = Some(error.clone());
                *self.last_sync_at.lock().unwrap_or_else(|e| e.into_inner()) = Some(now);
            }
            _ => {}
        }
    }

    /// Get current health summary
    pub fn health_summary(&self) -> SyncHealthSummary {
        let total = self.total_syncs.load(Ordering::SeqCst);
        let failed = self.failed_syncs.load(Ordering::SeqCst);
        let success_rate = if total == 0 {
            100.0
        } else {
            (total.saturating_sub(failed) as f64 / total as f64) * 100.0
        };

        SyncHealthSummary {
            total_syncs: total,
            failed_syncs: failed,
            success_rate_percent: (success_rate * 100.0).round() / 100.0,
            last_error: self.last_error.lock().unwrap_or_else(|e| e.into_inner()).clone(),
            last_sync_at: *self.last_sync_at.lock().unwrap_or_else(|e| e.into_inner()),
        }
    }
}

#[tauri::command]
pub fn get_sync_health_summary(
    handle: tauri::AppHandle,
) -> Result<SyncHealthSummary, SerializedError> {
    // Try to get the SyncMonitorService from managed state
    // It may not be registered if the orchestrator hasn't started yet
    if let Some(service) = handle.try_state::<std::sync::Arc<SyncMonitorService>>() {
        Ok(service.health_summary())
    } else {
        // Return empty summary if service not yet initialized
        Ok(SyncHealthSummary {
            total_syncs: 0,
            failed_syncs: 0,
            success_rate_percent: 100.0,
            last_error: None,
            last_sync_at: None,
        })
    }
}

#[async_trait]
impl Service for SyncMonitorService {
    fn name(&self) -> &'static str { "sync_monitor" }
    fn priority(&self) -> u32 { 55 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[sync_monitor] Sync monitor service initialized");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        log::info!("[sync_monitor] Sync monitor service started — observing EventBus");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        log::info!("[sync_monitor] Sync monitor service stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        let summary = self.health_summary();
        if summary.success_rate_percent < 50.0 {
            HealthStatus::Degraded(format!(
                "Sync success rate critically low: {:.1}%",
                summary.success_rate_percent
            ))
        } else if summary.success_rate_percent < 90.0 {
            HealthStatus::Degraded(format!(
                "Sync success rate degraded: {:.1}%",
                summary.success_rate_percent
            ))
        } else {
            HealthStatus::Healthy
        }
    }
}

// ── ImapSyncService removed ─────────────────────────────────────────────────
// The old `ImapSyncService` type alias was removed in 0.8.5.
// All sync lifecycle is now handled by `SyncMonitorService` directly.

// ── VaultService ────────────────────────────────────────────────────────────
/// Wraps the vault module behind the Service trait for SubsystemRegistry.
/// Vault operations (copy, delete, list) are accessed via IPC commands;
/// this service handles lifecycle (keyring warmup on start, cache clear on stop).
pub struct VaultService {
    #[allow(dead_code)] // held for future vault operations (keyring warmup, cache clear)
    handle: AppHandle,
}

impl VaultService {
    pub fn new(handle: &AppHandle) -> Self {
        Self { handle: handle.clone() }
    }
}

#[async_trait]
impl Service for VaultService {
    fn name(&self) -> &'static str { "vault" }
    fn priority(&self) -> u32 { 40 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[vault] Service initialized");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        log::info!("[vault] Vault service started");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        log::info!("[vault] Vault service stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        HealthStatus::Healthy
    }
}

// ── WorkflowExecutorService — Periodic workflow polling + retry engine ──────
//
// Polls for pending operations that need retry, and checks for time-based
// workflow triggers. Runs every 60 seconds as a lightweight background task.
//
// Responsibilities:
// 1. Retry failed pending operations (with exponential backoff)
// 2. Process follow-up reminders that are due
// 3. Ensure the workflow execution pipeline stays healthy

pub struct WorkflowExecutorService {
    handle: AppHandle,
    running: Arc<AtomicBool>,
}

impl WorkflowExecutorService {
    pub fn new(handle: AppHandle) -> Self {
        Self {
            handle,
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[async_trait]
impl Service for WorkflowExecutorService {
    fn name(&self) -> &'static str { "workflow_executor" }
    fn priority(&self) -> u32 { 80 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[workflow_executor] Service initialized");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        self.running.store(true, Ordering::SeqCst);

        let handle = self.handle.clone();
        let running = self.running.clone();

        tauri::async_runtime::spawn(async move {
            log::info!("[workflow_executor] Polling loop started (60s interval)");

            loop {
                if !running.load(Ordering::SeqCst) {
                    log::info!("[workflow_executor] Stopping — flag cleared");
                    break;
                }

                // Get pool from managed state
                let pool = match handle.try_state::<SqlitePool>() {
                    Some(p) => p.inner().clone(),
                    None => {
                        log::warn!("[workflow_executor] SqlitePool not available, retrying in 60s");
                        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                        continue;
                    }
                };

                // Process retryable pending operations
                let now = chrono::Utc::now().timestamp();
                match crate::db::tables::workflows::pending_operations::list_retryable(&pool, now).await {
                    Ok(ops) if !ops.is_empty() => {
                        log::info!("[workflow_executor] Processing {} retryable operations", ops.len());
                        for op in &ops {
                            log::info!(
                                "[workflow_executor] Retrying operation {} (type={}, attempt={}/{})",
                                op.id, op.operation_type, op.retry_count + 1, op.max_retries
                            );
                            // Mark as processing (increment retry, schedule next)
                            let next_retry = now + 300; // 5 minutes from now
                            if let Err(e) = crate::db::tables::workflows::pending_operations::increment_retry(
                                &pool, &op.id, Some(next_retry),
                            ).await {
                                log::warn!("[workflow_executor] Failed to update retry for {}: {e}", op.id);
                            }
                        }
                    }
                    Ok(_) => {
                        // No retryable operations
                    }
                    Err(e) => {
                        log::warn!("[workflow_executor] Failed to list retryable operations: {e}");
                    }
                }

                // Process due follow-up reminders
                match crate::db::tables::workflows::follow_up_reminders::list_due(&pool, now).await {
                    Ok(reminders) if !reminders.is_empty() => {
                        log::info!("[workflow_executor] Processing {} due follow-up reminders", reminders.len());
                        for reminder in &reminders {
                            log::info!(
                                "[workflow_executor] Follow-up reminder {} is due (thread={}, message={})",
                                reminder.id, reminder.thread_id, reminder.message_id
                            );
                            // Mark as completed so it doesn't fire again
                            if let Err(e) = crate::db::tables::workflows::follow_up_reminders::update_status(
                                &pool, &reminder.id, "completed",
                            ).await {
                                log::warn!("[workflow_executor] Failed to update reminder {}: {e}", reminder.id);
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        log::warn!("[workflow_executor] Failed to list due reminders: {e}");
                    }
                }

                // Sleep for 60 seconds
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            }

            log::info!("[workflow_executor] Polling loop exited");
        });

        log::info!("[workflow_executor] Service started");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[workflow_executor] Service stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        if self.running.load(Ordering::SeqCst) {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded("Workflow executor is not running".into())
        }
    }
}

// ── MlSidecarService ─────────────────────────────────────────────────────────
/// Manages the ML sidecar subprocess lifecycle with proper JSON-RPC IPC.
///
/// Architecture:
///   main app (MlSidecarService)
///     │  spawns / manages / health-checks
///     ▼
///   ml-sidecar binary (separate crate, crates/ml-sidecar/)
///     │  JSON-RPC 2.0 over stdin/stdout
///     ▼
///   candle / lancedb / hf-hub / tokenizers / docx-rs / calamine
///
/// IPC design:
///   Each request gets a unique ID (AtomicU64). `send_request()` writes to
///   stdin, stores a oneshot::Sender in a DashMap keyed by ID, and awaits
///   the receiver. A background reader task parses JSON-RPC responses from
///   stdout, matches them by ID, and completes the corresponding oneshot.
///   This gives synchronous-style await semantics for every RPC call.
///
/// Benefits:
///   • **Build isolation** — ML deps (require protoc) live ONLY in the sidecar.
///     The main app builds with zero protoc requirement.
///   • **Crash isolation** — If candle segfaults or hf-hub OOMs, the main app
///     stays up. MlSidecarService auto-restarts the sidecar.
///   • **Memory isolation** — 500+ MB of model weights live in the sidecar
///     process. The main process stays lean (~60 MB).
///   • **Multi-window safe** — One sidecar serves all windows.
///   • **Graceful degradation** — When the sidecar binary doesn't exist
///     (e.g. source-build without ML deps), MlSidecarService logs a warning
///     and all AI commands return a clear "sidecar not available" error.
///
/// Gated behind `local-ai` so the core app never depends on candle/lancedb.
#[cfg(feature = "local-ai")]
pub struct MlSidecarService {
    handle: tauri::AppHandle,
    child: tokio::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    stdin_writer: tokio::sync::Mutex<Option<tauri_plugin_shell::process::CommandStdin>>,
    running: std::sync::atomic::AtomicBool,
    healthy: std::sync::atomic::AtomicBool,
    /// Maps JSON-RPC request IDs to oneshot senders for response matching.
    pending: Arc<dashmap::DashMap<u64, tokio::sync::oneshot::Sender<anyhow::Result<serde_json::Value>>>>,
    /// Monotonically increasing request ID counter.
    next_id: std::sync::atomic::AtomicU64,
}

#[cfg(feature = "local-ai")]
impl MlSidecarService {
    pub fn new(handle: tauri::AppHandle) -> Self {
        Self {
            handle,
            child: tokio::sync::Mutex::new(None),
            stdin_writer: tokio::sync::Mutex::new(None),
            running: std::sync::atomic::AtomicBool::new(false),
            healthy: std::sync::atomic::AtomicBool::new(false),
            pending: Arc::new(dashmap::DashMap::new()),
            next_id: std::sync::atomic::AtomicU64::new(1),
        }
    }

    /// Returns true if the sidecar process is currently running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Acquire)
    }

    /// Returns true if the sidecar has responded to a recent health check.
    pub fn is_healthy(&self) -> bool {
        self.healthy.load(Ordering::Acquire)
    }

    /// Send a JSON-RPC request to the sidecar and await the response.
    ///
    /// Uses a unique request ID + oneshot channel for synchronous-style IPC.
    /// The background reader task matches the response by ID and completes
    /// the oneshot. Timeout is 30 seconds for normal requests.
    pub async fn send_request(&self, method: &str, params: serde_json::Value) -> anyhow::Result<serde_json::Value> {
        let mut writer_guard = self.stdin_writer.lock().await;
        let writer = writer_guard.as_mut()
            .ok_or_else(|| anyhow::anyhow!("Sidecar not running"))?;

        let id = self.next_id.fetch_add(1, std::sync::atomic::Ordering::AcqRel);
        let (tx, rx) = tokio::sync::oneshot::channel::<anyhow::Result<serde_json::Value>>();

        // Register the pending response before writing — no race possible
        self.pending.insert(id, tx);

        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let line = serde_json::to_string(&request)?;
        writer.write_all(format!("{line}\n").as_bytes()).await
            .map_err(|e| {
                self.pending.remove(&id);
                anyhow::anyhow!("Failed to write to sidecar stdin: {e}")
            })?;

        // Flush to ensure the sidecar receives it immediately
        writer.flush().await.map_err(|e| {
            self.pending.remove(&id);
            anyhow::anyhow!("Failed to flush sidecar stdin: {e}")
        })?;

        // Await the response with a 30-second timeout
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(result)) => {
                self.healthy.store(true, Ordering::Release);
                Ok(result)
            }
            Ok(Err(e)) => {
                self.healthy.store(false, Ordering::Release);
                Err(anyhow::anyhow!("Sidecar request '{method}' failed: {e}"))
            }
            Err(_elapsed) => {
                self.pending.remove(&id);
                self.healthy.store(false, Ordering::Release);
                Err(anyhow::anyhow!("Sidecar request '{method}' timed out after 30s"))
            }
        }
    }

    /// Spawn the sidecar process and start the reader task.
    /// Returns Ok(()) on success, Err if binary is missing or spawn fails.
    async fn spawn_sidecar(&self) -> anyhow::Result<()> {
        let sidecar = self.handle.shell()
            .sidecar("ml-sidecar")
            .map_err(|e| anyhow::anyhow!("Failed to create sidecar command: {e}"))?;

        let (mut rx, child) = sidecar.spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn ml-sidecar: {e}"))?;

        *self.child.lock().await = Some(child.clone());

        // ── Shared state for the reader task ──────────────────────────
        let pending = self.pending.clone();
        let healthy_flag = self.healthy.clone();
        let running_flag = self.running.clone();
        let handle_clone = self.handle.clone();
        let restart_fn = self.make_restart_fn();

        tauri::async_runtime::spawn(async move {
            use tauri_plugin_shell::process::CommandEvent;
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        let text = String::from_utf8_lossy(&line);
                        let trimmed = text.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        // Parse JSON-RPC response
                        if let Ok(resp) = serde_json::from_str::<serde_json::Value>(trimmed) {
                            if let Some(resp_id) = resp.get("id").and_then(|v| v.as_u64()) {
                                // Match response to pending request
                                if let Some((_, tx)) = pending.remove(&resp_id) {
                                    if let Some(err) = resp.get("error") {
                                        let _ = tx.send(Err(anyhow::anyhow!(
                                            "{}", err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown error")
                                        )));
                                    } else {
                                        let result = resp.get("result").cloned().unwrap_or(serde_json::Value::Null);
                                        let _ = tx.send(Ok(result));
                                    }
                                    healthy_flag.store(true, Ordering::Release);
                                }
                            }
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        let text = String::from_utf8_lossy(&line);
                        log::info!("[ml-sidecar] {text}");
                    }
                    CommandEvent::Terminated(payload) => {
                        log::warn!("[ml-sidecar] Terminated (code={:?}, signal={:?})",
                            payload.code, payload.signal);
                        running_flag.store(false, Ordering::Release);
                        healthy_flag.store(false, Ordering::Release);
                        // Drain all pending requests with error
                        for item in pending.iter() {
                            let (_, tx) = item.pair();
                            let _ = tx.send(Err(anyhow::anyhow!("Sidecar terminated unexpectedly")));
                        }
                        pending.clear();
                        // Watchdog: auto-restart after 2 seconds
                        log::info!("[ml-sidecar] Watchdog: restarting in 2s...");
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                        restart_fn().await;
                        break;
                    }
                    CommandEvent::Error(err) => {
                        log::error!("[ml-sidecar] Error: {err}");
                        running_flag.store(false, Ordering::Release);
                        healthy_flag.store(false, Ordering::Release);
                        break;
                    }
                    _ => {}
                }
            }
        });

        // Store stdin writer for IPC
        if let Some(stdin) = child.stdin() {
            *self.stdin_writer.lock().await = Some(stdin);
        }

        // Send init with app data dir — the sidecar needs this to know
        // where to store models, vector DB, etc. This is a notification
        // (no response expected for init itself).
        if let Ok(dir) = self.handle.path().app_data_dir() {
            let init_params = serde_json::json!({
                "app_data_dir": dir.to_string_lossy()
            });
            // Use a fresh write (not send_request) since the pending map
            // and reader task are both set up and ready.
            if let Some(writer) = self.stdin_writer.lock().await.as_mut() {
                let init_req = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": 0u64,
                    "method": "init",
                    "params": init_params,
                });
                let line = serde_json::to_string(&init_req).unwrap_or_default();
                let _ = writer.write_all(format!("{line}\n").as_bytes()).await;
                let _ = writer.flush().await;
            }
        }

        self.running.store(true, Ordering::Release);
        self.healthy.store(true, Ordering::Release);

        log::info!("[ml-sidecar] Process spawned successfully");
        Ok(())
    }

    /// Create a restart closure that can be called from the reader task.
    /// The reader task owns the `child` handle so it can't call spawn_sidecar
    /// directly (which also needs child). Instead, use the AppHandle to
    /// get MlSidecarService from state and call restart on it.
    fn make_restart_fn(&self) -> Box<dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send> {
        let handle = self.handle.clone();
        Box::new(move || {
            let h = handle.clone();
            Box::pin(async move {
                if let Some(svc) = h.try_state::<Arc<MlSidecarService>>() {
                    log::info!("[ml-sidecar] Watchdog: executing restart...");
                    if let Err(e) = svc.restart().await {
                        log::error!("[ml-sidecar] Watchdog restart failed: {e}");
                    } else {
                        log::info!("[ml-sidecar] Watchdog: restart successful");
                    }
                }
            })
        })
    }

    /// Gracefully kill the current sidecar and spawn a new one.
    async fn restart(&self) -> anyhow::Result<()> {
        // Send graceful shutdown (best-effort)
        if self.running.load(Ordering::Acquire) {
            let _ = self.send_request("shutdown", serde_json::json!({})).await;
        }

        // Kill the old child
        if let Some(mut old_child) = self.child.lock().await.take() {
            let _ = old_child.kill().await;
        }
        *self.stdin_writer.lock().await = None;
        self.running.store(false, Ordering::Release);
        self.healthy.store(false, Ordering::Release);

        // Reinitialize stdout writer handle
        self.spawn_sidecar().await
    }
}

#[cfg(feature = "local-ai")]
#[async_trait]
impl Service for MlSidecarService {
    fn name(&self) -> &'static str { "ml-sidecar" }
    fn priority(&self) -> u32 { 50 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[ml-sidecar] Initializing service...");
        match self.spawn_sidecar().await {
            Ok(()) => {
                // Verify with a ping after spawn
                match self.send_request("ping", serde_json::json!({})).await {
                    Ok(resp) => {
                        log::info!("[ml-sidecar] Health check OK: {resp}");
                        self.healthy.store(true, Ordering::Release);
                    }
                    Err(e) => {
                        log::warn!("[ml-sidecar] Initial ping failed (sidecar may still be starting): {e}");
                        // Non-fatal — health monitor will retry
                    }
                }
                log::info!("[ml-sidecar] Sidecar process started");
            }
            Err(e) => {
                log::warn!("[ml-sidecar] Could not start sidecar (AI will use in-process fallback): {e}");
            }
        }
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        log::info!("[ml-sidecar] Service started");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        log::info!("[ml-sidecar] Stopping sidecar...");
        self.running.store(false, std::sync::atomic::Ordering::Release);
        self.healthy.store(false, std::sync::atomic::Ordering::Release);

        // Send graceful shutdown (best-effort)
        let _ = self.send_request("shutdown", serde_json::json!({})).await;

        // Kill the child process
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await;
        }
        *self.stdin_writer.lock().await = None;

        log::info!("[ml-sidecar] Stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        if !self.running.load(std::sync::atomic::Ordering::Acquire) {
            log::info!("[ml-sidecar] Health check: not running, attempting restart...");
            match self.restart().await {
                Ok(()) => {
                    self.healthy.store(true, Ordering::Release);
                    super::HealthStatus::Healthy
                }
                Err(e) => {
                    super::HealthStatus::Degraded(format!("ml-sidecar crashed and restart failed: {e}"))
                }
            }
        } else {
            // Send an actual ping to verify the sidecar is responsive
            match self.send_request("ping", serde_json::json!({})).await {
                Ok(resp) => {
                    log::trace!("[ml-sidecar] Ping OK: {resp}");
                    self.healthy.store(true, Ordering::Release);
                    super::HealthStatus::Healthy
                }
                Err(e) => {
                    log::warn!("[ml-sidecar] Health check ping failed: {e}");
                    self.healthy.store(false, Ordering::Release);
                    super::HealthStatus::Degraded(format!("ml-sidecar ping failed: {e}"))
                }
            }
        }
    }
}

// ── SidecarClient ───────────────────────────────────────────────────────────
/// IPC client for forwarding AI requests to the ml-sidecar process.
/// Used by `commands/ai.rs` when the sidecar is running.
/// Falls back to in-process AiState when the sidecar is unavailable.
#[cfg(feature = "local-ai")]
pub struct SidecarClient {
    service: Arc<MlSidecarService>,
}

#[cfg(feature = "local-ai")]
impl SidecarClient {
    pub fn new(service: Arc<MlSidecarService>) -> Self {
        Self { service }
    }

    pub fn is_available(&self) -> bool {
        self.service.is_running() && self.service.is_healthy()
    }

    pub async fn ping(&self) -> anyhow::Result<bool> {
        let resp = self.service.send_request("ping", serde_json::json!({})).await?;
        Ok(resp.get("pong").and_then(|v| v.as_bool()).unwrap_or(false))
    }

    pub async fn load_embedding_model(&self, repo_id: &str) -> anyhow::Result<()> {
        let resp = self.service.send_request("load_embedding_model", serde_json::json!({
            "repo_id": repo_id,
        })).await?;
        if let Some(status) = resp.get("status").and_then(|v| v.as_str()) {
            if status != "loaded" {
                anyhow::bail!("Sidecar load_embedding_model failed: {status}");
            }
        }
        Ok(())
    }

    pub async fn embed(&self, texts: Vec<String>) -> anyhow::Result<Vec<Vec<f32>>> {
        let resp = self.service.send_request("embed", serde_json::json!({
            "texts": texts,
        })).await?;
        resp.get("embeddings")
            .ok_or_else(|| anyhow::anyhow!("Sidecar embed response missing 'embeddings'"))?
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value::<Vec<f32>>(v.clone()).ok())
                    .collect()
            })
            .ok_or_else(|| anyhow::anyhow!("Sidecar embed response invalid format"))
    }

    pub async fn ensure_vector_db(&self, db_path: &str) -> anyhow::Result<()> {
        self.service.send_request("ensure_vector_db", serde_json::json!({
            "db_path": db_path,
        })).await?;
        Ok(())
    }

    pub async fn index_vectors(&self, vectors: Vec<Vec<f32>>, metadata: Vec<serde_json::Value>) -> anyhow::Result<()> {
        let resp = self.service.send_request("index_vectors", serde_json::json!({
            "vectors": vectors,
            "metadata": metadata,
        })).await?;
        log::debug!("[sidecar-client] index_vectors: {resp}");
        Ok(())
    }

    pub async fn query_rag(&self, query: &str, top_k: u64) -> anyhow::Result<serde_json::Value> {
        self.service.send_request("query_rag", serde_json::json!({
            "query": query,
            "top_k": top_k,
        })).await
    }

    pub async fn parse_document(&self, path: &str) -> anyhow::Result<String> {
        let resp = self.service.send_request("parse_document", serde_json::json!({
            "path": path,
        })).await?;
        Ok(resp.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string())
    }
}

// ── StubService ─────────────────────────────────────────────────────────────
/// Placeholder for future subsystems that don't yet have a full implementation.
/// Allows early registration in SubsystemRegistry for observability + gating.
pub struct StubService {
    name: &'static str,
    message: &'static str,
}

impl StubService {
    pub fn new(name: &'static str, message: &'static str) -> Self {
        Self { name, message }
    }
}

#[async_trait]
impl Service for StubService {
    fn name(&self) -> &'static str { self.name }
    fn priority(&self) -> u32 { 100 }
    fn is_critical(&self) -> bool { false }

    async fn init(&self) -> anyhow::Result<()> {
        log::info!("[{}] Stub initialized — {}", self.name, self.message);
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        log::warn!("[{}] Stub start called — subsystem not implemented: {}", self.name, self.message);
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        log::debug!("[{}] Stub stop called", self.name);
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        HealthStatus::Degraded(format!("not implemented: {}", self.message))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::AppEvent;

    // ── SyncMonitorService: construction and initial state ─────────

    #[test]
    fn test_sync_monitor_new() {
        let monitor = SyncMonitorService::new();
        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 0);
        assert_eq!(summary.failed_syncs, 0);
        assert_eq!(summary.success_rate_percent, 100.0);
        assert!(summary.last_error.is_none());
        assert!(summary.last_sync_at.is_none());
    }

    // ── SyncMonitorService: on_event with sync complete ────────────

    #[test]
    fn test_sync_monitor_sync_complete() {
        let monitor = SyncMonitorService::new();

        monitor.on_event(&AppEvent::SyncComplete {
            account_id: "acc1".to_string(),
            new_count: 5,
        });

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 1);
        assert_eq!(summary.failed_syncs, 0);
        assert_eq!(summary.success_rate_percent, 100.0);
        assert!(summary.last_sync_at.is_some());
    }

    #[test]
    fn test_sync_monitor_account_complete() {
        let monitor = SyncMonitorService::new();

        monitor.on_event(&AppEvent::SyncAccountComplete {
            account_id: "acc1".to_string(),
            new_count: 10,
        });

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 1);
        assert_eq!(summary.failed_syncs, 0);
    }

    // ── SyncMonitorService: on_event with errors ───────────────────

    #[test]
    fn test_sync_monitor_sync_error() {
        let monitor = SyncMonitorService::new();

        monitor.on_event(&AppEvent::SyncError {
            account_id: "acc1".to_string(),
            error: "Connection timeout".to_string(),
        });

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 0);
        assert_eq!(summary.failed_syncs, 1);
        assert_eq!(summary.last_error.as_deref(), Some("Connection timeout"));
        assert!(summary.last_sync_at.is_some());
    }

    #[test]
    fn test_sync_monitor_account_error() {
        let monitor = SyncMonitorService::new();

        monitor.on_event(&AppEvent::SyncAccountError {
            account_id: "acc1".to_string(),
            error: "Auth failed".to_string(),
        });

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 0);
        assert_eq!(summary.failed_syncs, 1);
        assert_eq!(summary.last_error.as_deref(), Some("Auth failed"));
    }

    // ── SyncMonitorService: mixed events ───────────────────────────

    #[test]
    fn test_sync_monitor_mixed_events() {
        let monitor = SyncMonitorService::new();

        // 3 successful syncs
        for i in 0..3 {
            monitor.on_event(&AppEvent::SyncComplete {
                account_id: format!("acc{}", i),
                new_count: 1,
            });
        }
        // 1 failure
        monitor.on_event(&AppEvent::SyncError {
            account_id: "acc0".to_string(),
            error: "timeout".to_string(),
        });

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 3);
        assert_eq!(summary.failed_syncs, 1);
        // success rate = (3 - 1) / 3 * 100 = 66.67%
        assert!(summary.success_rate_percent > 66.0);
        assert!(summary.success_rate_percent < 67.0);
    }

    #[test]
    fn test_sync_monitor_success_rate_one_hundred() {
        let monitor = SyncMonitorService::new();

        monitor.on_event(&AppEvent::SyncComplete {
            account_id: "acc1".to_string(),
            new_count: 1,
        });

        let summary = monitor.health_summary();
        assert_eq!(summary.success_rate_percent, 100.0);
    }

    #[test]
    fn test_sync_monitor_success_rate_zero() {
        let monitor = SyncMonitorService::new();

        // All failures
        for i in 0..5 {
            monitor.on_event(&AppEvent::SyncError {
                account_id: format!("acc{}", i),
                error: "fail".to_string(),
            });
        }

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 0);
        assert_eq!(summary.failed_syncs, 5);
        assert_eq!(summary.success_rate_percent, 100.0); // total == 0 → 100%
    }

    // ── SyncMonitorService: health_check method ────────────────────

    #[tokio::test]
    async fn test_sync_monitor_health_check_healthy() {
        let monitor = SyncMonitorService::new();

        // No syncs yet → 100% rate → Healthy
        let status = monitor.health_check().await;
        assert_eq!(status, HealthStatus::Healthy);
    }

    #[tokio::test]
    async fn test_sync_monitor_health_check_degraded_mild() {
        let monitor = SyncMonitorService::new();

        // 10 syncs, 2 failures → 80% success rate → Degraded (between 50-90%)
        for _ in 0..8 {
            monitor.on_event(&AppEvent::SyncComplete {
                account_id: "acc1".to_string(),
                new_count: 1,
            });
        }
        for _ in 0..2 {
            monitor.on_event(&AppEvent::SyncError {
                account_id: "acc1".to_string(),
                error: "timeout".to_string(),
            });
        }

        let status = monitor.health_check().await;
        assert!(matches!(status, HealthStatus::Degraded(ref msg) if msg.contains("degraded")));
    }

    #[tokio::test]
    async fn test_sync_monitor_health_check_critical() {
        let monitor = SyncMonitorService::new();

        // 10 syncs, 6 failures → 40% success rate → Degraded (below 50%)
        for _ in 0..4 {
            monitor.on_event(&AppEvent::SyncComplete {
                account_id: "acc1".to_string(),
                new_count: 1,
            });
        }
        for _ in 0..6 {
            monitor.on_event(&AppEvent::SyncError {
                account_id: "acc1".to_string(),
                error: "crash".to_string(),
            });
        }

        let status = monitor.health_check().await;
        assert!(matches!(status, HealthStatus::Degraded(ref msg) if msg.contains("critically low")));
    }

    // ── SyncMonitorService: ignores irrelevant events ──────────────

    #[test]
    fn test_sync_monitor_ignores_non_sync_events() {
        let monitor = SyncMonitorService::new();

        monitor.on_event(&AppEvent::InitComplete);
        monitor.on_event(&AppEvent::ConnectivityChanged { online: true });
        monitor.on_event(&AppEvent::Heartbeat { timestamp: 123 });

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 0);
        assert_eq!(summary.failed_syncs, 0);
    }

    // ── SyncMonitorService: lifecycle (trait methods) ──────────────

    #[tokio::test]
    async fn test_sync_monitor_lifecycle() {
        let monitor = SyncMonitorService::new();
        monitor.init().await.unwrap();
        monitor.start().await.unwrap();
        monitor.stop().await.unwrap();
        // After stop, summary should still be accessible
        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 0);
    }

    // ── SyncHealthSummary serialization ────────────────────────────

    #[test]
    fn test_sync_health_summary_serialization() {
        let summary = SyncHealthSummary {
            total_syncs: 42,
            failed_syncs: 3,
            success_rate_percent: 92.86,
            last_error: Some("timeout".to_string()),
            last_sync_at: Some(1700000000),
        };
        let json = serde_json::to_string(&summary).unwrap();
        assert!(json.contains("42"));
        assert!(json.contains("3"));
        assert!(json.contains("timeout"));
        assert!(json.contains("1700000000"));

        let deserialized: SyncHealthSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.total_syncs, 42);
        assert_eq!(deserialized.failed_syncs, 3);
    }

    // ── SyncMonitorService: atomic counters are thread-safe ────────

    #[test]
    fn test_sync_monitor_concurrent_updates() {
        let monitor = Arc::new(SyncMonitorService::new());
        let mut handles = vec![];

        for i in 0..10 {
            let m = monitor.clone();
            handles.push(std::thread::spawn(move || {
                m.on_event(&AppEvent::SyncComplete {
                    account_id: format!("acc{}", i),
                    new_count: 1,
                });
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        let summary = monitor.health_summary();
        assert_eq!(summary.total_syncs, 10);
    }
}
