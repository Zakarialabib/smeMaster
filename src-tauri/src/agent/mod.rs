//! Agent module — agentic AI automation for email and social channels.
//!
//! The desktop holds **no provider key** and **no tenant id**. It sends an
//! authenticated request and renders what comes back. Keys live in the
//! backend only, which is the rule that lets a tier change stay a config
//! change instead of becoming a desktop release (ADR-001 D4a).
//!
//! ## Module structure
//! - `config` — Agent configuration management
//! - `providers` — Provider chain with fallback
//! - `ops` — Ops monitoring and alerts
//! - `automation` — Email/social automation rules
//! - `types` — Wire types

pub mod automation;
pub mod commands;
pub mod config;
pub mod ops;
pub mod providers;
pub mod types;

use tauri::{Builder, Wry};

pub fn register(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}
