//! Campaigns domain — database query layer.
//!
//! This module groups the per-table query functions for everything related to
//! marketing campaigns: the campaigns themselves, their recipients, UTM
//! tracking links and clicks, and the backup schedules that snapshot the
//! data. Each submodule exposes `async` query helpers built on `sqlx` against
//! an `SqlitePool`. Errors are reported through [`crate::db::error::AppDbError`],
//! with `AppDbError::NotFound` used whenever a row keyed by id is missing.
pub mod backup_schedules;
pub mod campaign_recipients;
pub mod campaigns;
pub mod utm_clicks;
pub mod utm_links;
