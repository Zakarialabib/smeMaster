use tauri::State;
use crate::events::{AppEvent, EventBus};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

#[tauri::command]
pub async fn emit_domain_event(
    bus: State<'_, EventBus>,
    event: AppEvent,
) -> CmdResult<()> {
    bus.emit(event);
    Ok(())
}