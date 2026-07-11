use std::sync::Arc;
use tokio::sync::RwLock;

use crate::events::{AppEvent, EventBus};
use crate::orchestrator::subsystem_lifecycle::SubsystemRegistry;

/// System state that mirrors the React OnboardingWizard.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemState {
    Booting,
    Onboarding,
    Ready,
}

impl Default for SystemState {
    fn default() -> Self {
        SystemState::Booting
    }
}

/// Thin Rust FSM. Transitions mirror React OnboardingWizard events.
/// React drives UX; Rust mirrors state for activation gating.
pub struct StateMachine {
    state: RwLock<SystemState>,
    subsystem_registry: Arc<SubsystemRegistry>,
    event_bus: Arc<EventBus>,
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
        }
    }

    /// Transition to a new state. On Ready: enable all Lazy subsystems.
    pub async fn transition(&self, new_state: SystemState) {
        let old = {
            let mut state = self.state.write().await;
            std::mem::replace(&mut *state, new_state)
        };

        match new_state {
            SystemState::Ready => {
                log::info!("[state-machine] Transitioning to Ready — enabling subsystems");
                self.subsystem_registry.enable_ready_subsystems().await;
                self.event_bus.emit(AppEvent::SystemReady);
            }
            SystemState::Onboarding => {
                log::info!("[state-machine] Entering Onboarding");
            }
            SystemState::Booting => {
                log::info!("[state-machine] Booting");
            }
        }

        log::info!("[state-machine] {:?} → {:?}", old, new_state);
    }

    pub async fn current(&self) -> SystemState {
        *self.state.read().await
    }

    /// Called when onboarding completes (from frontend IPC).
    pub async fn complete_onboarding(&self) {
        self.transition(SystemState::Ready).await;
    }
}
