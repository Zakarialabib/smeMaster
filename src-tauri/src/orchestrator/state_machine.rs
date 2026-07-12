use std::sync::Arc;
use std::fmt;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

use crate::events::{AppEvent, EventBus};
use crate::orchestrator::subsystem_lifecycle::SubsystemRegistry;

/// System state that mirrors the application lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SystemState {
    Booting,
    Onboarding,
    Ready,
    Degraded,
    Offline,
    Recovering,
    ShuttingDown,
}

impl Default for SystemState {
    fn default() -> Self {
        SystemState::Booting
    }
}

impl fmt::Display for SystemState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SystemState::Booting => write!(f, "Booting"),
            SystemState::Onboarding => write!(f, "Onboarding"),
            SystemState::Ready => write!(f, "Ready"),
            SystemState::Degraded => write!(f, "Degraded"),
            SystemState::Offline => write!(f, "Offline"),
            SystemState::Recovering => write!(f, "Recovering"),
            SystemState::ShuttingDown => write!(f, "ShuttingDown"),
        }
    }
}

/// A recorded state transition with metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateTransition {
    pub from: SystemState,
    pub to: SystemState,
    pub reason: String,
    pub at_ms: i64,
}

/// Thin Rust FSM. Transitions mirror application lifecycle events.
/// React drives UX; Rust mirrors state for activation gating.
pub struct StateMachine {
    state: RwLock<SystemState>,
    subsystem_registry: Arc<SubsystemRegistry>,
    event_bus: Arc<EventBus>,
    history: RwLock<Vec<StateTransition>>,
    max_history: usize,
    on_transition_cb: RwLock<Option<Arc<dyn Fn(SystemState, SystemState) + Send + Sync>>>,
}

impl StateMachine {
    pub fn new(
        subsystem_registry: Arc<SubsystemRegistry>,
        event_bus: Arc<EventBus>,
    ) -> Self {
        Self {
            state: RwLock::new(SystemState::Booting),
            subsystem_registry,
            event_bus,
            history: RwLock::new(Vec::new()),
            max_history: 100,
            on_transition_cb: RwLock::new(None),
        }
    }

    /// Attempt a validated transition to a new state.
    /// Returns `Err` if the transition is disallowed by the state machine rules.
    pub async fn try_transition(&self, to: SystemState, reason: &str) -> Result<(), String> {
        let from = *self.state.read().await;
        validate_transition(&from, &to)?;

        let at_ms = chrono::Utc::now().timestamp_millis();

        let transition = StateTransition {
            from,
            to,
            reason: reason.to_string(),
            at_ms,
        };

        // Update state
        *self.state.write().await = transition.to;

        // Record history
        {
            let mut history = self.history.write().await;
            history.push(transition.clone());
            if history.len() > self.max_history {
                history.remove(0);
            }
        }

        log::info!("[state-machine] {:?} → {:?} ({})", from, transition.to, reason);

        // Invoke transition callback
        if let Some(cb) = self.on_transition_cb.read().await.as_ref() {
            cb(from, transition.to);
        }

        // Handle side effects for specific transitions
        if transition.to == SystemState::Ready {
            log::info!("[state-machine] Transitioning to Ready — enabling subsystems");
            self.subsystem_registry.enable_ready_subsystems().await;
            self.event_bus.emit(AppEvent::SystemReady);
        }

        Ok(())
    }

    /// Transition to a new state (infalible — uses a default reason string).
    /// This is a convenience wrapper around `try_transition` that ignores errors.
    pub async fn transition(&self, new_state: SystemState) {
        let reason = match new_state {
            SystemState::Ready => "system-ready",
            SystemState::Onboarding => "onboarding-started",
            SystemState::Booting => "system-booting",
            SystemState::Degraded => "system-degraded",
            SystemState::Offline => "network-offline",
            SystemState::Recovering => "system-recovering",
            SystemState::ShuttingDown => "system-shutdown",
        };
        let _ = self.try_transition(new_state, reason).await;
    }

    /// Get the current system state.
    pub async fn current(&self) -> SystemState {
        *self.state.read().await
    }

    /// Called when onboarding completes (from frontend IPC).
    pub async fn complete_onboarding(&self) {
        self.transition(SystemState::Ready).await;
    }

    /// Register a callback invoked on every state transition.
    /// The callback receives `(from, to)` state values.
    pub fn on_transition<F>(&self, f: F)
    where
        F: Fn(SystemState, SystemState) + Send + Sync + 'static,
    {
        *self.on_transition_cb.blocking_write() = Some(Arc::new(f));
    }

    /// Get recent transition history, up to `limit` entries (most recent first).
    pub async fn history(&self, limit: usize) -> Vec<StateTransition> {
        let history = self.history.read().await;
        let len = history.len();
        if len == 0 {
            return Vec::new();
        }
        let start = if len > limit { len - limit } else { 0 };
        history[start..].iter().cloned().rev().collect()
    }
}

/// Validate whether a transition from `from` to `to` is allowed.
/// `ShuttingDown` is always reachable from any state.
fn validate_transition(from: &SystemState, to: &SystemState) -> Result<(), String> {
    if *to == SystemState::ShuttingDown {
        return Ok(());
    }
    match (from, to) {
        (SystemState::Booting, SystemState::Onboarding) => Ok(()),
        (SystemState::Booting, SystemState::Ready) => Ok(()),
        (SystemState::Onboarding, SystemState::Ready) => Ok(()),
        (SystemState::Ready, SystemState::Degraded) => Ok(()),
        (SystemState::Ready, SystemState::Offline) => Ok(()),
        (SystemState::Degraded, SystemState::Ready) => Ok(()),
        (SystemState::Degraded, SystemState::Offline) => Ok(()),
        (SystemState::Degraded, SystemState::Recovering) => Ok(()),
        (SystemState::Offline, SystemState::Ready) => Ok(()),
        (SystemState::Offline, SystemState::Recovering) => Ok(()),
        (SystemState::Recovering, SystemState::Ready) => Ok(()),
        (SystemState::Recovering, SystemState::Degraded) => Ok(()),
        (SystemState::Recovering, SystemState::Offline) => Ok(()),
        _ => Err(format!(
            "Transition from {:?} to {:?} is not allowed",
            from, to
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::EventBus;
    use crate::orchestrator::subsystem_lifecycle::SubsystemRegistry;

    fn make_state_machine() -> StateMachine {
        let registry = Arc::new(SubsystemRegistry::new_test());
        let (event_bus, _rx) = EventBus::new(100);
        StateMachine::new(registry, Arc::new(event_bus))
    }

    fn make_state_machine_at(state: SystemState) -> StateMachine {
        let sm = make_state_machine();
        // Bypass validation to set initial test state
        *sm.state.blocking_write() = state;
        sm
    }

    // ── Initial state ───────────────────────────────────────────────

    #[tokio::test]
    async fn test_initial_state_is_booting() {
        let sm = make_state_machine();
        assert_eq!(sm.current().await, SystemState::Booting);
    }

    #[tokio::test]
    async fn test_default_is_booting() {
        assert_eq!(SystemState::default(), SystemState::Booting);
    }

    // ── Display ─────────────────────────────────────────────────────

    #[test]
    fn test_display() {
        assert_eq!(SystemState::Booting.to_string(), "Booting");
        assert_eq!(SystemState::Onboarding.to_string(), "Onboarding");
        assert_eq!(SystemState::Ready.to_string(), "Ready");
        assert_eq!(SystemState::Degraded.to_string(), "Degraded");
        assert_eq!(SystemState::Offline.to_string(), "Offline");
        assert_eq!(SystemState::Recovering.to_string(), "Recovering");
        assert_eq!(SystemState::ShuttingDown.to_string(), "ShuttingDown");
    }

    // ── Valid transitions (via transition / try_transition) ────────

    #[tokio::test]
    async fn test_booting_to_onboarding() {
        let sm = make_state_machine();
        sm.transition(SystemState::Onboarding).await;
        assert_eq!(sm.current().await, SystemState::Onboarding);
    }

    #[tokio::test]
    async fn test_booting_to_ready() {
        let sm = make_state_machine();
        sm.transition(SystemState::Ready).await;
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    #[tokio::test]
    async fn test_onboarding_to_ready() {
        let sm = make_state_machine_at(SystemState::Onboarding);
        sm.transition(SystemState::Ready).await;
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    #[tokio::test]
    async fn test_ready_to_degraded() {
        let sm = make_state_machine_at(SystemState::Ready);
        sm.transition(SystemState::Degraded).await;
        assert_eq!(sm.current().await, SystemState::Degraded);
    }

    #[tokio::test]
    async fn test_ready_to_offline() {
        let sm = make_state_machine_at(SystemState::Ready);
        sm.transition(SystemState::Offline).await;
        assert_eq!(sm.current().await, SystemState::Offline);
    }

    #[tokio::test]
    async fn test_degraded_to_ready() {
        let sm = make_state_machine_at(SystemState::Degraded);
        sm.transition(SystemState::Ready).await;
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    #[tokio::test]
    async fn test_degraded_to_offline() {
        let sm = make_state_machine_at(SystemState::Degraded);
        sm.transition(SystemState::Offline).await;
        assert_eq!(sm.current().await, SystemState::Offline);
    }

    #[tokio::test]
    async fn test_degraded_to_recovering() {
        let sm = make_state_machine_at(SystemState::Degraded);
        sm.transition(SystemState::Recovering).await;
        assert_eq!(sm.current().await, SystemState::Recovering);
    }

    #[tokio::test]
    async fn test_offline_to_ready() {
        let sm = make_state_machine_at(SystemState::Offline);
        sm.transition(SystemState::Ready).await;
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    #[tokio::test]
    async fn test_offline_to_recovering() {
        let sm = make_state_machine_at(SystemState::Offline);
        sm.transition(SystemState::Recovering).await;
        assert_eq!(sm.current().await, SystemState::Recovering);
    }

    #[tokio::test]
    async fn test_recovering_to_ready() {
        let sm = make_state_machine_at(SystemState::Recovering);
        sm.transition(SystemState::Ready).await;
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    #[tokio::test]
    async fn test_recovering_to_degraded() {
        let sm = make_state_machine_at(SystemState::Recovering);
        sm.transition(SystemState::Degraded).await;
        assert_eq!(sm.current().await, SystemState::Degraded);
    }

    #[tokio::test]
    async fn test_recovering_to_offline() {
        let sm = make_state_machine_at(SystemState::Recovering);
        sm.transition(SystemState::Offline).await;
        assert_eq!(sm.current().await, SystemState::Offline);
    }

    // ── ShuttingDown is always allowed from any state ─────────────

    #[tokio::test]
    async fn test_shutting_down_from_booting() {
        let sm = make_state_machine();
        sm.transition(SystemState::ShuttingDown).await;
        assert_eq!(sm.current().await, SystemState::ShuttingDown);
    }

    #[tokio::test]
    async fn test_shutting_down_from_ready() {
        let sm = make_state_machine_at(SystemState::Ready);
        sm.transition(SystemState::ShuttingDown).await;
        assert_eq!(sm.current().await, SystemState::ShuttingDown);
    }

    #[tokio::test]
    async fn test_shutting_down_from_degraded() {
        let sm = make_state_machine_at(SystemState::Degraded);
        sm.transition(SystemState::ShuttingDown).await;
        assert_eq!(sm.current().await, SystemState::ShuttingDown);
    }

    #[tokio::test]
    async fn test_shutting_down_from_recovering() {
        let sm = make_state_machine_at(SystemState::Recovering);
        sm.transition(SystemState::ShuttingDown).await;
        assert_eq!(sm.current().await, SystemState::ShuttingDown);
    }

    // ── Invalid transitions (via try_transition) ──────────────────

    #[tokio::test]
    async fn test_onboarding_cannot_go_back_to_booting() {
        let sm = make_state_machine_at(SystemState::Onboarding);
        let result = sm.try_transition(SystemState::Booting, "test").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not allowed"));
    }

    #[tokio::test]
    async fn test_booting_cannot_go_to_degraded() {
        let sm = make_state_machine();
        let result = sm.try_transition(SystemState::Degraded, "test").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_ready_cannot_go_back_to_booting() {
        let sm = make_state_machine_at(SystemState::Ready);
        let result = sm.try_transition(SystemState::Booting, "test").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_ready_cannot_go_to_onboarding() {
        let sm = make_state_machine_at(SystemState::Ready);
        let result = sm.try_transition(SystemState::Onboarding, "test").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_invalid_transition_does_not_change_state() {
        let sm = make_state_machine_at(SystemState::Ready);
        let result = sm.try_transition(SystemState::Booting, "test").await;
        assert!(result.is_err());
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    // ── try_transition with custom reason ─────────────────────────

    #[tokio::test]
    async fn test_try_transition_returns_ok_for_valid() {
        let sm = make_state_machine();
        let result = sm.try_transition(SystemState::Onboarding, "user-started-onboarding").await;
        assert!(result.is_ok());
        assert_eq!(sm.current().await, SystemState::Onboarding);
    }

    // ── History ───────────────────────────────────────────────────

    #[tokio::test]
    async fn test_history_records_transitions() {
        let sm = make_state_machine();
        sm.transition(SystemState::Onboarding).await;
        sm.transition(SystemState::Ready).await;

        let history = sm.history(10).await;
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].from, SystemState::Onboarding);
        assert_eq!(history[0].to, SystemState::Ready);
        assert_eq!(history[1].from, SystemState::Booting);
        assert_eq!(history[1].to, SystemState::Onboarding);
    }

    #[tokio::test]
    async fn test_history_respects_limit() {
        let sm = make_state_machine();
        sm.transition(SystemState::Onboarding).await;
        sm.transition(SystemState::Ready).await;

        let history = sm.history(1).await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].to, SystemState::Ready);
    }

    #[tokio::test]
    async fn test_history_empty_when_no_transitions() {
        let sm = make_state_machine();
        let history = sm.history(10).await;
        assert!(history.is_empty());
    }

    #[tokio::test]
    async fn test_history_records_reason() {
        let sm = make_state_machine();
        sm.try_transition(SystemState::Onboarding, "custom-reason").await.unwrap();
        let history = sm.history(10).await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].reason, "custom-reason");
    }

    #[tokio::test]
    async fn test_history_contains_timestamp() {
        let sm = make_state_machine();
        sm.transition(SystemState::Onboarding).await;
        let history = sm.history(10).await;
        assert!(history[0].at_ms > 0);
    }

    #[tokio::test]
    async fn test_history_max_capacity() {
        let sm = make_state_machine();
        // The default max_history is 100
        for _ in 0..150 {
            sm.transition(SystemState::Onboarding).await;
            sm.transition(SystemState::Ready).await;
            sm.transition(SystemState::Booting).await;
        }
        let history = sm.history(200).await;
        assert!(history.len() <= 100);
    }

    // ── on_transition callback ────────────────────────────────────

    #[tokio::test]
    async fn test_on_transition_callback_invoked() {
        let sm = make_state_machine();
        let invoked = Arc::new(tokio::sync::Mutex::new(Vec::new()));
        let invoked_clone = invoked.clone();

        sm.on_transition(move |from, to| {
            let data = &mut *invoked_clone.blocking_lock();
            data.push((from, to));
        });

        sm.transition(SystemState::Onboarding).await;
        sm.transition(SystemState::Ready).await;

        let data = invoked.lock().await;
        assert_eq!(data.len(), 2);
        assert_eq!(data[0], (SystemState::Booting, SystemState::Onboarding));
        assert_eq!(data[1], (SystemState::Onboarding, SystemState::Ready));
    }

    // ── complete_onboarding ───────────────────────────────────────

    #[tokio::test]
    async fn test_complete_onboarding_transitions_to_ready() {
        let sm = make_state_machine_at(SystemState::Onboarding);
        sm.complete_onboarding().await;
        assert_eq!(sm.current().await, SystemState::Ready);
    }

    // ── validate_transition unit tests ────────────────────────────

    #[test]
    fn test_validate_shutting_down_from_any_state() {
        // ShuttingDown must be reachable from every state
        let all_states = [
            SystemState::Booting,
            SystemState::Onboarding,
            SystemState::Ready,
            SystemState::Degraded,
            SystemState::Offline,
            SystemState::Recovering,
            SystemState::ShuttingDown,
        ];
        for from in &all_states {
            assert!(
                validate_transition(from, &SystemState::ShuttingDown).is_ok(),
                "ShuttingDown should be allowed from {:?}",
                from
            );
        }
    }

    #[test]
    fn test_validate_self_transitions_not_allowed() {
        // Self-transitions are not in the allowed list
        let all_states = [
            SystemState::Booting,
            SystemState::Onboarding,
            SystemState::Ready,
            SystemState::Degraded,
            SystemState::Offline,
            SystemState::Recovering,
            // ShuttingDown -> ShuttingDown IS allowed via the early return
        ];
        for state in &all_states {
            assert!(
                validate_transition(state, state).is_err(),
                "Self-transition from {:?} should not be allowed",
                state
            );
        }
    }

    // ── StateTransition struct ────────────────────────────────────

    #[test]
    fn test_state_transition_struct() {
        let t = StateTransition {
            from: SystemState::Booting,
            to: SystemState::Ready,
            reason: "fast-boot".to_string(),
            at_ms: 1234567890,
        };
        assert_eq!(t.from, SystemState::Booting);
        assert_eq!(t.to, SystemState::Ready);
        assert_eq!(t.reason, "fast-boot");
        assert_eq!(t.at_ms, 1234567890);
    }
}
