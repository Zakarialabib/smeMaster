use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use anyhow::Result;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HealthStatus {
    Healthy,
    Degraded(String),
    Failed(String),
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InitializationPhase {
    Awakening,
    Assembly,
    Coronation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseEvent {
    pub phase: InitializationPhase,
    #[serde(default)]
    pub service: Option<String>,
    pub message: String,
    pub progress: f32,
    #[serde(default)]
    pub timestamp: u64,
}

#[async_trait::async_trait]
pub trait Service: Send + Sync {
    fn name(&self) -> &'static str;
    
    /// Phase 1: Initialize resources, connect to DB
    async fn init(&self) -> Result<()>;
    
    /// Phase 2: Start background loops, listeners
    async fn start(&self) -> Result<()>;
    
    /// Graceful shutdown
    async fn stop(&self) -> Result<()>;
    
    /// Report current health status
    async fn health_check(&self) -> HealthStatus;
    
    /// If true, system halts if init fails
    fn is_critical(&self) -> bool { true }
    
    /// Initialization priority (lower = earlier)
    fn priority(&self) -> u32 { 100 }

    /// Optional module manifest describing this service's feature flags,
    /// dependencies, tables, events, and config fields.
    /// Default returns `None`. Override to associate a manifest with this service.
    fn manifest(&self) -> Option<serde_json::Value> {
        None
    }
}

pub struct ServiceRegistry {
    services: RwLock<Vec<Arc<dyn Service>>>,
    app_handle: AppHandle,
}

impl ServiceRegistry {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            services: RwLock::new(Vec::new()),
            app_handle,
        }
    }

    pub async fn register(&self, service: Arc<dyn Service>) {
        let mut services = self.services.write().await;
        services.push(service);
        services.sort_by_key(|s| s.priority());
    }

    pub async fn init_all(&self) -> Result<()> {
        let services = self.services.read().await.clone();
        let total = services.len();

        for (index, service) in services.iter().enumerate() {
            let progress = (index as f32 / total as f32) * 50.0; // 0-50% for init
            self.emit_progress(InitializationPhase::Awakening, format!("Initializing {}...", service.name()), progress);
            
            if let Err(e) = service.init().await {
                if service.is_critical() {
                    log::error!("Critical service {} failed to initialize: {}", service.name(), e);
                    return Err(e);
                } else {
                    log::warn!("Non-critical service {} failed to initialize: {}", service.name(), e);
                }
            }
        }
        Ok(())
    }

    pub async fn start_all(&self) -> Result<()> {
        let services = self.services.read().await.clone();
        let total = services.len();

        for (index, service) in services.iter().enumerate() {
            let progress = 50.0 + ((index as f32 / total as f32) * 45.0); // 50-95% for start
            self.emit_progress(InitializationPhase::Assembly, format!("Starting {}...", service.name()), progress);
            
            if let Err(e) = service.start().await {
                if service.is_critical() {
                    log::error!("Critical service {} failed to start: {}", service.name(), e);
                    return Err(e);
                } else {
                    log::warn!("Non-critical service {} failed to start: {}", service.name(), e);
                }
            }
        }
        
        self.emit_progress(InitializationPhase::Coronation, "System Ready".to_string(), 100.0);
        
        // Notify frontend we are completely ready
        let _ = self.app_handle.emit("init:ready", ());
        
        Ok(())
    }

    pub async fn get_all_services(&self) -> Vec<Arc<dyn Service>> {
        self.services.read().await.clone()
    }

    fn emit_progress(&self, phase: InitializationPhase, message: String, progress: f32) {
        let event = PhaseEvent {
            phase,
            service: None,
            message,
            progress,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        };
        let _ = self.app_handle.emit("init:progress", event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    // ── HealthStatus ───────────────────────────────────────────────

    #[test]
    fn test_health_status_debug() {
        let healthy = HealthStatus::Healthy;
        assert_eq!(format!("{:?}", healthy), "Healthy");

        let degraded = HealthStatus::Degraded("slow".to_string());
        assert!(format!("{:?}", degraded).contains("Degraded"));
        assert!(format!("{:?}", degraded).contains("slow"));

        let failed = HealthStatus::Failed("crashed".to_string());
        assert!(format!("{:?}", failed).contains("Failed"));
    }

    #[test]
    fn test_health_status_clone() {
        let status = HealthStatus::Degraded("warning".to_string());
        let cloned = status.clone();
        assert_eq!(status, cloned);
    }

    #[test]
    fn test_health_status_equality() {
        assert_eq!(HealthStatus::Healthy, HealthStatus::Healthy);
        assert_eq!(
            HealthStatus::Degraded("a".to_string()),
            HealthStatus::Degraded("a".to_string())
        );
        assert_eq!(
            HealthStatus::Failed("x".to_string()),
            HealthStatus::Failed("x".to_string())
        );
        assert_ne!(HealthStatus::Healthy, HealthStatus::Failed("x".to_string()));
    }

    #[test]
    fn test_health_status_serialize() {
        let healthy_json = serde_json::to_string(&HealthStatus::Healthy).unwrap();
        assert!(healthy_json.contains("Healthy"));

        let degraded_json =
            serde_json::to_string(&HealthStatus::Degraded("slow".to_string())).unwrap();
        assert!(degraded_json.contains("Degraded"));
        assert!(degraded_json.contains("slow"));

        let failed_json =
            serde_json::to_string(&HealthStatus::Failed("crash".to_string())).unwrap();
        assert!(failed_json.contains("Failed"));
    }

    // ── InitializationPhase ────────────────────────────────────────

    #[test]
    fn test_initialization_phase_debug() {
        assert_eq!(format!("{:?}", InitializationPhase::Awakening), "Awakening");
        assert_eq!(format!("{:?}", InitializationPhase::Assembly), "Assembly");
        assert_eq!(format!("{:?}", InitializationPhase::Coronation), "Coronation");
    }

    #[test]
    fn test_initialization_phase_clone() {
        let phase = InitializationPhase::Awakening;
        let cloned = phase.clone();
        assert_eq!(format!("{:?}", phase), format!("{:?}", cloned));
    }

    #[test]
    fn test_initialization_phase_serialize() {
        let json = serde_json::to_string(&InitializationPhase::Awakening).unwrap();
        assert!(json.contains("Awakening"));

        let json = serde_json::to_string(&InitializationPhase::Assembly).unwrap();
        assert!(json.contains("Assembly"));

        let json = serde_json::to_string(&InitializationPhase::Coronation).unwrap();
        assert!(json.contains("Coronation"));
    }

    // ── PhaseEvent ─────────────────────────────────────────────────

    #[test]
    fn test_phase_event_serialization() {
        let event = PhaseEvent {
            phase: InitializationPhase::Awakening,
            service: None,
            message: "Starting database...".to_string(),
            progress: 10.0,
            timestamp: 0,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Awakening"));
        assert!(json.contains("Starting database"));
        assert!(json.contains("10.0"));
    }

    #[test]
    fn test_phase_event_clone() {
        let event = PhaseEvent {
            phase: InitializationPhase::Assembly,
            service: None,
            message: "Loading services".to_string(),
            progress: 75.0,
            timestamp: 0,
        };
        let json1 = serde_json::to_string(&event).unwrap();
        let cloned = event.clone();
        let json2 = serde_json::to_string(&cloned).unwrap();
        assert_eq!(json1, json2);
    }

    #[test]
    fn test_phase_event_deserialize_with_defaults() {
        // Old-format JSON (missing service, timestamp fields) should deserialize
        let old_json = r#"{"phase":"Awakening","message":"test","progress":42.0}"#;
        let event: PhaseEvent = serde_json::from_str(old_json).unwrap();
        assert_eq!(event.service, None);
        assert_eq!(event.timestamp, 0);
        assert_eq!(event.progress, 42.0);
    }

    // ── Mock Service trait implementation ──────────────────────────

    /// A mock service that tracks call counts for lifecycle methods.
    struct MockService {
        name: &'static str,
        priority: u32,
        critical: bool,
        init_count: AtomicUsize,
        start_count: AtomicUsize,
        stop_count: AtomicUsize,
        health: std::sync::RwLock<HealthStatus>,
    }

    impl MockService {
        fn new(name: &'static str) -> Self {
            Self {
                name,
                priority: 100,
                critical: true,
                init_count: AtomicUsize::new(0),
                start_count: AtomicUsize::new(0),
                stop_count: AtomicUsize::new(0),
                health: std::sync::RwLock::new(HealthStatus::Healthy),
            }
        }

        fn with_priority(mut self, p: u32) -> Self {
            self.priority = p;
            self
        }

        fn with_critical(mut self, c: bool) -> Self {
            self.critical = c;
            self
        }

        fn with_health(mut self, h: HealthStatus) -> Self {
            self.health = std::sync::RwLock::new(h);
            self
        }

        fn init_count(&self) -> usize {
            self.init_count.load(Ordering::SeqCst)
        }

        fn start_count(&self) -> usize {
            self.start_count.load(Ordering::SeqCst)
        }

        fn stop_count(&self) -> usize {
            self.stop_count.load(Ordering::SeqCst)
        }

        fn set_health(&self, h: HealthStatus) {
            *self.health.write().unwrap_or_else(|e| e.into_inner()) = h;
        }
    }

    #[async_trait::async_trait]
    impl Service for MockService {
        fn name(&self) -> &'static str {
            self.name
        }

        async fn init(&self) -> anyhow::Result<()> {
            self.init_count.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        async fn start(&self) -> anyhow::Result<()> {
            self.start_count.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        async fn stop(&self) -> anyhow::Result<()> {
            self.stop_count.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        async fn health_check(&self) -> HealthStatus {
            self.health.read().unwrap_or_else(|e| e.into_inner()).clone()
        }

        fn is_critical(&self) -> bool {
            self.critical
        }

        fn priority(&self) -> u32 {
            self.priority
        }
    }

    /// A mock service whose start() always fails.
    struct FailingStartService;

    #[async_trait::async_trait]
    impl Service for FailingStartService {
        fn name(&self) -> &'static str {
            "failing_start"
        }

        async fn init(&self) -> anyhow::Result<()> {
            Ok(())
        }

        async fn start(&self) -> anyhow::Result<()> {
            Err(anyhow::anyhow!("Simulated start failure"))
        }

        async fn stop(&self) -> anyhow::Result<()> {
            Ok(())
        }

        async fn health_check(&self) -> HealthStatus {
            HealthStatus::Healthy
        }

        fn is_critical(&self) -> bool {
            false
        }
    }

    #[test]
    fn test_mock_service_lifecycle() {
        let service = MockService::new("test_service");
        assert_eq!(service.name(), "test_service");
        assert_eq!(service.init_count(), 0);
        assert_eq!(service.start_count(), 0);
        assert_eq!(service.stop_count(), 0);
        assert!(service.is_critical());
    }

    #[tokio::test]
    async fn test_mock_service_init_start_stop() {
        let service = MockService::new("lifecycle_test");
        service.init().await.unwrap();
        assert_eq!(service.init_count(), 1);

        service.start().await.unwrap();
        assert_eq!(service.start_count(), 1);

        service.stop().await.unwrap();
        assert_eq!(service.stop_count(), 1);

        // Call again to verify counters increment
        service.init().await.unwrap();
        service.start().await.unwrap();
        assert_eq!(service.init_count(), 2);
        assert_eq!(service.start_count(), 2);
    }

    #[tokio::test]
    async fn test_mock_service_health_check() {
        let service = MockService::new("health_test");
        assert_eq!(service.health_check().await, HealthStatus::Healthy);

        service.set_health(HealthStatus::Degraded("slow".to_string()));
        let status = service.health_check().await;
        assert!(matches!(status, HealthStatus::Degraded(ref msg) if msg == "slow"));

        service.set_health(HealthStatus::Failed("crash".to_string()));
        assert!(matches!(service.health_check().await, HealthStatus::Failed(_)));
    }

    #[test]
    fn test_mock_service_priority_and_critical() {
        let svc = MockService::new("a").with_priority(10).with_critical(false);
        assert_eq!(svc.priority(), 10);
        assert!(!svc.is_critical());

        let svc2 = MockService::new("b").with_priority(50).with_critical(true);
        assert_eq!(svc2.priority(), 50);
        assert!(svc2.is_critical());
    }

    #[tokio::test]
    async fn test_failing_start_service() {
        let service = FailingStartService;
        service.init().await.unwrap(); // init succeeds
        let result = service.start().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Simulated start failure"));
        service.stop().await.unwrap(); // stop succeeds
    }
}
