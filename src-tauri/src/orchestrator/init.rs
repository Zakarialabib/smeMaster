// ── AppLifecycle — clean multi-phase initialization pipeline ──────────
//
// Extracts the bulky setup closure logic from lib.rs into named phases.
// Each phase has a clear responsibility. The setup closure in lib.rs
// becomes a linear sequence of phase calls.

use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::broadcast;

use crate::data_cache::DataCacheService;
use crate::events::{AppEvent, EventBus};
use crate::orchestrator::{self, SubsystemRegistry, ToolRegistry, StateMachine};
use crate::deliverability::sentinel::SentinelService;
use crate::sync_engine::SyncEngineService;

/// Zero-size namespace for init phase functions.
pub struct AppLifecycle;

impl AppLifecycle {
    /// Phase 2 (Async): EventBus → WebView bridge.
    /// Re-emits Rust events to the frontend via `core-event` channel.
    pub fn spawn_event_bridge(app: &AppHandle, mut rx: broadcast::Receiver<AppEvent>) {
        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(event) => {
                        if let Err(e) = handle.emit("core-event", &event) {
                            log::error!("[event-bridge] emit failed: {e}");
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        log::warn!("[event-bridge] Lagged, dropped {n} events");
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                        log::info!("[event-bridge] Channel closed, shutting down");
                        break;
                    }
                }
            }
        });
    }

    /// Phase 2 (Async): Heartbeat every 30s for frontend health monitoring.
    /// Delegates to the standalone `crate::events::heartbeat::spawn_heartbeat`.
    pub fn spawn_heartbeat(app: &AppHandle) {
        if let Some(bus) = app.try_state::<EventBus>() {
            crate::events::heartbeat::reset_stop();
            crate::events::heartbeat::spawn_heartbeat(bus.inner().clone(), 30);
            log::info!("[init] Heartbeat emitter started (30s interval, standalone module)");
        } else {
            log::warn!("[init] EventBus not available — heartbeat not started");
        }
    }

    /// Phase 3: Wire SubsystemRegistry, ToolRegistry, StateMachine.
    /// These must live outside the orchestrator spawn so IPC commands can access them.
    /// Registers all known subsystems (Lazy, OnDemand, and externally-managed observed).
    pub fn wire_subsystem_lifecycle(app: &tauri::App) -> (Arc<SubsystemRegistry>, Arc<ToolRegistry>, Arc<StateMachine>) {
        let subsystem_registry = Arc::new(SubsystemRegistry::new(app.handle().clone()));
        crate::orchestrator::gating::set_global_registry(subsystem_registry.clone());
        let tool_registry = Arc::new(ToolRegistry::new());
        crate::orchestrator::gating::set_global_tool_registry(tool_registry.clone());

        // ── Register subsystems ───────────────────────────────────────────

        // 1. Lazy: deliverability_sentinel (idle shutdown capable, 60s grace)
        let sentinel: Arc<SentinelService> = app.state::<Arc<SentinelService>>().inner().clone();
        subsystem_registry.register_lazy(
            orchestrator::SubsystemEntry::new_lazy(
                "deliverability_sentinel",
                Some("deliverability-dashboard"),
                sentinel.clone(),
                Some(std::time::Duration::from_secs(60)),
            )
        );

        // 2. OnDemand: vault (encrypted file storage)
        //    Factory passes app.handle() for vault ops that need it.
        let vault_factory_handle = app.handle().clone();
        subsystem_registry.register_ondemand(
            orchestrator::SubsystemEntry::new_ondemand(
                "vault",
                Some("pairing"),
                Box::new(move || -> Arc<dyn orchestrator::Service> {
                    // VaultService wrapper around the vault module
                    Arc::new(crate::orchestrator::services::VaultService::new(&vault_factory_handle))
                }),
            )
        );

        // 3. OnDemand: ml-sidecar (external ML/RAG process).
        //    Gated behind `local-ai` so the core build never needs protoc.
        #[cfg(feature = "local-ai")]
        {
            let ml_handle = app.handle().clone();
            subsystem_registry.register_ondemand(
                orchestrator::SubsystemEntry::new_ondemand(
                    "ml-sidecar",
                    Some("ai"),
                    Box::new(move || -> Arc<dyn orchestrator::Service> {
                        Arc::new(crate::orchestrator::services::MlSidecarService::new(ml_handle.clone()))
                    }),
                )
            );
            log::info!("[init] Phase 3 — ml-sidecar registered (local-ai enabled)");
        }
        #[cfg(not(feature = "local-ai"))]
        {
            subsystem_registry.register_ondemand(
                orchestrator::SubsystemEntry::new_ondemand(
                    "ai_inference",
                    Some("ai"),
                    Box::new(|| -> Arc<dyn orchestrator::Service> {
                        Arc::new(crate::orchestrator::services::StubService::new(
                            "ai_inference",
                            "local-ai feature disabled — AI inference not available",
                        ))
                    }),
                )
            );
        }

        // 4. OnDemand: workflows_executor (workflow rule engine)
        //    Polls for pending operations and due follow-up reminders every 60s.
        let workflow_handle = app.handle().clone();
        subsystem_registry.register_ondemand(
            orchestrator::SubsystemEntry::new_ondemand(
                "workflows_executor",
                Some("workflows"),
                Box::new(move || -> Arc<dyn orchestrator::Service> {
                    Arc::new(crate::orchestrator::services::WorkflowExecutorService::new(workflow_handle.clone()))
                }),
            )
        );

        // 5. OnDemand: campaign_sender (future campaign delivery engine)
        subsystem_registry.register_ondemand(
            orchestrator::SubsystemEntry::new_ondemand(
                "campaign_sender",
                Some("campaigns"),
                Box::new(|| -> Arc<dyn orchestrator::Service> {
                    Arc::new(crate::orchestrator::services::StubService::new(
                        "campaign_sender",
                        "Campaign sender not yet implemented",
                    ))
                }),
            )
        );

        // ── StateMachine (depends on SubsystemRegistry + EventBus) ────────
        let event_bus_arc = Arc::new(
            (*app.state::<EventBus>()).clone()
        );
        let state_machine = Arc::new(StateMachine::new(
            subsystem_registry.clone(),
            event_bus_arc,
        ));

        app.manage(subsystem_registry.clone());
        app.manage(tool_registry.clone());
        app.manage(state_machine.clone());

        log::info!("[init] Phase 3 — Subsystem lifecycle wired (1 Lazy + 4 OnDemand)");
        (subsystem_registry, tool_registry, state_machine)
    }

    /// Phase 4 (Async): ServiceRegistry + Watchdog + migration.
    /// Also registers externally-managed services in SubsystemRegistry for observability.
    ///
    /// SEQUENCE GUARANTEE (fixed):
    ///   1. Run DB migrations — halt on failure, no service starts without tables
    ///   2. Seed demo data on first run
    ///   3. Start background services (pre_cache, queue) — only after tables exist
    ///   4. Initialize ServiceRegistry services
    ///   5. Start Watchdog monitoring
    pub fn spawn_orchestrator(
        app: &AppHandle,
        pool: sqlx::SqlitePool,
        subsystem_registry: Arc<SubsystemRegistry>,
    ) {
        let handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let bus = handle.state::<EventBus>();

            emit_init_progress(&bus, "Database", "Running migrations...", 5);

            // ═══════════════════════════════════════════════════════════════
            // STEP 1: DB Migrations — MUST succeed before anything else
            // ═══════════════════════════════════════════════════════════════
            let _ = handle.emit("rust:init:db", Some("Running database migrations..."));
            if let Err(e) = crate::db::migrations::run_migrations(&pool).await {
                log::error!("[orchestrator] Migration failed — system cannot start: {e}");
                let _ = handle.emit("migration:error", e.to_string());
                // HALT — do not start any services on a broken/missing schema
                return;
            }

            // ── Post-migration health check ─────────────────────────────
            if let Err(e) = crate::db::health_check(&pool).await {
                log::warn!("[orchestrator] Post-migration health check failed: {e}");
            }

            emit_init_progress(&bus, "Database", "Migrations complete", 10);

            // ═══════════════════════════════════════════════════════════════
            // STEP 2: Determine DB lifecycle state & seed demo data
            // ═══════════════════════════════════════════════════════════════
            let db_state = crate::db::migrations::check_db_state(&pool).await;
            log::info!("[orchestrator] DB state: {db_state:?}");

            match &db_state {
                crate::db::migrations::DbState::Corrupt { reason } => {
                    log::error!("[orchestrator] DB is corrupt: {reason}");
                    let _ = handle.emit("migration:error", reason);
                    return;
                }
                crate::db::migrations::DbState::Fresh | crate::db::migrations::DbState::Empty => {
                    // First run — seed demo data so the UI isn't empty
                    log::info!("[orchestrator] Fresh database — seeding demo data");
                    if let Err(e) = seed_demo_data(&pool).await {
                        log::warn!("[orchestrator] Demo data seeding failed (non-fatal): {e}");
                    }
                }
                crate::db::migrations::DbState::Initialized => {
                    let _ = handle.emit("onboarding:completed", ());
                    log::info!("[orchestrator] System already initialized — emitted onboarding:completed");
                    // Seeds are idempotent (gated by `demo_full_seeded`); run them
                    // here too so an already-migrated DB still gets demo data.
                    if let Err(e) = seed_demo_data(&pool).await {
                        log::warn!("[orchestrator] Demo data seeding failed (non-fatal): {e}");
                    }
                }
                crate::db::migrations::DbState::Migrated => {
                    // All migrations applied but onboarding not finished: seed
                    // demo data (idempotent) so the DB isn't empty.
                    if let Err(e) = seed_demo_data(&pool).await {
                        log::warn!("[orchestrator] Demo data seeding failed (non-fatal): {e}");
                    }
                }
                _ => {
                    log::info!("[orchestrator] First run — waiting for onboarding completion from frontend");
                }
            }

            emit_init_progress(&bus, "Data", "Demo data ready", 25);

            // ═══════════════════════════════════════════════════════════════
            // STEP 3: OAuth token monitor — needs tables to exist
            // ═══════════════════════════════════════════════════════════════
            {
                let oauth_monitor = crate::oauth::monitor::OAuthTokenMonitor::init(&handle).await;
                let monitor_clone = oauth_monitor.clone();
                let monitor_handle = handle.clone();
                tauri::async_runtime::spawn(async move {
                    monitor_clone.run_check_loop(monitor_handle).await;
                });
                handle.manage(oauth_monitor);
                log::info!("[oauth-monitor] Proactive token refresh monitor started");
            }

            emit_init_progress(&bus, "Auth", "OAuth monitor started", 35);

            // ═══════════════════════════════════════════════════════════════
            // STEP 4: Background services — now safe with tables present
            // ═══════════════════════════════════════════════════════════════
            match crate::services::background_services::BackgroundServices::ensure_started(&handle).await {
                Ok(ownership) => {
                    log::info!(
                        "[background_services] Services owned by {}, already_running={}",
                        ownership.owner,
                        ownership.already_running,
                    );
                }
                Err(e) => {
                    log::warn!("[background_services] Failed to ensure services: {e}");
                }
            }

            emit_init_progress(&bus, "Services", "Background services started", 45);

            // ── ServiceRegistry: AlwaysOn services ──────────────────────
            let service_registry = Arc::new(orchestrator::ServiceRegistry::new(handle.clone()));

            let sync_service = Arc::new(orchestrator::SyncService::new(handle.clone()));
            let backup_scheduler = Arc::new(orchestrator::BackupSchedulerService::new(handle.clone()));

            service_registry.register(Arc::new(orchestrator::DatabaseService)).await;
            service_registry.register(Arc::new(orchestrator::PgpService)).await;
            service_registry.register(sync_service.clone()).await;

            let sentinel: Arc<SentinelService> = handle.state::<Arc<SentinelService>>().inner().clone();
            service_registry.register(sentinel).await;

            service_registry.register(backup_scheduler.clone()).await;

            // ── DataCacheService: in-memory cache layer ──
            // Already managed as Tauri state in lib.rs setup (early registration).
            // Retrieve the existing instance here for ServiceRegistry lifecycle
            // management (pre-warming, health checks, graceful shutdown).
            let data_cache_service: Arc<DataCacheService> = handle.state::<Arc<DataCacheService>>().inner().clone();
            service_registry.register(data_cache_service).await;

            // ── SyncEngineService: CRDT sync engine ──
            let sync_engine_service = Arc::new(SyncEngineService::new(handle.clone(), pool.clone()));
            let sync_engine_for_lazy = sync_engine_service.clone();
            service_registry.register(sync_engine_service.clone()).await;
            handle.manage(sync_engine_service);

            // Also register as a Lazy subsystem in SubsystemRegistry for observability
            subsystem_registry.register_lazy(
                orchestrator::SubsystemEntry::new_lazy(
                    "sync_engine",
                    Some("device"),
                    sync_engine_for_lazy,
                    Some(std::time::Duration::from_secs(60)),
                )
            );

            // ── Run JSON → CRDT migration ──
            SyncEngineService::run_migration(&handle, &pool).await;

            // ── Register externally-managed services in SubsystemRegistry for observability ──
            subsystem_registry.register_observed("sync", Some("ai"), sync_service);
            subsystem_registry.register_observed("backup_scheduler", Some("backup"), backup_scheduler);

            emit_init_progress(&bus, "Services", "Initializing services...", 60);
            let _ = handle.emit("rust:init:sync", Some("Initializing accounts..."));
            let _ = service_registry.init_all().await;

            emit_init_progress(&bus, "Services", "Starting services...", 75);
            let _ = service_registry.start_all().await;

            emit_init_progress(&bus, "Services", "All services running", 90);

            bus.emit(AppEvent::InitComplete);
            emit_init_progress(&bus, "System", "Initialization complete", 100);
            let _ = handle.emit("rust:init:complete", ());

            // ── Health Monitor — periodic checks + auto-recovery ──────────
            {
                let hm_bus = bus.inner().clone();
                let sm = handle.state::<Arc<StateMachine>>().inner().clone();
                let reg = service_registry.clone();
                // Clone service_registry into an Arc<ServiceRegistry>
                crate::orchestrator::health_monitor::spawn_health_monitor(
                    hm_bus,
                    sm,
                    reg,
                    15,  // health check interval (seconds)
                    30,  // network check interval (seconds)
                );
                log::info!("[init] Health monitor started (health=15s, network=30s)");
            }

            // Emit close-splashscreen so the native Android splash can be dismissed
            #[cfg(target_os = "android")]
            {
                let _ = handle.emit("close-splashscreen", ());
            }

            log::info!("[orchestrator] Rust init complete");

            // ── Watchdog: monitors ServiceRegistry + SubsystemRegistry ──
            let watchdog = orchestrator::Watchdog::new(service_registry)
                .with_subsystem_registry(subsystem_registry);
            watchdog.start_monitoring().await;
        });
    }

    // Draft phase (Async): Update tracker — crash detection + version tracking.
    // pub fn spawn_update_tracker(app: &AppHandle) {
    //     let handle = app.clone();
    //     tauri::async_runtime::spawn(async move {
    //         match crate::update_tracker::UpdateTracker::new(&handle) {
    //             Ok(tracker) => {
    //                 if let Some(last_version) = tracker.get_last_version() {
    //                     let current = handle.package_info().version.to_string();
    //                     if last_version != current {
    //                         log::info!("App updated from {} to {}", last_version, current);
    //                     }
    //                 }
    //                 let crash_count = tracker.increment_crash_count();
    //                 log::info!("Update tracker initialized (crash count: {})", crash_count);

    //                 let mark_handle = handle.clone();
    //                 tauri::async_runtime::spawn(async move {
    //                     tokio::time::sleep(std::time::Duration::from_secs(60)).await;
    //                     match crate::update_tracker::UpdateTracker::new(&mark_handle) {
    //                         Ok(mut t) => {
    //                             t.mark_successful_launch();
    //                             log::info!("Update tracker: launch marked successful");
    //                         }
    //                         Err(e) => log::warn!("Failed to mark successful launch: {}", e),
    //                     }
    //                 });
    //             }
    //             Err(e) => log::warn!("Failed to initialize update tracker: {}", e),
    //         }
    //     });
    // }

}

// ── Demo data seeding ──────────────────────────────────────────────────────
//
// On first run (Fresh/Empty DB state), seed demo data so the frontend has
// something to display. Uses the new Rust-native seed module which loads
// bundled JSON seed files embedded at compile time via include_str!().
//
// The function is safe to call on any DB — it checks for existing data first
// via the `demo_full_seeded` settings flag.

// ── Helper: emit InitProgress via EventBus ──────────────────────────────

fn emit_init_progress(bus: &tauri::State<'_, EventBus>, phase: &str, message: &str, percentage: u8) {
    bus.emit(AppEvent::InitProgress {
        phase: phase.to_string(),
        message: message.to_string(),
        percentage,
    });
    log::info!("[init] [{phase}] {percentage}% — {message}");
}

/// Seed demo data for first-run experience.
/// Runs inside `spawn_orchestrator` after migrations succeed.
async fn seed_demo_data(pool: &sqlx::SqlitePool) -> Result<(), String> {
    // Guard: only seed if settings table exists (migration v1 applied)
    let has_settings: bool = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='settings'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Cannot check settings table: {e}"))?
        > 0;

    if !has_settings {
        log::warn!("[seed] Settings table missing — skipping demo data (migrations may be partial)");
        return Ok(());
    }

    // ── Dynamic guard: do not auto-seed when real data already exists ──
    // If the user has connected at least one real email account, demo data
    // would only pollute their real dataset — skip it so real data is shown
    // on its own. (Explicit seeding via db_seed_demo_preset still works.)
    let real_accounts: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM accounts WHERE is_active = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Cannot check accounts: {e}"))?;

    if real_accounts > 0 {
        log::info!("[seed] Real email accounts present — skipping auto demo seed");
        // Still mark as seeded so we never auto-seed later once real data exists.
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('demo_full_seeded', '1')",
        )
        .execute(pool)
        .await;
        return Ok(());
    }

    // ── Allow/deny guard: respect an explicit opt-out setting ──
    // A user (or admin) can set demo_data_enabled = 'false' to disable demo
    // data entirely. When absent it defaults to enabled (first-run experience).
    let demo_allowed: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM settings WHERE key = 'demo_data_enabled'",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Cannot check demo_data_enabled: {e}"))?;

    if let Some((val,)) = demo_allowed {
        if val == "false" {
            log::info!("[seed] demo_data_enabled = false — skipping demo seed");
            return Ok(());
        }
    }

    // Check if already seeded (idempotency guard)
    let already_seeded: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM settings WHERE key = 'demo_full_seeded'",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Cannot check seed flag: {e}"))?;

    if let Some((val,)) = already_seeded {
        if val == "1" {
            log::info!("[seed] Database already seeded, skipping");
            return Ok(());
        }
    }

    log::info!("[seed] Seeding demo data from bundled JSON files...");

    let count = crate::db::seed::seed_all(pool).await?;

    log::info!("[seed] Demo data seeded: {count} rows total");
    Ok(())
}
