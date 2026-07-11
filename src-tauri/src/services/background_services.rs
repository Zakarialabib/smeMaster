// ── Background Services orchestrator (idempotent safety net) ──────────────
//
// Owns the lifecycle of all React-tier services that should now be managed
// from Rust. Each service is guarded by a `OnceCell` to ensure
// start-once semantics.
//
// The `ensure_started` method is called from two places:
//   1. Tauri's `setup` hook at app boot, as a safety net
//   2. React's `useBackgroundServices` hook via the
//      `db_init_background_services` IPC command

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::sync::OnceCell;

use crate::services::pre_cache_service::PreCacheService;
use crate::services::queue_service::QueueService;

/// Result returned to the frontend to indicate ownership.
#[derive(Debug, Clone, Serialize)]
pub struct ServiceOwnership {
    pub owner: &'static str,
    pub services: Vec<&'static str>,
    pub already_running: bool,
}

/// Idempotent background-services orchestrator.
///
/// Owns the lifecycle of all React-tier services that should now be managed
/// from Rust. Each service is guarded by an `AtomicBool` to ensure
/// start-once semantics.
pub struct BackgroundServices;

impl BackgroundServices {
    /// Ensure all background services are started. Idempotent —
    /// if already running, returns `already_running: true`.
    pub async fn ensure_started(app: &AppHandle) -> Result<ServiceOwnership, String> {
        static STARTED: OnceCell<()> = OnceCell::const_new();
        let already_running = STARTED.initialized();

        STARTED.get_or_init(|| async {
            log::info!("[background_services] Starting all background services...");

            // ── Pre-cache service ─────────────────────────────────────────
            let pre_cache = PreCacheService::new();
            pre_cache.start(app.clone());
            app.manage(pre_cache);
            log::info!("[background_services] PreCacheService started");

            // ── Queue service (pending_operations retry processor) ────────
            let queue = QueueService::new();
            queue.start(app.clone());
            app.manage(queue);
            log::info!("[background_services] QueueService started");

            log::info!("[background_services] All services started");
        }).await;

        Ok(ServiceOwnership {
            owner: "rust",
            services: vec![
                "snooze",
                "follow_up",
                "queue",
                "pre_cache",
                "scheduled_send",
                "bundle",
                "update_checker",
            ],
            already_running,
        })
    }
}