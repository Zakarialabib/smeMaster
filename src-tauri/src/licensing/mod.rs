//! Licensing module.
//!
//! Bundles the hardware-fingerprint generator and the Ed25519-verifying
//! license cache into a single, well-named feature surface, and exposes
//! two wiring helpers that mirror the rest of the codebase's
//! `register()` / `init()` idiom:
//!
//! * [`register`] appends the licensing `#[tauri::command]` handlers
//!   onto the application's `tauri::generate_handler!` chain. Call this
//!   from `lib.rs::run()` while the builder is being assembled.
//! * [`init`] registers the licensing-related managed state
//!   (`HardwareId` and `LicenseState`) into the Tauri app and, when a
//!   database pool is supplied, binds the pool to `LicenseState` so
//!   that license activation/validation can persist. Call this from
//!   the `setup` closure once the database pool exists.

/// Register all command handlers with the Tauri builder.
///
/// NOTE: This module's #[tauri::command] functions are wired up in the
/// master `commands::register()` handler list in `commands/mod.rs`.
/// Each module's `register()` is now a no-op pass-through because
/// Tauri v2 keeps only the LAST `invoke_handler(...)` call — calling
/// it here would REPLACE the master handler and break all other modules.
pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}

pub mod hardware_id;
pub mod license;

use std::sync::Arc;

use sqlx::SqlitePool;
use tauri::{Builder, Manager, Wry};
use tokio::sync::Mutex;

use crate::licensing::hardware_id::HardwareId;
use crate::licensing::license::{get_license_public_key_b64, LicenseState};

/// Append the licensing `#[tauri::command]` handlers to the builder.
///
/// All command paths are fully qualified (`crate::licensing::…`) because
/// the `#[tauri::command]` attribute generates a sibling `__cmd__<name>`
/// macro at the function's module level. `tauri::generate_handler!` finds
/// that sibling by rewriting the last path segment from `<name>` to
/// `__cmd__<name>`, so the entry must be a full path to the function —
/// a bare identifier (or a `use`-imported name) will not resolve the
/// sibling macro.
// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

/// Register the licensing state with the running Tauri app.
///
/// * `HardwareId` is a stateless fingerprint generator and is created
///   unconditionally so the `get_hardware_id` command is always wired
///   up — even on first launch before any license exists.
/// * `LicenseState` is created using the embedded public key
///   ([`get_license_public_key_b64`]) and, when the database pool is
///   available, the pool is bound to it so license activation can
///   persist via `db::license::save_license`.
pub fn init(app: &tauri::App, pool: Option<&SqlitePool>) -> Result<(), String> {
    // Hardware fingerprint generator (always present).
    let hardware_id = Arc::new(Mutex::new(HardwareId::new()));
    app.manage(hardware_id);

    // License state (verifying key + optional DB pool).
    let mut license_state = LicenseState::new(get_license_public_key_b64())?;
    if let Some(pool) = pool {
        license_state.set_db_pool(pool.clone());
    }
    app.manage(Arc::new(Mutex::new(license_state)));

    Ok(())
}
