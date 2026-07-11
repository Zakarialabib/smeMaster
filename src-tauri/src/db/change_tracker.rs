// ── SQLite Change Tracker (stub) ─────────────────────────────────────────────
//
// Originally designed to use SQLite's update_hook via FFI to emit Tauri events
// on table changes. However, SQLite is statically linked through sqlx on this
// platform, so the `#[link(name = "sqlite3")]` FFI approach cannot work.
//
// The `register()` function stores the AppHandle globally for future use when
// a working reactive mechanism (e.g. sqlx's `after_connect` with a custom
// hook or periodic polling) is implemented.
//
// See `db/mod.rs::create_pool` for current pool setup (no after_connect hook).

use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;

static APP_HANDLE: OnceLock<Mutex<Option<AppHandle>>> = OnceLock::new();

/// Store the AppHandle for future change-tracking use.
/// Called once during app startup (lib.rs). Does NOT install any SQLite hooks.
pub fn register(app: AppHandle) {
    let _ = APP_HANDLE.set(Mutex::new(Some(app)));
}
