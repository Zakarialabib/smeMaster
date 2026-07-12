use std::sync::Arc;
use std::time::Duration;
use super::service::{ServiceRegistry, HealthStatus, Service};
use super::subsystem_lifecycle::SubsystemRegistry;

pub struct Watchdog {
    registry: Arc<ServiceRegistry>,
    subsystem_registry: Option<Arc<SubsystemRegistry>>,
}

impl Watchdog {
    pub fn new(registry: Arc<ServiceRegistry>) -> Self {
        Self { registry, subsystem_registry: None }
    }

    /// Attach a SubsystemRegistry for Phase 2 monitoring (failed subsystem restart).
    pub fn with_subsystem_registry(mut self, sr: Arc<SubsystemRegistry>) -> Self {
        self.subsystem_registry = Some(sr);
        self
    }

    pub async fn start_monitoring(&self) {
        let registry = self.registry.clone();
        let subsystem_registry = self.subsystem_registry.clone();
        
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(30)).await;
                
                // ── Phase 1: Monitor ServiceRegistry (AlwaysOn services) ──
                let services = registry.get_all_services().await;
                for service in services {
                    match service.health_check().await {
                        HealthStatus::Healthy => continue,
                        HealthStatus::Degraded(msg) => {
                            log::warn!("[watchdog] Service {} is degraded: {}", service.name(), msg);
                        }
                        HealthStatus::Failed(msg) => {
                            log::error!("[watchdog] Service {} failed: {}. Attempting recovery...", service.name(), msg);
                            Self::attempt_restart(service).await;
                        }
                        HealthStatus::Unknown => continue,
                    }
                }

                // ── Phase 2: Monitor SubsystemRegistry (Lazy/OnDemand subsystems) ──
                if let Some(ref sr) = subsystem_registry {
                    for snapshot in sr.get_all_status() {
                        if snapshot.status == "failed" {
                            log::warn!(
                                "[watchdog] Subsystem {} has failed (error: {:?}), attempting restart...",
                                snapshot.name, snapshot.error
                            );
                            // require_active() will re-attempt activation from Failed → Starting → Active
                            if let Err(e) = sr.require_active(&snapshot.name).await {
                                log::error!(
                                    "[watchdog] Failed to restart subsystem {}: {}",
                                    snapshot.name, e
                                );
                            }
                        }
                    }
                }
            }
        });
    }

    async fn attempt_restart(service: Arc<dyn Service>) {
        let mut attempts = 0;
        let mut delay = Duration::from_secs(1);

        while attempts < 3 {
            log::info!("Restarting {} (attempt {})", service.name(), attempts + 1);
            if let Err(e) = service.stop().await {
                log::error!("Stop failed for {}: {}", service.name(), e);
            }
            if let Err(e) = service.start().await {
                log::error!("Restart failed for {}: {}", service.name(), e);
                attempts += 1;
                tokio::time::sleep(delay).await;
                delay *= 2; // Exponential backoff
            } else {
                log::info!("Service {} restarted successfully", service.name());
                return;
            }
        }
        
        log::error!("Failed to restart service {} after 3 attempts", service.name());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Mock service for testing watchdog restart logic.
    /// Tracks start/stop calls and can be configured to fail N times.
    struct MockRestartService {
        name: &'static str,
        stop_count: AtomicUsize,
        start_count: AtomicUsize,
        /// How many times start() should fail before succeeding
        fail_until: AtomicUsize,
    }

    impl MockRestartService {
        fn new(name: &'static str) -> Self {
            Self {
                name,
                stop_count: AtomicUsize::new(0),
                start_count: AtomicUsize::new(0),
                fail_until: AtomicUsize::new(0),
            }
        }

        /// Configure the service to fail `n` times before succeeding
        fn with_failures(self, n: usize) -> Self {
            self.fail_until.store(n, Ordering::SeqCst);
            self
        }

        fn start_count(&self) -> usize {
            self.start_count.load(Ordering::SeqCst)
        }

        fn stop_count(&self) -> usize {
            self.stop_count.load(Ordering::SeqCst)
        }
    }

    #[async_trait::async_trait]
    impl Service for MockRestartService {
        fn name(&self) -> &'static str {
            self.name
        }

        async fn init(&self) -> anyhow::Result<()> {
            Ok(())
        }

        async fn start(&self) -> anyhow::Result<()> {
            let count = self.start_count.fetch_add(1, Ordering::SeqCst);
            let threshold = self.fail_until.load(Ordering::SeqCst);
            if count < threshold {
                Err(anyhow::anyhow!("Simulated failure #{}", count + 1))
            } else {
                Ok(())
            }
        }

        async fn stop(&self) -> anyhow::Result<()> {
            self.stop_count.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        async fn health_check(&self) -> HealthStatus {
            HealthStatus::Healthy
        }

        fn is_critical(&self) -> bool {
            true
        }
    }

    /// A service whose start always fails (exhausts all retries)
    struct AlwaysFailService;

    #[async_trait::async_trait]
    impl Service for AlwaysFailService {
        fn name(&self) -> &'static str {
            "always_fail"
        }

        async fn init(&self) -> anyhow::Result<()> {
            Ok(())
        }

        async fn start(&self) -> anyhow::Result<()> {
            Err(anyhow::anyhow!("Permanent failure"))
        }

        async fn stop(&self) -> anyhow::Result<()> {
            Ok(())
        }

        async fn health_check(&self) -> HealthStatus {
            HealthStatus::Healthy
        }
    }

    // ── attempt_restart tests ──────────────────────────────────────

    #[tokio::test]
    async fn test_attempt_restart_succeeds_first_try() {
        let service = Arc::new(MockRestartService::new("restart_ok"));
        Watchdog::attempt_restart(service.clone()).await;

        // stop is always called once, start is called once and succeeds
        assert_eq!(service.stop_count(), 1);
        assert_eq!(service.start_count(), 1);
    }

    #[tokio::test]
    async fn test_attempt_restart_succeeds_after_failures() {
        let service = Arc::new(MockRestartService::new("restart_retry").with_failures(2));
        Watchdog::attempt_restart(service.clone()).await;

        // stop: 1 initial + 2 retries = 3
        // start: 3 attempts total (2 fail, 1 succeeds)
        assert_eq!(service.start_count(), 3);
        assert_eq!(service.stop_count(), 3);
    }

    #[tokio::test]
    async fn test_attempt_restart_exhausts_retries() {
        let service = Arc::new(AlwaysFailService);
        Watchdog::attempt_restart(service).await;
        // Should not panic — just logs the failure
    }

    // ── Watchdog::new ──────────────────────────────────────────────

    // Note: We can't easily create a ServiceRegistry in tests because
    // it requires a Tauri AppHandle. Testing with real Tauri requires
    // tauri::test features which aren't enabled. These tests focus on
    // the restart logic which is the critical path.
}
