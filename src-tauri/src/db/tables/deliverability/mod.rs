//! Deliverability domain — per-table DB access modules for reputation scores,
//! blacklist checks/monitors, newsletter bundles, bundle rules/threads, delist
//! requests, ARF reports, bulk check jobs, and alert preferences. Each submodule
//! exposes a small set of async CRUD helpers returning `AppDbError`.

pub mod alert_preferences;
pub mod arf_reports;
pub mod blacklist_checks;
pub mod blacklist_monitors;
pub mod bulk_check_jobs;
pub mod bundle_rules;
pub mod bundled_threads;
pub mod config;
pub mod delist_requests;
pub mod events;
pub mod newsletter_bundles;
pub mod reputation_scores;
