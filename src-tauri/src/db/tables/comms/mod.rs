//! Comms domain database layer.
//!
//! This module groups the per-table data-access modules for the application's
//! communication features (email templates, signatures, aliases, drafts,
//! filters, quick steps/replies, scheduled emails, smart folders and composer
//! presets). Each submodule exposes async CRUD helpers that return
//! `crate::db::error::AppDbError`. Lookups return `AppDbError::NotFound` when a
//! row does not exist; mutations return `AppDbError::Database` on SQL failure.
pub mod aliases;
pub mod composer_presets;
pub mod filter_logs;
pub mod filter_rules;
pub mod local_drafts;
pub mod quick_replies;
pub mod quick_steps;
pub mod scheduled_emails;
pub mod signatures;
pub mod smart_folders;
pub mod template_categories;
pub mod templates;
