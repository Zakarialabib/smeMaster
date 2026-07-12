//! Health monitor — periodic service health checks + state-machine recovery.
//!
//! # Responsibilities
//!
//! 1. **Periodic health checks** — every `health_check_interval` call
//!    [`ServiceRegistry::get_all_services`] and compare against the previous
//!    snapshot.  Emit [`AppEvent::HealthStatusChanged`] for any service whose
//!    status changed.
//!
//! 2. **State-machine transitions** — based on aggregated health:
//!    - Any critical service Degraded/Failed while `Ready` → `Degraded`
//!    - All critical services Healthy while `Degraded` → `Recovering`
//!    - All critical services Healthy while `Recovering` → `Ready`
//!    - Recovery failure → back to `Degraded`
//!
//! 3. **Network monitoring** — every `network_check_interval` verify
//!    connectivity and drive `Offline` / `Ready` transitions.
//!
//! 4. **Heartbeat** — emit [`AppEvent::Heartbeat`] on the same tick as health
//!    checks so the frontend gets a regular pulse.
//!
//! # Bootstrap
//!
//! Call [`spawn_health_monitor`] once during bootstrap after the
//! [`EventBus`], [`StateMachine`], and [`ServiceRegistry`] are all wired.

use crate::events::{AppEvent, EventBus};
use crate::orchestrator::service::{HealthStatus, ServiceRegistry};
use crate::orchestrator::state_machine::{StateMachine, SystemState};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

// ---------------------------------------------------------------------------
// Default intervals
// ---------------------------------------------------------------------------

/// How often (seconds) to run full service health checks.
const DEFAULT_HEALTH_CHECK_INTERVAL: u64 = 15;

/// How often (seconds) to check network connectivity.
const DEFAULT_NETWORK_CHECK_INTERVAL: u64 = 30;

/// Global kill switch for the health monitor loop.
static MONITOR_STOP: AtomicBool = AtomicBool::new(false);

/// Signal the health monitor loop to stop.
pub fn signal_stop() {
    MONITOR_STOP.store(true, Ordering::SeqCst);
}

/// Reset the stop signal (for tests or restart).
pub fn reset_stop() {
    MONITOR_STOP.store(false, Ordering::SeqCst);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Spawn the health monitor background task.
///
/// The monitor only begins active work once the system has left the `Booting`
/// phase.  It checks the current state every tick and skips health checks
/// while in `Booting`, `Onboarding`, or `ShuttingDown`.
pub fn spawn_health_monitor(
    event_bus: EventBus,
    state_machine: Arc<StateMachine>,
    registry: Arc<ServiceRegistry>,
    health_check_interval: u64,
    network_check_interval: u64,
) {
    let effective_hc = if health_check_interval > 0 {
        health_check_interval
    } else {
        DEFAULT_HEALTH_CHECK_INTERVAL
    };
    let effective_nc = if network_check_interval > 0 {
        network_check_interval
    } else {
        DEFAULT_NETWORK_CHECK_INTERVAL
    };

    tauri::async_runtime::spawn(async move {
        log::info!(
            "[health_monitor] started (health={effective_hc}s, network={effective_nc}s)"
        );

        let mut health_ticker = tokio::time::interval(Duration::from_secs(effective_hc));
        health_ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        let mut network_ticker = tokio::time::interval(Duration::from_secs(effective_nc));
        network_ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        // Skip first network tick so first real check is after one interval.
        network_ticker.tick().await;

        // Previous known health states (service_name → status label).
        let mut prev_health: HashMap<String, String> = HashMap::new();
        let mut prev_online: Option<bool> = None;

        loop {
            if MONITOR_STOP.load(Ordering::SeqCst) {
                log::info!("[health_monitor] Stop signal received — exiting");
                break;
            }

            let tick_kind = tokio::select! {
                _ = health_ticker.tick() => "health",
                _ = network_ticker.tick() => "network",
            };

            if MONITOR_STOP.load(Ordering::SeqCst) {
                log::info!("[health_monitor] Stop signal received — exiting");
                break;
            }

            // Only act once past Booting/Onboarding.
            let current_state = state_machine.current().await;
            match current_state {
                SystemState::Booting | SystemState::Onboarding | SystemState::ShuttingDown => {
                    continue;
                }
                _ => {}
            }

            // ── Network check ──────────────────────────────────────────
            if tick_kind == "network" {
                let online = check_network().await;
                let changed = prev_online.map(|p| p != online).unwrap_or(true);
                prev_online = Some(online);

                if changed {
                    event_bus.emit(AppEvent::ConnectivityChanged { online });

                    if online {
                        if current_state == SystemState::Offline {
                            let _ = state_machine
                                .try_transition(SystemState::Recovering, "network-restored")
                                .await
                                .map_err(|e| {
                                    log::debug!(
                                        "[health_monitor] network-restored transition skipped: {e}"
                                    );
                                });
                        }
                    } else {
                        if current_state == SystemState::Ready
                            || current_state == SystemState::Degraded
                        {
                            let reason = if current_state == SystemState::Degraded {
                                "network-lost-while-degraded"
                            } else {
                                "network-lost"
                            };
                            let _ = state_machine
                                .try_transition(SystemState::Offline, reason)
                                .await
                                .map_err(|e| {
                                    log::debug!(
                                        "[health_monitor] offline transition skipped: {e}"
                                    );
                                });
                        }
                    }
                }
            }

            // ── Health check (always runs on health tick) ──────────────
            if tick_kind == "health" {
                let now_ms = chrono::Utc::now().timestamp_millis();

                // Emit heartbeat on every health tick
                event_bus.emit(AppEvent::Heartbeat {
                    timestamp: now_ms as u64,
                });

                let services = registry.get_all_services().await;
                let mut has_degraded = false;
                let mut has_failed = false;
                let mut has_unknown = false;

                for service in &services {
                    let name = service.name().to_string();
                    let health = service.health_check().await;
                    let label = health_label(&health);
                    let prev = prev_health.get(&name);

                    // Emit HealthStatusChanged if status transitioned
                    if prev.map(|p| *p != label).unwrap_or(true) {
                        let message = match &health {
                            HealthStatus::Degraded(m) | HealthStatus::Failed(m) => m.clone(),
                            _ => String::new(),
                        };
                        event_bus.emit(AppEvent::HealthStatusChanged {
                            service: name.clone(),
                            status: label.clone(),
                            message,
                            at_ms: now_ms,
                        });
                        log::info!(
                            "[health_monitor] {name}: {} → {label}",
                            prev.map(|s| s.as_str()).unwrap_or("(initial)"),
                        );
                    }

                    prev_health.insert(name, label.clone());

                    match health {
                        HealthStatus::Healthy => {}
                        HealthStatus::Degraded(_) => has_degraded = true,
                        HealthStatus::Failed(_) => has_failed = true,
                        HealthStatus::Unknown => has_unknown = true,
                    }
                }

                // ── State machine transitions ──────────────────────────
                let current = state_machine.current().await;
                let any_unhealthy = has_degraded || has_failed || has_unknown;

                match current {
                    SystemState::Ready if any_unhealthy => {
                        let reason = if has_failed {
                            "critical-service-failed"
                        } else if has_degraded {
                            "critical-service-degraded"
                        } else {
                            "critical-service-unknown"
                        };
                        let _ = state_machine
                            .try_transition(SystemState::Degraded, reason)
                            .await
                            .map_err(|e| {
                                log::debug!("[health_monitor] Ready→Degraded skipped: {e}");
                            });
                    }

                    SystemState::Degraded if !any_unhealthy => {
                        let _ = state_machine
                            .try_transition(SystemState::Recovering, "all-services-healthy")
                            .await
                            .map_err(|e| {
                                log::debug!("[health_monitor] Degraded→Recovering skipped: {e}");
                            });
                    }

                    SystemState::Recovering if !any_unhealthy => {
                        let _ = state_machine
                            .try_transition(SystemState::Ready, "recovery-complete")
                            .await
                            .map_err(|e| {
                                log::debug!("[health_monitor] Recovering→Ready skipped: {e}");
                            });
                    }

                    SystemState::Recovering if any_unhealthy => {
                        let reason = if has_failed {
                            "recovery-service-failed"
                        } else {
                            "recovery-service-degraded"
                        };
                        let _ = state_machine
                            .try_transition(SystemState::Degraded, reason)
                            .await
                            .map_err(|e| {
                                log::debug!("[health_monitor] Recovering→Degraded skipped: {e}");
                            });
                    }

                    _ => {}
                }
            }
        }

        log::warn!("[health_monitor] loop ended");
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn health_label(health: &HealthStatus) -> String {
    match health {
        HealthStatus::Healthy => "Healthy".to_string(),
        HealthStatus::Degraded(_) => "Degraded".to_string(),
        HealthStatus::Failed(_) => "Failed".to_string(),
        HealthStatus::Unknown => "Unknown".to_string(),
    }
}

async fn check_network() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    match client
        .get("https://clients3.google.com/generate_204")
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orchestrator::service::Service;
    use async_trait::async_trait;

    struct HealthyService;
    #[async_trait]
    impl Service for HealthyService {
        fn name(&self) -> &'static str { "healthy" }
        async fn init(&self) -> anyhow::Result<()> { Ok(()) }
        async fn start(&self) -> anyhow::Result<()> { Ok(()) }
        async fn stop(&self) -> anyhow::Result<()> { Ok(()) }
        async fn health_check(&self) -> HealthStatus { HealthStatus::Healthy }
        fn is_critical(&self) -> bool { true }
    }

    struct DegradedService;
    #[async_trait]
    impl Service for DegradedService {
        fn name(&self) -> &'static str { "degraded" }
        async fn init(&self) -> anyhow::Result<()> { Ok(()) }
        async fn start(&self) -> anyhow::Result<()> { Ok(()) }
        async fn stop(&self) -> anyhow::Result<()> { Ok(()) }
        async fn health_check(&self) -> HealthStatus { HealthStatus::Degraded("test".into()) }
        fn is_critical(&self) -> bool { true }
    }

    #[test]
    fn test_health_label() {
        assert_eq!(health_label(&HealthStatus::Healthy), "Healthy");
        assert_eq!(health_label(&HealthStatus::Degraded("x".into())), "Degraded");
        assert_eq!(health_label(&HealthStatus::Failed("x".into())), "Failed");
        assert_eq!(health_label(&HealthStatus::Unknown), "Unknown");
    }
}
