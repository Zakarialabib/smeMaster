use std::sync::{Arc, OnceLock};

use crate::errors::AppError;
use crate::orchestrator::subsystem_lifecycle::SubsystemRegistry;
use crate::orchestrator::ToolRegistry;

/// Global registry reference, set once during app init.
/// Allows commands to gate without needing `AppHandle` as a parameter.
static GLOBAL_REGISTRY: OnceLock<Arc<SubsystemRegistry>> = OnceLock::new();

/// Global tool registry reference, set once during app init.
/// Used for get_tool_state/apply_tool_state commands.
static GLOBAL_TOOL_REGISTRY: OnceLock<Arc<ToolRegistry>> = OnceLock::new();

/// Store the global registry reference for command gating.
/// Called once during app init (orchestrator::init::wire_subsystem_lifecycle).
pub fn set_global_registry(registry: Arc<SubsystemRegistry>) {
    let _ = GLOBAL_REGISTRY.set(registry);
}

/// Store the global tool registry reference.
/// Called once during app init.
pub fn set_global_tool_registry(registry: Arc<ToolRegistry>) {
    let _ = GLOBAL_TOOL_REGISTRY.set(registry);
}

/// Primary gating function for commands.
/// Checks status, feature flag (advisory), state machine.
/// Returns Ok(()) if the subsystem can be activated.
pub async fn require_subsystem_active(
    registry: &SubsystemRegistry,
    name: &str,
    _feature_flag: Option<&'static str>,
) -> Result<(), AppError> {
    // Delegate to registry CAS activation
    registry.require_active(name).await
}

/// Convenience: require a subsystem to be active, using the global registry.
/// Panics if the global registry has not been initialized (should never happen
/// at runtime since init always runs before commands).
pub async fn require_subsystem(
    name: &str,
    feature_flag: Option<&'static str>,
) -> Result<(), AppError> {
    let registry = GLOBAL_REGISTRY
        .get()
        .expect("SubsystemRegistry global not set — init must call set_global_registry");
    require_subsystem_active(registry, name, feature_flag).await
}

/// IPC command: get all subsystem status for frontend observability.
#[tauri::command]
pub fn get_subsystem_status(
    registry: tauri::State<'_, std::sync::Arc<SubsystemRegistry>>,
) -> Vec<crate::orchestrator::subsystem_lifecycle::SubsystemStatusSnapshot> {
    registry.get_all_status()
}

/// IPC command: restart a named subsystem and return its post-restart status.
///
/// Delegates to `SubsystemRegistry::restart_subsystem`, which performs a real
/// stop (force_shutdown) followed by class-appropriate re-activation, then
/// returns the single entry's `SubsystemStatusSnapshot`.
#[tauri::command]
pub async fn db_restart_subsystem(
    registry: tauri::State<'_, std::sync::Arc<SubsystemRegistry>>,
    name: String,
) -> Result<crate::orchestrator::subsystem_lifecycle::SubsystemStatusSnapshot, crate::error::SerializedError> {
    registry
        .restart_subsystem(&name)
        .await
        .map_err(crate::error::SerializedError::from)
}

/// IPC command: get all tool states from the ToolRegistry.
/// Returns a list of (tool_id, enabled) tuples.
#[tauri::command]
pub fn get_tool_state(
    registry: tauri::State<'_, Arc<ToolRegistry>>,
) -> Vec<(String, bool)> {
    registry.get_all()
}

/// IPC command: apply tool state changes.
/// Takes a list of (tool_id, enabled) tuples and updates the registry.
#[tauri::command]
pub fn apply_tool_state(
    registry: tauri::State<'_, Arc<ToolRegistry>>,
    updates: Vec<(String, bool)>,
) -> Result<(), String> {
    for (tool_id, enabled) in updates {
        registry.set_enabled(&tool_id, enabled);
    }
    Ok(())
}
