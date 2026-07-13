use crate::events::EventBus;
use crate::orchestrator::{StateMachine, SubsystemRegistry};
use std::sync::Arc;

/// Centralized application state bundling core infrastructure.
///
/// This is a lightweight wrapper — domain-specific managed types
/// (AiState, SessionPoolManager, IdleRegistry, etc.) remain as
/// separate `app.manage()` calls for backward compatibility.
///
/// ## Construction timing
///
/// `EventBus` is managed early in setup (line ~381 of lib.rs). The
/// `SubsystemRegistry` and `StateMachine` are created by
/// `wire_subsystem_lifecycle` (line ~442). `AppState` is therefore
/// constructed right after that call, before `spawn_orchestrator`.
///
/// ## What about ServiceRegistry?
///
/// `ServiceRegistry` is created inside the async `spawn_orchestrator`
/// and is not yet managed as Tauri state. It will be added to
/// `AppState` after shared-core extraction makes its lifetime explicit.
/// For now, commands that need ServiceRegistry access should obtain it
/// via other means (e.g., Watchdog).
///
/// ## Dead-code note
///
/// Fields are `pub` and accessed via `app.state::<AppState>()` — the
/// compiler cannot see these dynamic accesses, so dead_code is allowed.
#[allow(dead_code)]
pub struct AppState {
    /// Central typed event bus (Clone — wrapps broadcast::Sender)
    pub event_bus: EventBus,
    /// Registry of all subsystems with CAS-based lifecycle
    pub subsystem_registry: Arc<SubsystemRegistry>,
    /// System state machine (Booting → Onboarding → Ready)
    pub state_machine: Arc<StateMachine>,
}

impl AppState {
    pub fn new(
        event_bus: EventBus,
        subsystem_registry: Arc<SubsystemRegistry>,
        state_machine: Arc<StateMachine>,
    ) -> Self {
        Self {
            event_bus,
            subsystem_registry,
            state_machine,
        }
    }
}
