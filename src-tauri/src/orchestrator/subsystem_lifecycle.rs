use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use dashmap::{DashMap, DashSet};
use serde::Serialize;
use tauri::AppHandle;

use crate::orchestrator::service::Service;
use crate::errors::AppError;

/// SubsystemStatus mirrors the spec exactly.
/// Does NOT derive Serialize/Deserialize because std::time::Instant
/// does not implement those traits. Use `SubsystemStatusSnapshot`
/// for IPC serialization instead.
#[derive(Debug, Clone)]
pub enum SubsystemStatus {
    Inactive { reason: String },
    Dormant { reason: String },
    Starting { since: Instant },
    Active { started_at: Instant },
    ShuttingDown { since: Instant },
    Failed { error: String, since: Instant },
}

/// 3-tier classification for lifecycle semantics.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubsystemClass {
    AlwaysOn,
    Lazy,
    OnDemand,
}

/// Discriminated union for how the service is held.
pub enum ServiceHandle {
    /// Lazy: pre-built instance, reused.
    Lazy(Arc<dyn Service>),
    /// OnDemand: factory called on each activation.
    OnDemand(Box<dyn Fn() -> Arc<dyn Service> + Send + Sync>),
}

/// One entry per subsystem.
pub struct SubsystemEntry {
    pub name: String,
    pub class: SubsystemClass,
    pub feature_flag: Option<&'static str>,
    pub service_handle: ServiceHandle,
    pub status: Arc<RwLock<SubsystemStatus>>,
    /// Serializes concurrent activation calls.
    pub activation_lock: Arc<tokio::sync::Mutex<()>>,
    /// Idle grace period. None = no idle shutdown.
    pub idle_grace: Option<Duration>,
}

impl SubsystemEntry {
    pub fn new_lazy(
        name: impl Into<String>,
        feature_flag: Option<&'static str>,
        service: Arc<dyn Service>,
        idle_grace: Option<Duration>,
    ) -> Self {
        Self {
            name: name.into(),
            class: SubsystemClass::Lazy,
            feature_flag,
            service_handle: ServiceHandle::Lazy(service),
            status: Arc::new(RwLock::new(SubsystemStatus::Inactive {
                reason: "not yet enabled".to_string(),
            })),
            activation_lock: Arc::new(tokio::sync::Mutex::new(())),
            idle_grace,
        }
    }

    pub fn new_ondemand(
        name: impl Into<String>,
        feature_flag: Option<&'static str>,
        factory: Box<dyn Fn() -> Arc<dyn Service> + Send + Sync>,
    ) -> Self {
        Self {
            name: name.into(),
            class: SubsystemClass::OnDemand,
            feature_flag,
            service_handle: ServiceHandle::OnDemand(factory),
            status: Arc::new(RwLock::new(SubsystemStatus::Inactive {
                reason: "not yet enabled".to_string(),
            })),
            activation_lock: Arc::new(tokio::sync::Mutex::new(())),
            idle_grace: None,
        }
    }
}

/// Status snapshot for IPC responses.
#[derive(Debug, Clone, Serialize)]
pub struct SubsystemStatusSnapshot {
    pub name: String,
    pub class: String,
    pub status: String,
    pub reason: String,
    pub uptime_secs: Option<u64>,
    pub error: Option<String>,
    pub feature_flag: Option<String>,
}

pub struct SubsystemRegistry {
    entries: DashMap<String, Arc<SubsystemEntry>>,
    #[allow(dead_code)]
    app_handle: Option<AppHandle>,
    /// Typed handle storage for downcast retrieval of concrete service handles.
    handles: Arc<DashMap<String, Box<dyn std::any::Any + Send + Sync + 'static>>>,
    /// Runtime feature flags (e.g. "ai", "pairing", "campaigns") that gate
    /// whether a subsystem with that flag can be activated. Set during init.
    /// Checked by `gating::require_subsystem_active`.
    enabled_features: Arc<DashSet<&'static str>>,
}

impl SubsystemRegistry {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            entries: DashMap::new(),
            app_handle: Some(app_handle),
            handles: Arc::new(DashMap::new()),
            enabled_features: Arc::new(DashSet::new()),
        }
    }

    /// Test-only constructor that avoids requiring an AppHandle.
    #[cfg(test)]
    pub fn new_test() -> Self {
        Self {
            entries: DashMap::new(),
            app_handle: None,
            handles: Arc::new(DashMap::new()),
            enabled_features: Arc::new(DashSet::new()),
        }
    }

    // ── Runtime Feature Flag API ─────────────────────────────────────

    /// Mark a feature flag as enabled at runtime.
    /// When a subsystem's `feature_flag` matches an enabled flag, it can be
    /// activated. Otherwise `require_active` will return `SubsystemInactive`.
    pub fn enable_feature(&self, flag: &'static str) {
        self.enabled_features.insert(flag);
    }

    /// Mark a feature flag as disabled.
    pub fn disable_feature(&self, flag: &'static str) {
        self.enabled_features.remove(flag);
    }

    /// Check whether a specific feature flag is currently enabled.
    pub fn is_feature_enabled(&self, flag: &str) -> bool {
        self.enabled_features.contains(flag)
    }

    /// Return a snapshot of all currently-enabled feature flags.
    pub fn enabled_feature_flags(&self) -> Vec<&'static str> {
        self.enabled_features.iter().map(|e| *e).collect()
    }

    /// Register a Lazy subsystem (pre-built, init at boot, start on demand).
    pub fn register_lazy(&self, entry: SubsystemEntry) {
        let name = entry.name.clone();
        self.entries.insert(name, Arc::new(entry));
    }

    /// Register an OnDemand subsystem (built on first use).
    pub fn register_ondemand(&self, entry: SubsystemEntry) {
        let name = entry.name.clone();
        self.entries.insert(name, Arc::new(entry));
    }

    /// Register an externally-managed subsystem for observability only.
    /// The service's lifecycle is managed by ServiceRegistry (AlwaysOn).
    /// Status is pre-set to Active, so SubsystemRegistry never calls start/stop.
    pub fn register_observed(&self, name: impl Into<String>, feature_flag: Option<&'static str>, service: Arc<dyn Service>) {
        let entry_name: String = name.into();
        let entry = SubsystemEntry {
            name: entry_name.clone(),
            class: SubsystemClass::Lazy,
            feature_flag,
            service_handle: ServiceHandle::Lazy(service),
            status: Arc::new(RwLock::new(SubsystemStatus::Active {
                started_at: Instant::now(),
            })),
            activation_lock: Arc::new(tokio::sync::Mutex::new(())),
            idle_grace: None,
        };
        self.entries.insert(entry_name, Arc::new(entry));
    }

    /// CAS-based activation. Returns Ok(()) if Active/Starting/Dormant.
    /// On Dormant: builds OnDemand if needed, calls start(), CAS to Active.
    /// On failure: CAS to Failed, return error.
    ///
    /// Feature flag check: if the entry has a `feature_flag` set, this method
    /// checks the registry's `enabled_features` set. If the flag is not enabled,
    /// returns `SubsystemInactive` — the subsystem exists but is gated off.
    pub async fn require_active(&self, name: &str) -> Result<(), AppError> {
        // Get entry Arc (clone to avoid borrowing DashMap across awaits)
        let entry = self.entries.get(name)
            .map(|r| r.clone())
            .ok_or_else(|| AppError::SubsystemNotFound { name: name.to_string() })?;

        // ── Runtime feature flag check ───────────────────────────────
        if let Some(flag) = entry.feature_flag {
            if !self.enabled_features.contains(flag) {
                return Err(AppError::SubsystemInactive {
                    tool: Some(flag),
                    reason: format!("feature flag '{flag}' is not enabled at runtime"),
                });
            }
        }

        // Acquire activation lock to serialize concurrent callers
        let _guard = entry.activation_lock.lock().await;

        // Read current status (clone to release lock quickly)
        let status = entry.status.read().await.clone();

        match status {
            // Already active — nothing to do
            SubsystemStatus::Active { .. } => Ok(()),

            // Already starting — another caller is activating, wait briefly
            SubsystemStatus::Starting { .. } => {
                drop(_guard);
                tokio::time::sleep(Duration::from_millis(500)).await;
                let status = entry.status.read().await.clone();
                match status {
                    SubsystemStatus::Active { .. } => Ok(()),
                    SubsystemStatus::Failed { error, .. } => Err(AppError::SubsystemUnavailable {
                        name: name.to_string(),
                        status: "failed".to_string(),
                        message: error,
                    }),
                    _ => Err(AppError::SubsystemUnavailable {
                        name: name.to_string(),
                        status: "timeout".to_string(),
                        message: "activation timed out".to_string(),
                    }),
                }
            }

            // Already shutting down — wait for it to finish, then activate
            SubsystemStatus::ShuttingDown { .. } => {
                drop(_guard);
                tokio::time::sleep(Duration::from_secs(2)).await;
                let status = entry.status.read().await.clone();
                match status {
                    SubsystemStatus::Active { .. } => Ok(()),
                    SubsystemStatus::Dormant { .. } => {
                        drop(entry);
                        // Inline the activation from Dormant to avoid async recursion
                        return self.activate_dormant(name).await;
                    }
                    _ => Err(AppError::SubsystemUnavailable {
                        name: name.to_string(),
                        status: "shutting_down".to_string(),
                        message: "subsystem is shutting down".to_string(),
                    }),
                }
            }

            // Failed — report unavailable
            SubsystemStatus::Failed { error, .. } => Err(AppError::SubsystemUnavailable {
                name: name.to_string(),
                status: "failed".to_string(),
                message: error,
            }),

            // Inactive — cannot activate (system not Ready)
            SubsystemStatus::Inactive { reason } => Err(AppError::SubsystemInactive {
                tool: entry.feature_flag,
                reason,
            }),

            // Dormant — need to start it
            SubsystemStatus::Dormant { .. } => {
                drop(_guard);
                drop(entry);
                self.activate_dormant(name).await
            }
        }
    }

    /// Helper: activate a Dormant subsystem (no lock held).
    /// Extracted to avoid async recursion in require_active.
    async fn activate_dormant(&self, name: &str) -> Result<(), AppError> {
        // Re-acquire entry and lock
        let entry = self.entries.get(name)
            .map(|r| r.clone())
            .ok_or_else(|| AppError::SubsystemNotFound { name: name.to_string() })?;

        // CAS to Starting
        {
            let mut status = entry.status.write().await;
            // Double-check dormant (race guard: status may have changed)
            if !matches!(*status, SubsystemStatus::Dormant { .. }) {
                let msg = format!("status changed before activation lock");
                log::warn!("[subsystem] {} {}", name, msg);
                *status = SubsystemStatus::Failed {
                    error: msg.clone(),
                    since: Instant::now(),
                };
                return Err(AppError::SubsystemUnavailable {
                    name: name.to_string(),
                    status: "race".to_string(),
                    message: msg,
                });
            }
            *status = SubsystemStatus::Starting { since: Instant::now() };
        }

        // Build or get service
        let service: Arc<dyn Service> = match &entry.service_handle {
            ServiceHandle::Lazy(svc) => svc.clone(),
            ServiceHandle::OnDemand(factory) => factory(),
        };

        // Call start()
        match service.start().await {
            Ok(()) => {
                let mut status = entry.status.write().await;
                *status = SubsystemStatus::Active { started_at: Instant::now() };
                log::info!("[subsystem] {} activated", name);
                Ok(())
            }
            Err(e) => {
                let mut status = entry.status.write().await;
                *status = SubsystemStatus::Failed {
                    error: e.to_string(),
                    since: Instant::now(),
                };
                log::error!("[subsystem] {} failed to start: {}", name, e);
                Err(AppError::SubsystemUnavailable {
                    name: name.to_string(),
                    status: "failed".to_string(),
                    message: e.to_string(),
                })
            }
        }
    }

    /// Transition all Lazy entries from Inactive → Dormant.
    /// Called after StateMachine::Ready transition.
    pub async fn enable_ready_subsystems(&self) {
        for entry in self.entries.iter() {
            let should_enable = match entry.value().class {
                SubsystemClass::AlwaysOn => {
                    log::warn!("[subsystem] {} is AlwaysOn — should not be in SubsystemRegistry", entry.key());
                    false
                }
                SubsystemClass::OnDemand => false, // built on first use
                SubsystemClass::Lazy => true,
            };

            if should_enable {
                let mut status = entry.status.write().await;
                if matches!(*status, SubsystemStatus::Inactive { .. }) {
                    *status = SubsystemStatus::Dormant {
                        reason: "ready".to_string(),
                    };
                    log::info!("[subsystem] {} enabled (Dormant)", entry.key());
                }
            }
        }
    }

    /// Force-immediate shutdown. Called when a tool is disabled.
    pub async fn force_shutdown(&self, name: &str) -> Result<(), AppError> {
        let entry = self.entries.get(name)
            .map(|r| r.clone())
            .ok_or_else(|| AppError::SubsystemNotFound { name: name.to_string() })?;

        let service: Option<Arc<dyn Service>> = match &entry.service_handle {
            ServiceHandle::Lazy(svc) => Some(svc.clone()),
            ServiceHandle::OnDemand(_) => None,
        };

        // CAS to ShuttingDown
        {
            let mut status = entry.status.write().await;
            *status = SubsystemStatus::ShuttingDown { since: Instant::now() };
        }

        // Stop immediately (no grace period)
        if let Some(svc) = service {
            if let Err(e) = svc.stop().await {
                log::warn!("[subsystem] {} stop error on force_shutdown: {}", name, e);
            }
        }

        // CAS to Inactive
        {
            let mut status = entry.status.write().await;
            *status = SubsystemStatus::Inactive {
                reason: "tool disabled".to_string(),
            };
        }

        log::info!("[subsystem] {} force_shutdown complete", name);
        Ok(())
    }

    /// Restart a named subsystem and return its post-restart status snapshot.
    ///
    /// Real implementation (not a no-op):
    /// 1. Look up the entry by name (returns `AppError::SubsystemNotFound` if missing).
    /// 2. `force_shutdown(name)` stops it (status → Inactive).
    /// 3. Re-activate per class:
    ///    - `Lazy`: set status back to `Dormant` with reason "restart requested"
    ///      (mirrors `enable_ready_subsystems` for a single entry). The next
    ///      `require_active` will start it again.
    ///    - `OnDemand`: leave as `Inactive` — it restarts on next demand.
    ///    - `AlwaysOn`: not expected in this registry; return an error rather than
    ///      silently leaving it stopped.
    /// 4. Build and return the entry's `SubsystemStatusSnapshot`.
    pub async fn restart_subsystem(&self, name: &str) -> Result<SubsystemStatusSnapshot, AppError> {
        // 1. Lookup (also validates the name exists before we touch anything).
        let entry = self.entries.get(name)
            .map(|r| r.clone())
            .ok_or_else(|| AppError::SubsystemNotFound { name: name.to_string() })?;

        // 2. Stop it.
        self.force_shutdown(name).await?;

        // 3. Re-activate per class.
        match entry.class {
            SubsystemClass::AlwaysOn => {
                return Err(AppError::SubsystemUnavailable {
                    name: name.to_string(),
                    status: "always_on".to_string(),
                    message: "AlwaysOn subsystems are managed externally and cannot be restarted via this command".to_string(),
                });
            }
            SubsystemClass::Lazy => {
                let mut status = entry.status.write().await;
                *status = SubsystemStatus::Dormant {
                    reason: "restart requested".to_string(),
                };
                log::info!("[subsystem] {} restarted (Dormant)", name);
            }
            SubsystemClass::OnDemand => {
                // Already Inactive after force_shutdown — it will rebuild on next demand.
                log::info!("[subsystem] {} restarted (Inactive, on-demand)", name);
            }
        }

        // 4. Build the snapshot for this single entry (reuse get_all_status logic).
        Ok(self.get_status_for(name))
    }

    /// Build a `SubsystemStatusSnapshot` for a single named subsystem.
    ///
    /// Returns a snapshot with status "unknown" if the entry exists but its
    /// status lock is contended. Panics are avoided by using `try_read`.
    pub fn get_status_for(&self, name: &str) -> SubsystemStatusSnapshot {
        let entry = match self.entries.get(name) {
            Some(e) => e.clone(),
            None => return SubsystemStatusSnapshot {
                name: name.to_string(),
                class: "unknown".to_string(),
                status: "not_found".to_string(),
                reason: "subsystem not registered".to_string(),
                uptime_secs: None,
                error: None,
                feature_flag: None,
            },
        };

        let class = match entry.class {
            SubsystemClass::AlwaysOn => "always_on",
            SubsystemClass::Lazy => "lazy",
            SubsystemClass::OnDemand => "on_demand",
        };

        let status_snapshot = match entry.status.try_read() {
            Ok(status) => status.clone(),
            Err(_) => return SubsystemStatusSnapshot {
                name: entry.name.clone(),
                class: class.to_string(),
                status: "unknown".to_string(),
                reason: "status lock contended".to_string(),
                uptime_secs: None,
                error: None,
                feature_flag: entry.feature_flag.map(|s| s.to_string()),
            },
        };

        let (status_str, reason, uptime_secs, error) = match status_snapshot {
            SubsystemStatus::Inactive { reason } => ("inactive", reason, None, None),
            SubsystemStatus::Dormant { reason } => ("dormant", reason, None, None),
            SubsystemStatus::Starting { .. } => {
                ("starting", "activation in progress".to_string(), None, None)
            }
            SubsystemStatus::Active { started_at } => (
                "active",
                "running".to_string(),
                Some(started_at.elapsed().as_secs()),
                None,
            ),
            SubsystemStatus::ShuttingDown { .. } => {
                ("shutting_down", "grace period".to_string(), None, None)
            }
            SubsystemStatus::Failed { error, .. } => {
                ("failed", "error".to_string(), None, Some(error))
            }
        };
        SubsystemStatusSnapshot {
            name: entry.name.clone(),
            class: class.to_string(),
            status: status_str.to_string(),
            reason,
            uptime_secs,
            error,
            feature_flag: entry.feature_flag.map(|s| s.to_string()),
        }
    }

    /// Report idle: start the grace period timer.
    pub async fn report_idle(&self, name: &str) {
        let entry = match self.entries.get(name) {
            Some(e) => e.clone(),
            None => return,
        };

        // Check if active
        let is_active = matches!(
            *entry.status.read().await,
            SubsystemStatus::Active { .. }
        );
        if !is_active {
            return;
        }

        // CAS to ShuttingDown
        {
            let mut status = entry.status.write().await;
            if !matches!(*status, SubsystemStatus::Active { .. }) {
                return; // Changed between check and CAS
            }
            *status = SubsystemStatus::ShuttingDown { since: Instant::now() };
        }

        // Spawn idle timer — clone what we need
        let name_owned = name.to_string();
        let grace = entry.idle_grace;
        let entry_status = entry.status.clone();
        let entry_service = match &entry.service_handle {
            ServiceHandle::Lazy(svc) => Some(svc.clone()),
            ServiceHandle::OnDemand(_) => None,
        };

        tokio::spawn(async move {
            if let Some(grace_duration) = grace {
                tokio::time::sleep(grace_duration).await;
            } else {
                // No grace period — idle shutdown disabled
                return;
            }

            // Re-check status after sleep
            let still_shutting_down = matches!(
                *entry_status.read().await,
                SubsystemStatus::ShuttingDown { .. }
            );

            if still_shutting_down {
                // Stop the service
                if let Some(svc) = entry_service {
                    let _ = svc.stop().await;
                }
                // CAS to Dormant
                let mut status = entry_status.write().await;
                *status = SubsystemStatus::Dormant {
                    reason: "idle shutdown".to_string(),
                };
                log::info!("[subsystem] {} idle shutdown complete", name_owned);
            }
        });
    }

    /// Check if a subsystem is currently Active.
    pub async fn is_active(&self, name: &str) -> bool {
        if let Some(entry) = self.entries.get(name) {
            matches!(*entry.status.read().await, SubsystemStatus::Active { .. })
        } else {
            false
        }
    }

    /// Store a concrete typed handle (e.g., `Arc<SentinelService>`) for downcast retrieval.
    pub fn store_handle<T: Send + Sync + 'static>(&self, name: &str, handle: Arc<T>) {
        self.handles.insert(name.to_string(), Box::new(handle));
    }

    /// Retrieve a concrete typed handle previously stored with `store_handle()`.
    pub fn get_handle<T: Send + Sync + 'static>(&self, name: &str) -> Option<Arc<T>> {
        self.handles
            .get(name)
            .and_then(|b| b.downcast_ref::<Arc<T>>().cloned())
    }

    /// Get all subsystem status snapshots (for IPC).
    pub fn get_all_status(&self) -> Vec<SubsystemStatusSnapshot> {
        self.entries
            .iter()
            .map(|entry| {
                let entry = entry.value();
                let class = match entry.class {
                    SubsystemClass::AlwaysOn => "always_on",
                    SubsystemClass::Lazy => "lazy",
                    SubsystemClass::OnDemand => "on_demand",
                };

                // Use try_read to avoid blocking in sync context
                let status_snapshot = match entry.status.try_read() {
                    Ok(status) => status.clone(),
                    Err(_) => return SubsystemStatusSnapshot {
                        name: entry.name.clone(),
                        class: class.to_string(),
                        status: "unknown".to_string(),
                        reason: "status lock contended".to_string(),
                        uptime_secs: None,
                        error: None,
                        feature_flag: entry.feature_flag.map(|s| s.to_string()),
                    },
                };

                let (status_str, reason, uptime_secs, error) = match status_snapshot {
                    SubsystemStatus::Inactive { reason } => ("inactive", reason, None, None),
                    SubsystemStatus::Dormant { reason } => ("dormant", reason, None, None),
                    SubsystemStatus::Starting { .. } => {
                        ("starting", "activation in progress".to_string(), None, None)
                    }
                    SubsystemStatus::Active { started_at } => (
                        "active",
                        "running".to_string(),
                        Some(started_at.elapsed().as_secs()),
                        None,
                    ),
                    SubsystemStatus::ShuttingDown { .. } => {
                        ("shutting_down", "grace period".to_string(), None, None)
                    }
                    SubsystemStatus::Failed { error, .. } => {
                        ("failed", "error".to_string(), None, Some(error))
                    }
                };
                SubsystemStatusSnapshot {
                    name: entry.name.clone(),
                    class: class.to_string(),
                    status: status_str.to_string(),
                    reason,
                    uptime_secs,
                    error,
                    feature_flag: entry.feature_flag.map(|s| s.to_string()),
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use crate::orchestrator::service::HealthStatus;

    struct MockService {
        start_count: AtomicUsize,
        stop_count: AtomicUsize,
    }

    impl MockService {
        fn new() -> Self {
            Self {
                start_count: AtomicUsize::new(0),
                stop_count: AtomicUsize::new(0),
            }
        }
    }

    #[async_trait::async_trait]
    impl Service for MockService {
        fn name(&self) -> &'static str { "mock" }
        async fn init(&self) -> anyhow::Result<()> { Ok(()) }
        async fn start(&self) -> anyhow::Result<()> {
            self.start_count.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
        async fn stop(&self) -> anyhow::Result<()> {
            self.stop_count.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
        async fn health_check(&self) -> HealthStatus { HealthStatus::Healthy }
    }

    #[tokio::test]
    async fn test_require_active_on_inactive_returns_error() {
        let registry = SubsystemRegistry::new_test();
        registry.register_lazy(SubsystemEntry::new_lazy(
            "test_service",
            None,
            Arc::new(MockService::new()),
            None,
        ));

        // Not yet enabled — should return SubsystemInactive
        let result = registry.require_active("test_service").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::SubsystemInactive { tool, .. } => {
                assert_eq!(tool, None);
            }
            _ => panic!("expected SubsystemInactive"),
        }
    }

    #[tokio::test]
    async fn test_enable_then_require_active() {
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());
        registry.register_lazy(SubsystemEntry::new_lazy(
            "test_service",
            None,
            mock.clone(),
            None,
        ));

        // Enable (Dormant)
        registry.enable_ready_subsystems().await;

        // Now activation should work
        let result = registry.require_active("test_service").await;
        assert!(result.is_ok());

        // Service.start() was called exactly once
        assert_eq!(mock.start_count.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn test_force_shutdown() {
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());
        registry.register_lazy(SubsystemEntry::new_lazy(
            "test_service",
            None,
            mock.clone(),
            None,
        ));
        registry.enable_ready_subsystems().await;
        registry.require_active("test_service").await.unwrap();
        assert_eq!(mock.stop_count.load(Ordering::SeqCst), 0);

        // Force shutdown
        registry.force_shutdown("test_service").await.unwrap();

        // Service.stop() was called
        assert_eq!(mock.stop_count.load(Ordering::SeqCst), 1);

        // Status back to Inactive
        let status = registry.require_active("test_service").await;
        assert!(matches!(status, Err(AppError::SubsystemInactive { .. })));
    }

    #[tokio::test]
    async fn test_is_active_after_activation() {
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());
        registry.register_lazy(SubsystemEntry::new_lazy(
            "test_service",
            None,
            mock.clone(),
            None,
        ));

        assert!(!registry.is_active("test_service").await);
        registry.enable_ready_subsystems().await;
        registry.require_active("test_service").await.unwrap();
        assert!(registry.is_active("test_service").await);
    }

    #[tokio::test]
    async fn test_get_all_status_returns_snapshots() {
        let registry = SubsystemRegistry::new_test();
        registry.register_lazy(SubsystemEntry::new_lazy(
            "test_service",
            Some("test-flag"),
            Arc::new(MockService::new()),
            None,
        ));

        let snapshots = registry.get_all_status();
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].name, "test_service");
        assert_eq!(snapshots[0].class, "lazy");
        assert_eq!(snapshots[0].feature_flag.as_deref(), Some("test-flag"));
    }

    // ── Runtime Feature Flag Tests ──────────────────────────────────

    #[test]
    fn test_feature_flag_default_disabled() {
        let registry = SubsystemRegistry::new_test();
        assert!(!registry.is_feature_enabled("ai"));
        assert!(!registry.is_feature_enabled("nonexistent"));
    }

    #[test]
    fn test_enable_feature_flag() {
        let registry = SubsystemRegistry::new_test();
        registry.enable_feature("ai");
        assert!(registry.is_feature_enabled("ai"));
        assert!(!registry.is_feature_enabled("pairing"));
    }

    #[test]
    fn test_disable_feature_flag() {
        let registry = SubsystemRegistry::new_test();
        registry.enable_feature("ai");
        assert!(registry.is_feature_enabled("ai"));
        registry.disable_feature("ai");
        assert!(!registry.is_feature_enabled("ai"));
    }

    #[test]
    fn test_enabled_feature_flags_snapshot() {
        let registry = SubsystemRegistry::new_test();
        assert!(registry.enabled_feature_flags().is_empty());
        registry.enable_feature("ai");
        registry.enable_feature("workflows");
        let flags = registry.enabled_feature_flags();
        assert_eq!(flags.len(), 2);
        assert!(flags.contains(&"ai"));
        assert!(flags.contains(&"workflows"));
    }

    #[tokio::test]
    async fn test_feature_flag_gates_activation_unless_enabled() {
        // Register a subsystem with a feature_flag that is NOT enabled
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());
        registry.register_lazy(SubsystemEntry::new_lazy(
            "ml_sidecar",
            Some("ai"),
            mock.clone(),
            None,
        ));

        // "ai" is not enabled → require_active should return SubsystemInactive
        // with tool = Some("ai")
        let result = registry.require_active("ml_sidecar").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::SubsystemInactive { tool, reason } => {
                assert_eq!(tool, Some("ai"));
                assert!(reason.contains("ai"), "reason should mention the flag: {reason}");
            }
            other => panic!("expected SubsystemInactive, got {other:?}"),
        }

        // start() must NOT have been called since activation was gated
        assert_eq!(mock.start_count.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn test_enabling_feature_flag_allows_activation() {
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());

        // Enable "ai" BEFORE registration
        registry.enable_feature("ai");

        registry.register_lazy(SubsystemEntry::new_lazy(
            "ml_sidecar",
            Some("ai"),
            mock.clone(),
            None,
        ));

        // Feature flag is enabled → activation proceeds normally
        registry.enable_ready_subsystems().await;
        let result = registry.require_active("ml_sidecar").await;
        assert!(result.is_ok(), "activation should succeed: {result:?}");
        assert_eq!(mock.start_count.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn test_feature_flag_disabled_after_enabled() {
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());

        // Enable then disable "ai"
        registry.enable_feature("ai");
        registry.register_lazy(SubsystemEntry::new_lazy(
            "ml_sidecar",
            Some("ai"),
            mock.clone(),
            None,
        ));
        registry.disable_feature("ai");

        // Activation should fail even though subsystem is registered
        let result = registry.require_active("ml_sidecar").await;
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::SubsystemInactive { tool, .. } => {
                assert_eq!(tool, Some("ai"));
            }
            other => panic!("expected SubsystemInactive, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_null_feature_flag_ignores_gating() {
        // A subsystem with feature_flag=None should not be gated
        let registry = SubsystemRegistry::new_test();
        let mock = Arc::new(MockService::new());
        registry.register_lazy(SubsystemEntry::new_lazy(
            "no_flag_service",
            None,
            mock.clone(),
            None,
        ));

        // Should hit the Inactive state check (not a feature flag check)
        registry.enable_ready_subsystems().await;
        let result = registry.require_active("no_flag_service").await;
        assert!(result.is_ok());
        assert_eq!(mock.start_count.load(Ordering::SeqCst), 1);
    }
}
