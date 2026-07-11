//! CRM domain — database query layer for contacts and related entities.
//!
//! This module groups the per-table query functions for the CRM domain:
//! `contacts`, `contact_labels`, `contact_tags`, `contact_segments`,
//! `contact_groups`, `contact_files`, `engagement_log`, `entity_pivots`, and
//! the unified `activity` feed. Every submodule exposes async functions that
//! return `Result<_, AppDbError>`.

// ── CRM domain ──────────────────────────────────────────────────────────────
pub mod activity;
pub mod contact_files;
pub mod contact_groups;
pub mod contact_labels;
pub mod contact_segments;
pub mod contact_tags;
pub mod contacts;
pub mod engagement_log;
pub mod entity_pivots;
