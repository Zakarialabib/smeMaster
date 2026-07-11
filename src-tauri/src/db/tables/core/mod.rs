//! Core domain DB module.
//!
//! Aggregates the per-table data-access modules for the core (account/mail
//! bookkeeping) domain: accounts, attachments, folder sync state, labels,
//! messages (+ FTS), OAuth tokens, settings, thread labels, and threads.
//! Each submodule exposes `pub` async functions returning `Result<_, AppDbError>`.

// ── Core domain ─────────────────────────────────────────────────────────────
pub mod accounts;
pub mod attachments;
pub mod folder_sync_state;
pub mod sync_conflicts;
pub mod sync_jobs;
pub mod labels;
pub mod messages;
pub mod messages_fts;
pub mod oauth_tokens;
pub mod settings;
pub mod thread_labels;
pub mod threads;
