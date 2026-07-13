// ── Clean Sequential Migrations ──────────────────────────────────────────────
//
// This module replaces the old monolithic migrations.rs with a version-tracked
// sequential system. Each migration is a numbered .sql file applied in order.
//
// Usage:
//   run_migrations(&pool, false).await?;  // normal startup
//   run_migrations(&pool, true).await?;   // force drop + recreate

use sqlx::SqlitePool;
use std::time::Instant;

use crate::db::migration_rollback;

/// Ordered list of migration files. Add new migrations at the end.
///
/// Naming convention: NNN_domain.sql where NNN is a sequential number.
/// All columns are defined inline in CREATE TABLE statements — no ALTER TABLE
/// fix migrations. Each file covers a single business domain.
const MIGRATIONS: &[(&str, &str)] = &[
    ("001_core", include_str!("001_core.sql")),
    ("002_mail", include_str!("002_mail.sql")),
    ("003_contacts", include_str!("003_contacts.sql")),
    ("004_campaigns", include_str!("004_campaigns.sql")),
    ("005_ai", include_str!("005_ai.sql")),
    ("006_security", include_str!("006_security.sql")),
    ("007_deliverability", include_str!("007_deliverability.sql")),
    ("008_workflows", include_str!("008_workflows.sql")),
    ("009_calendar", include_str!("009_calendar.sql")),
    ("010_tasks", include_str!("010_tasks.sql")),
    ("011_compliance", include_str!("011_compliance.sql")),
    ("012_blacklist_monitoring", include_str!("012_blacklist_monitoring.sql")),
    ("013_oauth_tokens", include_str!("013_oauth_tokens.sql")),
    ("014_account_cleanup", include_str!("014_account_cleanup.sql")),
    ("015_suggestions", include_str!("015_suggestions.sql")),
    ("016_sync_documents", include_str!("016_sync_documents.sql")),
    ("017_vault_items", include_str!("017_vault_items.sql")),
    ("018_offline_availability", include_str!("018_offline_availability.sql")),
    ("019_sync_migration", include_str!("019_sync_migration.sql")),
    ("020_invoicing", include_str!("020_invoicing.sql")),
    ("021_engagement_log_fix", include_str!("021_engagement_log_fix.sql")),
    ("022_accounting", include_str!("022_accounting.sql")),
    ("023_wallet", include_str!("023_wallet.sql")),
    ("024_hardening", include_str!("024_hardening.sql")),
    ("025_workflow_execution", include_str!("025_workflow_execution.sql")),
    ("026_automation_actions", include_str!("026_automation_actions.sql")),
];

// ── Public migration API ────────────────────────────────────────────────────
//
// `run_migrations(&pool)` is the canonical entry point — called from
// application startup (lib.rs) and from the shared test helper
// (db::tables::test_helpers::create_memory_pool). The `run(&pool, force_drop)`
// variant is an internal helper kept for the force-rebuild path.

/// Run all pending migrations. If `force_drop` is true, drop all tables first.
pub async fn run(pool: &SqlitePool, force_drop: bool) -> Result<(), String> {
    let start = Instant::now();

    if force_drop {
        log::warn!("[migrate] Force drop enabled — dropping all tables");
        drop_all_tables(pool).await?;
        log::info!("[migrate] All tables dropped");
    }

    // Ensure schema version table exists
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create _schema_version: {e}"))?;

    // Read current version
    let current: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _schema_version")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to read schema version: {e}"))?;

    log::info!("[migrate] Current schema version: {current}");

    // ── Ensure _migrations_applied tracking table exists BEFORE the loop ──
    // This must happen before any record_migration() call inside the loop.
    // Previously this was called AFTER the loop, causing every migration
    // to fail with "no such table: _migrations_applied".
    migration_rollback::ensure_tracking_table(pool)
        .await
        .map_err(|e| format!("Failed to create _migrations_applied tracking table: {e}"))?;

    // Apply pending migrations
    for (i, (name, sql)) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i32;
        if version <= current {
            continue;
        }

        let mstart = Instant::now();
        log::info!("[migrate] Applying {name} (v{version})...");

        // All migrations now use the unified SQL execution path.
        // Fix migrations (v12, v14, v15, v16 column additions, v21) have been
        // consolidated into their base migration SQL files.
        let statements = split_sql(sql);
        for stmt in &statements {
            let trimmed = stmt.trim();
            if trimmed.is_empty() {
                continue;
            }
            sqlx::raw_sql(sqlx::AssertSqlSafe(trimmed))
                .execute(pool)
                .await
                .map_err(|e| format!("Migration {name} (v{version}) failed: {e}\nSQL: {trimmed}"))?;
        }

        // Record the migration
        sqlx::query("INSERT INTO _schema_version (version) VALUES (?)")
            .bind(version)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to record schema version {version}: {e}"))?;

        // Record in migration_rollback tracking table
        let checksum = migration_rollback::compute_checksum(sql);
        migration_rollback::record_migration(pool, version as i64, name, &checksum)
            .await
            .map_err(|e| format!("Failed to record migration tracking {version}: {e}"))?;

        log::info!("[migrate] {name} applied in {:?}", mstart.elapsed());
    }

    // Backfill _migrations_applied for existing databases that were migrated
    // before the tracking table was introduced. This handles the edge case
    // where _schema_version has entries but _migrations_applied is empty.
    // The tracking table itself was created before the loop above.
    migration_rollback::backfill_from_schema_version(pool, &MIGRATIONS)
        .await
        .map_err(|e| format!("Failed to backfill migration tracking: {e}"))?;

    log::info!(
        "[migrate] All migrations applied in {:?}",
        start.elapsed()
    );
    Ok(())
}

/// Split SQL text into individual statements.
/// Handles statement-level splitting while preserving trigger bodies.
fn split_sql(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut in_trigger = false;

    for line in sql.lines() {
        let trimmed = line.trim();

        // Track trigger blocks
        if trimmed.starts_with("CREATE TRIGGER") || trimmed.starts_with("CREATE VIRTUAL TABLE") {
            in_trigger = true;
        }

        current.push_str(line);
        current.push('\n');

        if in_trigger {
            if trimmed == "END;" {
                in_trigger = false;
                statements.push(current.trim().to_string());
                current.clear();
            }
        } else if trimmed.ends_with(';') && !trimmed.starts_with("--") {
            statements.push(current.trim().to_string());
            current.clear();
        }
    }

    // Add remaining (shouldn't happen with well-formed SQL)
    let remaining = current.trim();
    if !remaining.is_empty() {
        statements.push(remaining.to_string());
    }

    statements
}

// ── Database state machine ─────────────────────────────────────────────────
//
// Provides a single function to examine the DB and classify its lifecycle state.
// This replaces ad-hoc queries to `app_config` that could fail (and log scary
// errors) when that table doesn't exist yet.

/// Lifecycle state of the database.
///
/// Determined by examining `_schema_version`, `sqlite_master`, and `app_config`.
/// All queries check table existence first using `sqlite_master` so no SQL error
/// is ever logged for expected conditions.
#[derive(Debug, Clone, PartialEq)]
pub enum DbState {
    /// Database has no `_schema_version` table — brand new or fully reset.
    Fresh,
    /// `_schema_version` exists but no migrations have been recorded yet.
    Empty,
    /// Some migrations have been applied, but not all.
    Partial {
        /// The highest applied migration version.
        current: i32,
        /// Total number of migrations defined.
        total: i32,
    },
    /// All migrations applied, but the app has not been initialized yet
    /// (either `app_config` table doesn't exist yet, or `is_initialized` is
    /// not set to `"true"`).
    Migrated,
    /// All migrations applied AND `app_config.is_initialized = 'true'`.
    Initialized,
    /// A SQL error occurred while trying to determine state.
    Corrupt {
        /// Human-readable description of the error.
        reason: String,
    },
}

/// Examine the database and return its current lifecycle state.
///
/// This function is **safe** to call on any database — it always checks table
/// existence via `sqlite_master` before querying table contents, so it never
/// logs SQL errors for expected conditions (e.g., querying `app_config` before
/// migration 022 has run).
///
/// Use this in `spawn_orchestrator` (and elsewhere) instead of directly
/// querying `app_config` to avoid "no such table" error logs on fresh/partial DBs.
pub async fn check_db_state(pool: &SqlitePool) -> DbState {
    // 1. Check if _schema_version table exists at all
    let has_schema: bool = match sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='_schema_version'",
    )
    .fetch_one(pool)
    .await
    {
        Ok(count) => count > 0,
        Err(e) => {
            return DbState::Corrupt {
                reason: format!("Cannot query sqlite_master: {e}"),
            }
        }
    };

    if !has_schema {
        return DbState::Fresh;
    }

    // 2. Read current schema version
    let current: i32 = match sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) FROM _schema_version",
    )
    .fetch_one(pool)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return DbState::Corrupt {
                reason: format!("Cannot read _schema_version: {e}"),
            }
        }
    };

    if current == 0 {
        return DbState::Empty;
    }

    let total = MIGRATIONS.len() as i32;

    if current < total {
        return DbState::Partial { current, total };
    }

    // 3. All migrations applied. Check if app_config table exists.
    let has_app_config: bool = match sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='app_config'",
    )
    .fetch_one(pool)
    .await
    {
        Ok(count) => count > 0,
        Err(_) => false,
    };

    if !has_app_config {
        return DbState::Migrated;
    }

    // 4. app_config exists — check is_initialized flag (no error logging here)
    match sqlx::query_as::<_, (String,)>(
        "SELECT value FROM app_config WHERE key = 'is_initialized'",
    )
    .fetch_optional(pool)
    .await
    {
        Ok(Some((v,))) if v == "true" => DbState::Initialized,
        Ok(_) => DbState::Migrated,
        Err(_) => DbState::Migrated,
    }
}

/// Drop all user tables in the database (for force-rebuild).
pub(crate) async fn drop_all_tables(pool: &SqlitePool) -> Result<(), String> {
    // Disable FK checks to allow dropping in any order
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    // Get all user table names
    let tables: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

    for table in &tables {
        let sql = format!("DROP TABLE IF EXISTS \"{table}\"");
        sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to drop table {table}: {e}"))?;
    }

    // Also drop triggers, indexes, virtual tables
    let triggers: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for trigger in &triggers {
        let sql = format!("DROP TRIGGER IF EXISTS \"{trigger}\"");
        sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to drop trigger {trigger}: {e}"))?;
    }

    let indexes: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    for index in &indexes {
        let sql = format!("DROP INDEX IF EXISTS \"{index}\"");
        sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to drop index {index}: {e}"))?;
    }

    // Re-enable FK checks
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    log::info!("[migrate] Dropped {} tables, {} triggers, {} indexes", tables.len(), triggers.len(), indexes.len());
    Ok(())
}

// ── Canonical migration entry point ────────────────────────────────────────
//
// Used by lib.rs at startup and by db::tables::test_helpers::create_memory_pool.
// `force_drop = false` matches the standard startup path; the force-rebuild
// branch lives behind `run(pool, true)` for explicit admin use.
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    run(pool, false).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn setup() -> SqlitePool {
        SqlitePool::connect("sqlite::memory:")
            .await
            .expect("Failed to create test pool")
    }

    #[tokio::test]
    async fn test_full_migration() {
        let pool = setup().await;
        run(&pool, false).await.expect("Migration should succeed");

        // Verify schema version tracking
        let version: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _schema_version")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i32);
    }

    #[tokio::test]
    async fn test_idempotent() {
        let pool = setup().await;
        run(&pool, false).await.expect("First migration");
        run(&pool, false).await.expect("Second migration (idempotent)");
    }

    #[tokio::test]
    async fn test_force_drop() {
        let pool = setup().await;
        run(&pool, false).await.expect("First migration");
        run(&pool, true).await.expect("Force drop + remigrate");

        let version: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _schema_version")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i32);
    }

    // ── 024_hardening schema assertions ──────────────────────────────────
    #[tokio::test]
    async fn test_hardening_024_schema() {
        let pool = setup().await;
        run(&pool, false).await.expect("Migration should succeed");

        // templates: updated_at + new indexes
        let cols: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM pragma_table_info('templates') WHERE name='updated_at'",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(cols.len(), 1, "templates.updated_at missing");

        let idx: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_templates_company_fav'",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(idx.len(), 1, "idx_templates_company_fav missing");

        // template_categories unique (company, name)
        let uniq: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_template_categories_company_name'",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(uniq.len(), 1, "template_categories unique index missing");

        // scheduled_emails: dispatcher columns + index
        for c in ["sent_at", "attempts", "last_error"] {
            let n: i32 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM pragma_table_info('scheduled_emails') WHERE name=?",
            )
            .bind(c)
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(n, 1, "scheduled_emails.{c} missing");
        }
        let due_idx: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_scheduled_emails_due'",
        )
        .fetch_all(&pool)
        .await
        .unwrap();
        assert_eq!(due_idx.len(), 1, "idx_scheduled_emails_due missing");

        // calendar_events: recurrence columns + new tables
        for c in ["rrule", "timezone", "is_recurring", "recurrence_id", "remote_event_id"] {
            let n: i32 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM pragma_table_info('calendar_events') WHERE name=?",
            )
            .bind(c)
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(n, 1, "calendar_events.{c} missing");
        }
        for t in ["event_attendees", "event_reminders"] {
            let n: i32 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            )
            .bind(t)
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(n, 1, "{t} table missing");
        }
        // calendars: timezone
        let n: i32 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_table_info('calendars') WHERE name='timezone'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(n, 1, "calendars.timezone missing");
    }

    // ── DbState tests ───────────────────────────────────────────────────

    #[tokio::test]
    async fn test_db_state_fresh() {
        let pool = setup().await;
        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Fresh);
    }

    #[tokio::test]
    async fn test_db_state_empty() {
        let pool = setup().await;
        // Create _schema_version table but insert no migrations
        sqlx::query(
            "CREATE TABLE _schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
        )
        .execute(&pool)
        .await
        .unwrap();

        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Empty);
    }

    #[tokio::test]
    async fn test_db_state_partial() {
        let pool = setup().await;
        // Create _schema_version and record just 5 of 18 migrations
        sqlx::query(
            "CREATE TABLE _schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
        )
        .execute(&pool)
        .await
        .unwrap();
        for v in 1..=5_i32 {
            sqlx::query("INSERT INTO _schema_version (version) VALUES (?)")
                .bind(v)
                .execute(&pool)
                .await
                .unwrap();
        }

        let state = check_db_state(&pool).await;
        assert_eq!(
            state,
            DbState::Partial {
                current: 5,
                total: MIGRATIONS.len() as i32,
            }
        );
    }

    #[tokio::test]
    async fn test_db_state_migrated() {
        let pool = setup().await;
        run(&pool, false).await.expect("Migration should succeed");

        let state = check_db_state(&pool).await;
        // app_config table exists (migration 001) but is_initialized is not set
        assert_eq!(state, DbState::Migrated);
    }

    #[tokio::test]
    async fn test_db_state_initialized() {
        let pool = setup().await;
        run(&pool, false).await.expect("Migration should succeed");

        // Set the is_initialized flag
        sqlx::query("INSERT INTO app_config (key, value) VALUES ('is_initialized', 'true')")
            .execute(&pool)
            .await
            .unwrap();

        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Initialized);
    }

    #[tokio::test]
    async fn test_reset_drop_and_remigrate() {
        let pool = setup().await;
        run(&pool, false).await.expect("First migration");

        // Mark as initialized
        sqlx::query("INSERT INTO app_config (key, value) VALUES ('is_initialized', 'true')")
            .execute(&pool)
            .await
            .unwrap();

        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Initialized);

        // Now drop all tables (drop_all_tables includes _schema_version after our change)
        drop_all_tables(&pool).await.expect("Drop should succeed");

        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Fresh);

        // Re-run all migrations from scratch
        run(&pool, false).await.expect("Remigration should succeed");

        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Migrated);
    }

    #[tokio::test]
    async fn test_reset_onboarding_flag() {
        let pool = setup().await;
        run(&pool, false).await.expect("Migration should succeed");

        // Set the is_initialized flag
        sqlx::query("INSERT INTO app_config (key, value) VALUES ('is_initialized', 'true')")
            .execute(&pool)
            .await
            .unwrap();

        // Verify initialized
        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Initialized);

        // Delete onboarding flag (like db_reset_onboarding does)
        sqlx::query("DELETE FROM app_config WHERE key = 'is_initialized'")
            .execute(&pool)
            .await
            .unwrap();

        // Verify state changed back to Migrated
        let state = check_db_state(&pool).await;
        assert_eq!(state, DbState::Migrated);
    }
}
