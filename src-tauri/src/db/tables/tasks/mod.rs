//! Tasks domain query modules.
//!
//! Re-exports the [`tasks`] (tasks table) and [`task_tags`] (task_tags table)
//! query submodules. Functions in these submodules return
//! [`crate::db::error::AppDbError`], using `NotFound` for missing rows.

pub mod task_tags;
pub mod tasks;
