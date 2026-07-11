pub mod backup_restore;
pub mod data_export;
pub mod mbox;
pub mod pdf_report;
pub mod scheduler;
pub mod types;

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
