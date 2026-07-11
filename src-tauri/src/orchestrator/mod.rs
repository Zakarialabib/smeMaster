pub mod service;
pub mod services;
pub mod watchdog;
pub mod subsystem_lifecycle;
pub mod state_machine;
pub mod tool_registry;
pub mod gating;
pub mod init;
pub mod onboarding;

pub use service::{Service, ServiceRegistry, HealthStatus, InitializationPhase, PhaseEvent};
pub use services::{DatabaseService, PgpService, SyncService, BackupSchedulerService, SyncMonitorService, VaultService, StubService, get_sync_health_summary};
pub use watchdog::Watchdog;
pub use subsystem_lifecycle::{SubsystemRegistry, SubsystemStatus, SubsystemEntry, SubsystemClass, ServiceHandle, SubsystemStatusSnapshot};
pub use state_machine::{StateMachine, SystemState};
pub use tool_registry::ToolRegistry;
pub use gating::{require_subsystem_active, require_subsystem, get_subsystem_status, get_tool_state, apply_tool_state};

use tauri::{Builder, Wry};

// Register all command handlers with the Tauri builder.
//
// NOTE: This module's #[tauri::command] functions are wired up
// in the master commands::register() handler list. Each module's
// `register()` is a no-op pass-through because Tauri v2 keeps
// only the LAST `invoke_handler(...)` call — calling it here
// would REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}
