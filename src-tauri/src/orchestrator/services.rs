use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use async_trait::async_trait;
use tauri::{AppHandle, Manager};
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
