//! Agent (voice + WhatsApp) client: the desktop's view of `agent-core`.
//!
//! The desktop holds **no provider key** and **no tenant id**. It sends an
//! authenticated request and renders what comes back. Keys live in agent-core
//! only, which is the rule that lets a tier change stay a config change instead
//! of becoming a desktop release (ADR-001 D4a).
//!
//! Registration is a no-op pass-through. Tauri v2 keeps only the LAST
//! `invoke_handler(...)` call, so the real wiring is in the master
//! `commands::register()` list — same as every other module here.

pub mod client;
pub mod types;

use tauri::{Builder, Wry};

pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}
