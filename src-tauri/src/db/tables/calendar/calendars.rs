//! Calendars DB access layer.
//!
//! CRUD and query helpers for the `calendars` table. Every function takes a
//! `&SqlitePool`, returns `Result<_, AppDbError>`, and maps SQL failures to
//! `AppDbError::Database`. Lookups that miss return `AppDbError::NotFound`.

// ── Calendars query functions ────────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::common::fetch_or_not_found;
use crate::db::error::AppDbError;
use crate::db::calendar::schema::Calendar;

/// List all calendars for a given account, ordered by `display_name ASC`.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — Owning account/company id (scopes the rows returned).
///
/// # Returns
/// All `Calendar` rows belonging to `company_id`, ordered by `display_name ASC`.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure.
pub async fn list(pool: &SqlitePool, company_id: &str) -> Result<Vec<Calendar>, AppDbError> {
    sqlx::query_as::<_, Calendar>(
        "SELECT * FROM calendars WHERE company_id = ? ORDER BY display_name ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single calendar by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — Primary key of the calendar to fetch.
///
/// # Returns
/// The `Calendar` row.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, or
/// `AppDbError::NotFound` with message
/// `Calendar with id '<id>' not found` when no calendar matches.
pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Calendar, AppDbError> {
    fetch_or_not_found(
        sqlx::query_as::<_, Calendar>("SELECT * FROM calendars WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(AppDbError::Database)?,
        id,
        "Calendar",
    )
}

/// Fetch a calendar by its provider + remote_id.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `provider` — Provider key (e.g. `"google"`).
/// - `remote_id` — Remote provider calendar identifier.
///
/// # Returns
/// The `Calendar` row.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, or
/// `AppDbError::NotFound` with message
/// `Calendar with provider '<provider>' and remote_id '<remote_id>' not found`
/// when no calendar matches.
pub async fn get_by_remote_id(
    pool: &SqlitePool,
    provider: &str,
    remote_id: &str,
) -> Result<Calendar, AppDbError> {
    sqlx::query_as::<_, Calendar>(
        "SELECT * FROM calendars WHERE provider = ? AND remote_id = ?",
    )
    .bind(provider)
    .bind(remote_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| {
        AppDbError::NotFound(format!(
            "Calendar with provider '{provider}' and remote_id '{remote_id}' not found"
        ))
    })
}

/// Create a new calendar and return the full row.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — Owning account/company id.
/// - `provider` — Provider key (e.g. `"google"`).
/// - `remote_id` — Remote provider calendar identifier.
/// - `display_name` — Optional human-readable name.
/// - `color` — Optional hex color.
/// - `is_primary` — Whether this is the account's primary calendar.
/// - `is_visible` — Whether the calendar is shown to the user.
///
/// # Returns
/// The newly inserted `Calendar` row.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, including a
/// duplicate `(provider, remote_id)` or foreign-key violation.
///
/// # Notes
/// `id` is auto-generated (UUID v4); `is_primary`/`is_visible` are stored as
/// `0`/`1`; `sync_token`/`ctag` are inserted as `NULL`; `created_at` and
/// `updated_at` are set to the current epoch second. All values use `?` binds.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    provider: &str,
    remote_id: &str,
    display_name: Option<&str>,
    color: Option<&str>,
    is_primary: bool,
    is_visible: bool,
) -> Result<Calendar, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let primary = if is_primary { 1_i64 } else { 0_i64 };
    let visible = if is_visible { 1_i64 } else { 0_i64 };

    sqlx::query_as::<_, Calendar>(
        r#"
        INSERT INTO calendars (
            id, company_id, provider, remote_id,
            display_name, color, is_primary, is_visible,
            sync_token, ctag, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(provider)
    .bind(remote_id)
    .bind(display_name)
    .bind(color)
    .bind(primary)
    .bind(visible)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Update mutable fields on a calendar.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — Primary key of the calendar to update.
/// - `display_name` / `color` — `Option<&str>` values to set.
/// - `is_primary` / `is_visible` — `Option<bool>` flags to set.
/// - `sync_token` / `ctag` — `Option<Option<&str>>`: `Some(Some(v))` sets a
///   value, `Some(None)` sets `NULL`, `None` leaves the column unchanged.
///
/// # Returns
/// `Ok(())` when the statement executes.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure.
///
/// # Notes / SQL-safety
/// String values are escaped via `replace('\'', "''")` and embedded directly
/// into the `SET` fragments, so the assembled `UPDATE` is wrapped in
/// `sqlx::AssertSqlSafe`. When no fields are provided the function returns
/// early **without** bumping `updated_at` (unlike the generic
/// `apply_field_updates` helper), so it is kept inline.
pub async fn update(
    pool: &SqlitePool,
    id: &str,
    display_name: Option<&str>,
    color: Option<&str>,
    is_primary: Option<bool>,
    is_visible: Option<bool>,
    sync_token: Option<Option<&str>>,
    ctag: Option<Option<&str>>,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let mut sets: Vec<String> = Vec::new();

    if let Some(v) = display_name {
        sets.push(format!("\"display_name\" = '{}'", v.replace('\'', "''")));
    }
    if let Some(v) = color {
        sets.push(format!("\"color\" = '{}'", v.replace('\'', "''")));
    }
    if let Some(v) = is_primary {
        sets.push(format!("\"is_primary\" = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = is_visible {
        sets.push(format!("\"is_visible\" = {}", if v { 1 } else { 0 }));
    }
    if let Some(v) = sync_token {
        if let Some(val) = v {
            sets.push(format!(
                "\"sync_token\" = '{}'",
                val.replace('\'', "''")
            ));
        } else {
            sets.push("\"sync_token\" = NULL".to_string());
        }
    }
    if let Some(v) = ctag {
        if let Some(val) = v {
            sets.push(format!("\"ctag\" = '{}'", val.replace('\'', "''")));
        } else {
            sets.push("\"ctag\" = NULL".to_string());
        }
    }

    if sets.is_empty() {
        return Ok(());
    }

    sets.push(format!("\"updated_at\" = {now}"));

    let sql = format!("UPDATE calendars SET {} WHERE id = ?", sets.join(", "));
    sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

/// Delete a calendar by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — Primary key of the calendar to delete.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, or
/// `AppDbError::NotFound` with message
/// `Calendar with id '<id>' not found` when no row matched the key.
///
/// # Notes
/// The `id` is supplied as a positional `?` bind (not interpolated), so the
/// `delete_or_not_found` helper — which requires an interpolated id — is not a
/// drop-in here; the mapping is kept inline to preserve the parameterized SQL.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM calendars WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("Calendar with id '{id}' not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_get_by_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let cal = create(&pool, "acc1", "google", "remote_1", Some("Work"), Some("#4285F4"), true, true)
            .await
            .expect("create should succeed");

        assert_eq!(cal.company_id, "acc1");
        assert_eq!(cal.provider, "google");
        assert_eq!(cal.remote_id, "remote_1");
        assert_eq!(cal.display_name, Some("Work".to_string()));
        assert_eq!(cal.color, Some("#4285F4".to_string()));
        assert_eq!(cal.is_primary, 1);
        assert_eq!(cal.is_visible, 1);
        assert!(cal.sync_token.is_none());
        assert!(cal.ctag.is_none());
        assert!(cal.created_at > 0);
        assert!(cal.updated_at > 0);

        let fetched = get_by_id(&pool, &cal.id).await.expect("get_by_id should succeed");
        assert_eq!(fetched.id, cal.id);
        assert_eq!(fetched.display_name, cal.display_name);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_id(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_get_by_remote_id() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let _cal = create(&pool, "acc1", "google", "remote_xyz", Some("Calendar X"), None, false, true)
            .await
            .expect("create should succeed");

        let fetched = get_by_remote_id(&pool, "google", "remote_xyz")
            .await
            .expect("get_by_remote_id should succeed");
        assert_eq!(fetched.remote_id, "remote_xyz");
        assert_eq!(fetched.display_name, Some("Calendar X".to_string()));
    }

    #[tokio::test]
    async fn test_get_by_remote_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = get_by_remote_id(&pool, "google", "no-such-remote").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_list() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_account(&pool, "acc2").await;

        create(&pool, "acc1", "google", "r1", Some("A"), None, false, true).await.unwrap();
        create(&pool, "acc1", "google", "r2", Some("B"), None, false, true).await.unwrap();
        create(&pool, "acc2", "outlook", "r3", Some("C"), None, false, true).await.unwrap();

        let acc1_cals = list(&pool, "acc1").await.expect("list should succeed");
        assert_eq!(acc1_cals.len(), 2);
        assert_eq!(acc1_cals[0].display_name.as_deref(), Some("A"));
        assert_eq!(acc1_cals[1].display_name.as_deref(), Some("B"));

        let acc2_cals = list(&pool, "acc2").await.unwrap();
        assert_eq!(acc2_cals.len(), 1);
    }

    #[tokio::test]
    async fn test_update_all_fields() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let cal = create(&pool, "acc1", "google", "r1", Some("Old"), Some("#000000"), false, true)
            .await
            .unwrap();

        update(
            &pool,
            &cal.id,
            Some("New Name"),
            Some("#FFFFFF"),
            Some(true),
            Some(false),
            Some(Some("tok_abc")),
            Some(Some("ctag_xyz")),
        )
        .await
        .expect("update should succeed");

        let updated = get_by_id(&pool, &cal.id).await.unwrap();
        assert_eq!(updated.display_name, Some("New Name".to_string()));
        assert_eq!(updated.color, Some("#FFFFFF".to_string()));
        assert_eq!(updated.is_primary, 1);
        assert_eq!(updated.is_visible, 0);
        assert_eq!(updated.sync_token, Some("tok_abc".to_string()));
        assert_eq!(updated.ctag, Some("ctag_xyz".to_string()));
        assert!(updated.updated_at >= cal.updated_at);
    }

    #[tokio::test]
    async fn test_update_set_null_fields() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let cal = create(&pool, "acc1", "google", "r1", Some("Name"), Some("#fff"), false, true)
            .await
            .unwrap();

        update(
            &pool,
            &cal.id,
            None, None, None, None,
            Some(None),
            Some(None),
        )
        .await
        .expect("update with nulls should succeed");

        let updated = get_by_id(&pool, &cal.id).await.unwrap();
        assert!(updated.sync_token.is_none());
        assert!(updated.ctag.is_none());
    }

    #[tokio::test]
    async fn test_update_no_changes() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let cal = create(&pool, "acc1", "google", "r1", None, None, false, true).await.unwrap();

        update(&pool, &cal.id, None, None, None, None, None, None)
            .await
            .expect("empty update should succeed");

        let updated = get_by_id(&pool, &cal.id).await.unwrap();
        assert!(updated.updated_at >= cal.updated_at);
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        let cal = create(&pool, "acc1", "google", "r1", None, None, false, true).await.unwrap();

        delete(&pool, &cal.id).await.expect("delete should succeed");

        let err = get_by_id(&pool, &cal.id).await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let err = delete(&pool, "nonexistent").await.unwrap_err();
        assert!(matches!(err, AppDbError::NotFound(_)));
    }

    #[tokio::test]
    async fn test_full_crud_cycle() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let cal = create(&pool, "acc1", "google", "crud_test", Some("CRUD"), Some("#ff0000"), true, true)
            .await
            .unwrap();
        assert_eq!(cal.is_primary, 1);

        let list_all = list(&pool, "acc1").await.unwrap();
        assert_eq!(list_all.len(), 1);

        update(&pool, &cal.id, Some("CRUD Updated"), Some("#00ff00"), None, None, None, None)
            .await
            .unwrap();
        let updated = get_by_id(&pool, &cal.id).await.unwrap();
        assert_eq!(updated.display_name, Some("CRUD Updated".to_string()));

        delete(&pool, &cal.id).await.unwrap();
        assert!(list(&pool, "acc1").await.unwrap().is_empty());
    }
}
