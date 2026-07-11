//! Calendar domain DB layer.
//!
//! Aggregates the per-table DB modules for the calendar domain:
//! [`calendar_events`], [`calendars`], and [`snooze_presets`]. Each submodule
//! exposes `async` CRUD/query helpers over its own table, all returning
//! `Result<_, AppDbError>`.

// ── Calendar domain ─────────────────────────────────────────────────────────
pub mod calendar_events;
pub mod calendars;
pub mod snooze_presets;
