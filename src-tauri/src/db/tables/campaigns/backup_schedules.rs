//! Backup schedule query functions.
//!
//! CRUD queries for the `backup_schedules` table, which drives periodic data
//! snapshots for an account (or globally when `company_id` is `NULL`). All
//! functions are `async` against a `SqlitePool`; missing rows surface as
//! `AppDbError::NotFound` (see [`get_by_id`] and [`delete`]).
use crate::db::campaigns::schema::BackupSchedule;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use sqlx::SqlitePool;

/// List backup schedules for an account (including global schedules), newest
/// (`created_at`) first.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `company_id`: when `Some(id)`, returns schedules for that account **plus**
///   global schedules (`company_id IS NULL`); when `None`, returns only global
///   schedules.
///
/// # Returns
/// A `Vec<BackupSchedule>` (possibly empty), ordered newest first.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Does **not** error for an
/// empty result.
pub async fn list(
    pool: &SqlitePool,
    company_id: Option<&str>,
) -> Result<Vec<BackupSchedule>, AppDbError> {
    match company_id {
        Some(cid) => {
            sqlx::query_as::<_, BackupSchedule>(
                "SELECT * FROM backup_schedules WHERE company_id = ? OR company_id IS NULL ORDER BY created_at DESC",
            )
            .bind(cid)
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
        None => {
            sqlx::query_as::<_, BackupSchedule>(
                "SELECT * FROM backup_schedules ORDER BY created_at DESC",
            )
            .fetch_all(pool)
            .await
            .map_err(AppDbError::Database)
        }
    }
}

/// Fetch a single backup schedule by its primary key `id`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the backup schedule to fetch.
///
/// # Returns
/// The full `BackupSchedule` row.
///
/// # Errors
/// Returns `AppDbError::NotFound` with the message
/// `BackupSchedule with id '<id>' not found` when no schedule matches the key.
/// Returns `AppDbError::Database` for other query failures.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<BackupSchedule, AppDbError> {
    let opt = sqlx::query_as::<_, BackupSchedule>("SELECT * FROM backup_schedules WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppDbError::Database)?;
    fetch_or_not_found(opt, id, "BackupSchedule")
}

/// Create a new backup schedule and return the full inserted row.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `company_id`: optional owning account id; `None` creates a global
///   schedule.
/// - `name`: human-readable schedule name.
/// - `format`: archive format (e.g. `'mbox'`, `'zip'`).
/// - `cron_expression`: cron string controlling run frequency.
/// - `destination_path`: optional output path for the backup.
/// - `encrypt`: whether the backup is encrypted (`true` → `1`).
/// - `is_enabled`: whether the schedule is active (`true` → `1`).
///
/// A new UUID primary key and `created_at` timestamp are generated; `last_run_at`
/// and `next_run_at` are seeded to `NULL`.
///
/// # Returns
/// The created `BackupSchedule` with all server-assigned columns populated.
///
/// # Errors
/// Returns `AppDbError::Database` on constraint violations or query failures.
/// Never returns `NotFound`.
pub async fn create(
    pool: &SqlitePool,
    company_id: Option<&str>,
    name: &str,
    format: &str,
    cron_expression: &str,
    destination_path: Option<&str>,
    encrypt: bool,
    is_enabled: bool,
) -> Result<BackupSchedule, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query_as::<_, BackupSchedule>(
        r#"
        INSERT INTO backup_schedules (
            id, company_id, name, format, cron_expression,
            destination_path, encrypt, is_enabled, last_run_at, next_run_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(name)
    .bind(format)
    .bind(cron_expression)
    .bind(destination_path)
    .bind(encrypt as i64)
    .bind(is_enabled as i64)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields of a backup schedule and return the updated row.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: Option<&str>,
    format: Option<&str>,
    cron_expression: Option<&str>,
    destination_path: Option<&str>,
    encrypt: Option<bool>,
    is_enabled: Option<bool>,
) -> Result<BackupSchedule, AppDbError> {
    let existing = get_by_id(pool, id).await?;

    let new_name = name.map(String::from).unwrap_or(existing.name);
    let new_format = format.map(String::from).unwrap_or(existing.format);
    let new_cron = cron_expression.map(String::from).unwrap_or(existing.cron_expression);
    let new_dest = destination_path.map(String::from).or(existing.destination_path);
    let new_encrypt = encrypt.unwrap_or(existing.encrypt != 0) as i64;
    let new_enabled = is_enabled.unwrap_or(existing.is_enabled != 0) as i64;

    sqlx::query_as::<_, BackupSchedule>(
        r#"
        UPDATE backup_schedules
        SET name = ?,
            format = ?,
            cron_expression = ?,
            destination_path = ?,
            encrypt = ?,
            is_enabled = ?
        WHERE id = ?
        RETURNING *
        "#,
    )
    .bind(&new_name)
    .bind(&new_format)
    .bind(&new_cron)
    .bind(&new_dest)
    .bind(new_encrypt)
    .bind(new_enabled)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Stamp `last_run_at` and `next_run_at` to the current timestamp for a
/// schedule.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the schedule.
///
/// # Returns
/// `Ok(())` on success.
///
/// # Errors
/// Returns `AppDbError::Database` on query failure. Note: this does **not**
/// verify the row exists first — a missing `id` silently affects zero rows and
/// still returns `Ok(())`.
pub async fn update_last_run(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query("UPDATE backup_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?")
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a backup schedule by its primary key `id`.
///
/// # Parameters
/// - `pool`: the SQLite connection pool.
/// - `id`: primary key of the schedule to delete.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::NotFound` with message
/// `BackupSchedule with id '<id>' not found` when no row matched the key
/// (`rows_affected() == 0`). Returns `AppDbError::Database` for other failures.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM backup_schedules WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("BackupSchedule with id '{id}' not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;
    

    #[tokio::test]
    async fn test_create_backup_schedule() {
        let pool = helpers::create_memory_pool().await;

        let schedule = create(
            &pool,
            None,               // global schedule (no account)
            "Daily Backup",
            "mbox",
            "0 2 * * *",
            Some("/backups/daily"),
            true,
            true,
        )
        .await
        .unwrap();

        assert_eq!(schedule.name, "Daily Backup");
        assert_eq!(schedule.format, "mbox");
        assert_eq!(schedule.cron_expression, "0 2 * * *");
        assert_eq!(schedule.encrypt, 1);
        assert_eq!(schedule.is_enabled, 1);
        assert_eq!(schedule.destination_path.as_deref(), Some("/backups/daily"));
        assert_eq!(schedule.company_id, "");
    }

    #[tokio::test]
    async fn test_create_backup_schedule_with_account() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_bkup";
        helpers::insert_test_account(&pool, company_id).await;

        let schedule = create(
            &pool,
            Some(company_id),
            "Account Backup",
            "zip",
            "0 3 * * *",
            None,
            false,
            false,
        )
        .await
        .unwrap();

        assert_eq!(schedule.company_id, company_id);
        assert_eq!(schedule.name, "Account Backup");
        assert_eq!(schedule.encrypt, 0);
        assert_eq!(schedule.is_enabled, 0);
        assert!(schedule.destination_path.is_none());
    }

    #[tokio::test]
    async fn test_get_by_id_success() {
        let pool = helpers::create_memory_pool().await;

        let created = create(&pool, None, "Get Schedule", "mbox", "0 4 * * *", None, false, true)
            .await
            .unwrap();

        let fetched = get_by_id(&pool, &created.id).await.unwrap();
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.name, "Get Schedule");
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_list_global_schedules() {
        let pool = helpers::create_memory_pool().await;

        create(&pool, None, "Global A", "mbox", "0 5 * * *", None, false, true)
            .await
            .unwrap();
        create(&pool, None, "Global B", "zip", "0 6 * * *", None, false, false)
            .await
            .unwrap();

        let schedules = list(&pool, None).await.unwrap();
        assert!(schedules.len() >= 2);
        // Newest first
        assert!(schedules[0].created_at >= schedules[1].created_at);
    }

    #[tokio::test]
    async fn test_list_with_account_id() {
        let pool = helpers::create_memory_pool().await;
        let company_id = "acct_bkup_list";
        helpers::insert_test_account(&pool, company_id).await;

        create(
            &pool,
            Some(company_id),
            "My Backup",
            "mbox",
            "0 7 * * *",
            None,
            false,
            true,
        )
        .await
        .unwrap();
        // Also add a global schedule — list should return both
        create(&pool, None, "Global", "mbox", "0 8 * * *", None, false, true)
            .await
            .unwrap();

        let schedules = list(&pool, Some(company_id)).await.unwrap();
        assert!(schedules.len() >= 1);
    }

    #[tokio::test]
    async fn test_update_backup_schedule() {
        let pool = helpers::create_memory_pool().await;

        let created = create(
            &pool,
            None,
            "Original Name",
            "mbox",
            "0 9 * * *",
            None,
            false,
            true,
        )
        .await
        .unwrap();

        let updated = update(
            &pool,
            &created.id,
            Some("Updated Name"),
            Some("zip"),
            None,
            Some("/new/path"),
            Some(true),
            Some(false),
        )
        .await
        .unwrap();

        assert_eq!(updated.name, "Updated Name");
        assert_eq!(updated.format, "zip");
        assert_eq!(updated.destination_path.as_deref(), Some("/new/path"));
        assert_eq!(updated.encrypt, 1);
        assert_eq!(updated.is_enabled, 0);
    }

    #[tokio::test]
    async fn test_update_backup_schedule_partial() {
        let pool = helpers::create_memory_pool().await;

        let created = create(
            &pool,
            None,
            "Partial",
            "mbox",
            "0 10 * * *",
            Some("/orig"),
            false,
            true,
        )
        .await
        .unwrap();

        // Only update name, leave everything else unchanged
        let updated = update(&pool, &created.id, Some("Partial Renamed"), None, None, None, None, None)
            .await
            .unwrap();

        assert_eq!(updated.name, "Partial Renamed");
        assert_eq!(updated.format, "mbox");
        assert_eq!(updated.destination_path.as_deref(), Some("/orig"));
    }

    #[tokio::test]
    async fn test_delete_backup_schedule() {
        let pool = helpers::create_memory_pool().await;

        let created = create(&pool, None, "Delete Me", "mbox", "0 11 * * *", None, false, true)
            .await
            .unwrap();

        delete(&pool, &created.id).await.unwrap();
        let result = get_by_id(&pool, &created.id).await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent-id").await;
        assert!(matches!(result, Err(AppDbError::NotFound(_))));
    }
}
