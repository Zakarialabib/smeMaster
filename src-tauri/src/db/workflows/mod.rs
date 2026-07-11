//! Workflows domain — shared schema and orchestration helpers.
//!
//! This module groups the workflows feature's shared `schema` (row structs) and
//! `operations` (higher-level orchestration) used by the table data-access
//! modules and the workflow command handlers.

pub mod operations;
pub mod schema;
    