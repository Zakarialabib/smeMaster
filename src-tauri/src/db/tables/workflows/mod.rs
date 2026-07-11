//! Workflows domain — table data-access modules.
//!
//! This module groups the per-table DB layers for the workflows feature:
//! `workflow_rules`, `follow_up_reminders`, `pending_operations`, and
//! `cleanup_rules`. Each submodule exposes `async` CRUD functions that run
//! against a shared `SqlitePool` and return `Result<_, AppDbError>`.

pub mod cleanup_rules;
pub mod follow_up_reminders;
pub mod pending_operations;
pub mod workflow_rules;
