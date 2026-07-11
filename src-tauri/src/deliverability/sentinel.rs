// SentinelService: registered as Lazy subsystem + ServiceRegistry service.
// Commands (run_sentinel_check, get_sentinel_alerts) registered in commands/mod.rs.
// Started via ServiceRegistry::start_all() in AppLifecycle::spawn_orchestrator.

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::error::SerializedError;

use super::diagnostic::run_full_diagnostic;
use super::types::DomainHealth;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentinelAlert {
    pub id: String,
    pub alert_type: AlertType,
    pub domain: String,
    pub severity: AlertSeverity,
    pub message: String,
    pub created_at: i64,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertType {
    RegressionDetected,
    KeyExpirationWarning,
    ScoreDropped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

#[allow(dead_code)]
pub async fn check_for_regression(domain: &str, previous: &DomainHealth) -> Option<SentinelAlert> {
    let current = run_full_diagnostic(domain, None).await;

    if previous.spf_status.present && !current.spf_status.present {
        return Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::RegressionDetected,
            domain: domain.to_string(),
            severity: AlertSeverity::Critical,
            message: "SPF record has disappeared. Your emails may be rejected.".into(),
            created_at: now_secs(),
            acknowledged: false,
        });
    }

    if previous.dkim_status.present && !current.dkim_status.present {
        return Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::RegressionDetected,
            domain: domain.to_string(),
            severity: AlertSeverity::Critical,
            message: "DKIM record has disappeared. Your emails may be rejected.".into(),
            created_at: now_secs(),
            acknowledged: false,
        });
    }

    if previous.dmarc_status.present && !current.dmarc_status.present {
        return Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::RegressionDetected,
            domain: domain.to_string(),
            severity: AlertSeverity::Critical,
            message: "DMARC record has disappeared. Your emails may be rejected.".into(),
            created_at: now_secs(),
            acknowledged: false,
        });
    }

    if current.score < previous.score.saturating_sub(20) {
        return Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::ScoreDropped,
            domain: domain.to_string(),
            severity: AlertSeverity::Warning,
            message: format!(
                "Domain score dropped from {} to {} in the last check.",
                previous.score, current.score
            ),
            created_at: now_secs(),
            acknowledged: false,
        });
    }

    None
}

#[allow(dead_code)]
pub async fn check_dkim_expiration(domain: &str, key_age_days: u64) -> Option<SentinelAlert> {
    if key_age_days > 365 {
        Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::KeyExpirationWarning,
            domain: domain.to_string(),
            severity: AlertSeverity::Warning,
            message: format!(
                "DKIM key is {} days old. Consider rotating for security.",
                key_age_days
            ),
            created_at: now_secs(),
            acknowledged: false,
        })
    } else {
        None
    }
}

pub fn check_score_threshold(domain: &str, score: u8) -> Option<SentinelAlert> {
    if score < 50 {
        Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::ScoreDropped,
            domain: domain.to_string(),
            severity: AlertSeverity::Critical,
            message: format!(
                "Domain health score is critically low ({}/100). Immediate action required.",
                score
            ),
            created_at: now_secs(),
            acknowledged: false,
        })
    } else if score < 70 {
        Some(SentinelAlert {
            id: generate_alert_id(),
            alert_type: AlertType::ScoreDropped,
            domain: domain.to_string(),
            severity: AlertSeverity::Warning,
            message: format!(
                "Domain health score is below optimal ({}/100). Review recommendations.",
                score
            ),
            created_at: now_secs(),
            acknowledged: false,
        })
    } else {
        None
    }
}

fn generate_alert_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("sentinel_{}", ts)
}

fn now_secs() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[tauri::command]
pub async fn run_sentinel_check(
    domain: String,
    _previous_score: u8,
) -> Result<Vec<SentinelAlert>, SerializedError> {
    // Require deliverability_sentinel subsystem active
    crate::orchestrator::require_subsystem("deliverability_sentinel", None)
        .await
        .map_err(|e| SerializedError::from(e))?;

    let health = run_full_diagnostic(&domain, None).await;
    let mut alerts = Vec::new();
    if let Some(alert) = check_score_threshold(&domain, health.score) {
        alerts.push(alert);
    }
    Ok(alerts)
}

// ── SentinelService — Periodic DNS deliverability monitor ────────────────

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use async_trait::async_trait;

use crate::orchestrator::service::{HealthStatus, Service};

/// Background service that periodically runs deliverability checks
/// on registered domains and publishes alerts via EventBus.
///
/// Priority: 50 (after sync, before backup).
/// Non-critical (won't block startup).
///
/// Data flow:
///   Orchestrator.start_all() → SentinelService.start()
///     → tokio::spawn 30-min interval loop
///       → run_sentinel_check(domain) per registered domain
///         → stores alerts in Vec (max 100)
///         → emits sentinel:alert events via EventBus
pub struct SentinelService {
    handle: tauri::AppHandle,
    running: Arc<AtomicBool>,
    alerts: Arc<Mutex<Vec<SentinelAlert>>>,
    domains: Arc<Mutex<Vec<String>>>,
    /// Callback to report idle to SubsystemRegistry.
    /// Set by SubsystemRegistry on activation.
    pub report_idle: Arc<Mutex<Option<Box<dyn Fn() + Send + Sync>>>>,
}

impl SentinelService {
    pub fn new(handle: tauri::AppHandle) -> Self {
        Self {
            handle,
            running: Arc::new(AtomicBool::new(false)),
            alerts: Arc::new(Mutex::new(Vec::new())),
            domains: Arc::new(Mutex::new(Vec::new())),
            report_idle: Arc::new(Mutex::new(None)),
        }
    }

    /// Call after a check cycle completes. Reports idle if no active domain checks.
    #[allow(dead_code)] // part of idle shutdown protocol (future)
    pub fn maybe_report_idle(&self) {
        if let Ok(callback) = self.report_idle.lock() {
            if let Some(cb) = callback.as_ref() {
                let domains_empty = self.domains
                    .lock()
                    .map(|d| d.is_empty())
                    .unwrap_or(true);
                if domains_empty {
                    cb();
                }
            }
        }
    }

    /// Return a snapshot of current alerts.
    pub fn get_alerts(&self) -> Vec<SentinelAlert> {
        self.alerts
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    /// Clear all stored alerts.
    #[allow(dead_code)]
    pub fn clear_alerts(&self) {
        self.alerts
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clear();
    }

    /// Register a domain for periodic checks.
    #[allow(dead_code)]
    pub fn add_domain(&self, domain: String) {
        self.domains
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .push(domain);
    }
}

#[async_trait]
impl Service for SentinelService {
    fn name(&self) -> &'static str {
        "sentinel"
    }

    fn priority(&self) -> u32 {
        50
    }

    fn is_critical(&self) -> bool {
        false
    }

    async fn init(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[sentinel] Sentinel service initialized");
        Ok(())
    }

    async fn start(&self) -> anyhow::Result<()> {
        self.running.store(true, Ordering::SeqCst);

        let handle = self.handle.clone();
        let running = self.running.clone();
        let alerts = self.alerts.clone();
        let domains = self.domains.clone();
        let report_idle = self.report_idle.clone();

        // Spawn the periodic check loop (30-minute interval)
        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(std::time::Duration::from_secs(30 * 60));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

            // Give a brief initial delay so the app settles before the first check
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            while running.load(Ordering::SeqCst) {
                interval.tick().await;

                let current_domains =
                    domains.lock().unwrap_or_else(|e| e.into_inner()).clone();
                if current_domains.is_empty() {
                    log::trace!("[sentinel] No domains registered, skipping check cycle");
                    // Report idle if no domains to check
                    if let Ok(cb_guard) = report_idle.lock() {
                        if let Some(cb) = cb_guard.as_ref() {
                            cb();
                        }
                    }
                    continue;
                }

                log::info!(
                    "[sentinel] Running periodic check for {} domain(s)",
                    current_domains.len()
                );

                for domain in &current_domains {
                    match run_sentinel_check(domain.clone(), 0).await {
                        Ok(mut domain_alerts) => {
                            if domain_alerts.is_empty() {
                                continue;
                            }

                            let mut alert_list =
                                alerts.lock().unwrap_or_else(|e| e.into_inner());

                            for alert in domain_alerts.drain(..) {
                                // Emit via EventBus if available
                                if let Some(bus) =
                                    handle.try_state::<crate::events::EventBus>()
                                {
                                    bus.emit(crate::events::AppEvent::Unknown {
                                        event: "sentinel:alert".into(),
                                        payload: serde_json::to_value(&alert)
                                            .unwrap_or_default(),
                                    });
                                }
                                // Log the alert (use Debug format to avoid partial move)
                                log::warn!(
                                    "[sentinel] Alert [{:?}] {}: {}",
                                    alert.severity,
                                    alert.domain,
                                    alert.message
                                );

                                alert_list.push(alert);

                                // Enforce max capacity (FIFO eviction)
                                if alert_list.len() > 100 {
                                    alert_list.remove(0);
                                }
                            }
                        }
                        Err(e) => {
                            log::error!(
                                "[sentinel] Check failed for domain '{}': {}",
                                domain,
                                e
                            );
                        }
                    }
                }
            }
        });

        log::info!("[sentinel] Sentinel service started — 30-min check interval");
        Ok(())
    }

    async fn stop(&self) -> anyhow::Result<()> {
        self.running.store(false, Ordering::SeqCst);
        log::info!("[sentinel] Sentinel service stopped");
        Ok(())
    }

    async fn health_check(&self) -> HealthStatus {
        if self.running.load(Ordering::SeqCst) {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded("Sentinel service is not running".into())
        }
    }
}

/// Retrieve current sentinel alerts from the managed `SentinelService`.
#[tauri::command]
pub async fn get_sentinel_alerts(
    handle: tauri::AppHandle,
) -> Result<Vec<SentinelAlert>, SerializedError> {
    // Require deliverability_sentinel subsystem active
    crate::orchestrator::require_subsystem("deliverability_sentinel", None)
        .await
        .map_err(|e| SerializedError::from(e))?;

    if let Some(service) = handle.try_state::<std::sync::Arc<SentinelService>>() {
        Ok(service.get_alerts())
    } else {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::deliverability::types::RecordStatus;

    fn make_domain_health(score: u8, spf: bool, dkim: bool, dmarc: bool) -> DomainHealth {
        use chrono::Utc;
        DomainHealth {
            domain: "example.com".into(),
            score,
            spf_status: RecordStatus {
                present: spf,
                valid: spf,
                issues: vec![],
                raw_value: None,
            },
            dkim_status: RecordStatus {
                present: dkim,
                valid: dkim,
                issues: vec![],
                raw_value: None,
            },
            dmarc_status: RecordStatus {
                present: dmarc,
                valid: dmarc,
                issues: vec![],
                raw_value: None,
            },
            ptr_status: RecordStatus::default(),
            mx_status: RecordStatus::default(),
            blacklist_status: vec![],
            checked_at: Utc::now(),
        }
    }

    #[test]
    fn test_generate_alert_id_not_empty() {
        let id = generate_alert_id();
        assert!(id.starts_with("sentinel_"));
    }

    #[test]
    fn test_now_secs_positive() {
        assert!(now_secs() > 1_700_000_000);
    }

    #[test]
    fn test_check_score_threshold_critical() {
        let alert = check_score_threshold("example.com", 30);
        assert!(alert.is_some());
        let a = alert.unwrap();
        assert!(matches!(a.severity, AlertSeverity::Critical));
        assert!(matches!(a.alert_type, AlertType::ScoreDropped));
    }

    #[test]
    fn test_check_score_threshold_warning() {
        let alert = check_score_threshold("example.com", 60);
        assert!(alert.is_some());
        let a = alert.unwrap();
        assert!(matches!(a.severity, AlertSeverity::Warning));
    }

    #[test]
    fn test_check_score_threshold_ok() {
        assert!(check_score_threshold("example.com", 85).is_none());
        assert!(check_score_threshold("example.com", 70).is_none());
    }

    #[tokio::test]
    async fn test_check_dkim_expiration_old() {
        let alert = check_dkim_expiration("example.com", 400).await;
        assert!(alert.is_some());
        let a = alert.unwrap();
        assert!(matches!(a.alert_type, AlertType::KeyExpirationWarning));
        assert!(matches!(a.severity, AlertSeverity::Warning));
    }

    #[tokio::test]
    async fn test_check_dkim_expiration_recent() {
        assert!(check_dkim_expiration("example.com", 100).await.is_none());
        assert!(check_dkim_expiration("example.com", 365).await.is_none());
    }

    #[test]
    fn test_check_for_regression_spf_disappeared() {
        let previous = make_domain_health(80, true, true, true);
        assert_eq!(previous.spf_status.present, true);
    }

    #[test]
    fn test_sentinel_alert_serde() {
        let alert = SentinelAlert {
            id: "sentinel_123".into(),
            alert_type: AlertType::RegressionDetected,
            domain: "example.com".into(),
            severity: AlertSeverity::Critical,
            message: "test".into(),
            created_at: 1_700_000_000,
            acknowledged: false,
        };
        let json = serde_json::to_string(&alert).unwrap();
        assert!(json.contains("RegressionDetected"));
        assert!(json.contains("Critical"));

        let deserialized: SentinelAlert = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, "sentinel_123");
        assert_eq!(deserialized.domain, "example.com");
    }
}
