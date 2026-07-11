//! Tasks domain modules (schema + operations).
//!
//! Declares the [`schema`] (row structs) and [`operations`] submodules used by
//! the `tasks` table query layer under `db::tables::tasks`.

pub mod schema;
pub mod operations;
