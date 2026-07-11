// ── SnoozePresets query functions ────────────────────────────────────────────

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::calendar::schema::SnoozePreset;

/// List all snooze presets for a given account, ordered by `sort_order ASC`.
pub async fn list(
    pool: &SqlitePool,
    company_id: &str,
) -> Result<Vec<SnoozePreset>, AppDbError> {
    sqlx::query_as::<_, SnoozePreset>(
        "SELECT * FROM snooze_presets WHERE company_id = ? ORDER BY sort_order ASC",
    )
    .bind(company_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Create a new snooze preset and return the full row.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `company_id` — Owning account/company id.
/// - `label` — Display label for the preset.
/// - `duration_minutes` — Snooze duration in minutes.
/// - `is_recurring` — Whether the snooze repeats.
/// - `sort_order` — Ordering position among the account's presets.
///
/// # Returns
/// The newly inserted `SnoozePreset` row.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, including a
/// foreign-key violation for an unknown `company_id`.
///
/// # Notes
/// `id` is auto-generated (UUID v4) and `created_at` is set to the current
/// epoch second. All values use `?` binds.
pub async fn create(
    pool: &SqlitePool,
    company_id: &str,
    label: &str,
    duration_minutes: i64,
    is_recurring: bool,
    sort_order: i64,
) -> Result<SnoozePreset, AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();
    let recurring = if is_recurring { 1_i64 } else { 0_i64 };

    sqlx::query_as::<_, SnoozePreset>(
        r#"
        INSERT INTO snooze_presets (id, company_id, label, duration_minutes, is_recurring, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(company_id)
    .bind(label)
    .bind(duration_minutes)
    .bind(recurring)
    .bind(sort_order)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Delete a snooze preset by its primary key.
///
/// # Parameters
/// - `pool` — SQLite connection pool.
/// - `id` — Primary key of the preset to delete.
///
/// # Returns
/// `Ok(())` when the row was deleted.
///
/// # Errors
/// Returns `AppDbError::Database` on any SQL or connection failure, or
/// `AppDbError::NotFound` with message
/// `SnoozePreset with id '<id>' not found` when no row matched the key.
///
/// # Notes
/// The `id` is supplied as a positional `?` bind (not interpolated), so the
/// `delete_or_not_found` helper — which requires an interpolated id — is not a
/// drop-in here; the mapping is kept inline to preserve the parameterized SQL.
pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppDbError> {
    let rows = sqlx::query("DELETE FROM snooze_presets WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();

    if rows == 0 {
        return Err(AppDbError::NotFound(format!("SnoozePreset with id '{id}' not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_create_and_list() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let preset = create(&pool, "acc1", "15 minutes", 15, false, 1)
            .await
            .expect("create should succeed");

        assert_eq!(preset.company_id, "acc1");
        assert_eq!(preset.label, "15 minutes");
        assert_eq!(preset.duration_minutes, 15);
        assert_eq!(preset.is_recurring, 0);
        assert_eq!(preset.sort_order, 1);
        assert!(preset.created_at > 0);
        assert!(!preset.id.is_empty());

        let all = list(&pool, "acc1").await.expect("list should succeed");
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, preset.id);
    }

    #[tokio::test]
    async fn test_list_empty() {
        let pool = helpers::create_memory_pool().await;
        let all = list(&pool, "acc1").await.expect("list should succeed");
        assert!(all.is_empty());
    }

    #[tokio::test]
    async fn test_list_order_by_sort_order() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        create(&pool, "acc1", "Last", 60, false, 3).await.unwrap();
        create(&pool, "acc1", "First", 30, false, 1).await.unwrap();
        create(&pool, "acc1", "Middle", 15, false, 2).await.unwrap();

        let all = list(&pool, "acc1").await.unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].label, "First");
        assert_eq!(all[1].label, "Middle");
        assert_eq!(all[2].label, "Last");
    }

    #[tokio::test]
    async fn test_list_scoped_to_account() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;
        helpers::insert_test_account(&pool, "acc2").await;

        create(&pool, "acc1", "Preset 1", 10, false, 1).await.unwrap();
        create(&pool, "acc2", "Preset 2", 20, true, 1).await.unwrap();

        let acc1_presets = list(&pool, "acc1").await.unwrap();
        assert_eq!(acc1_presets.len(), 1);
        assert_eq!(acc1_presets[0].label, "Preset 1");

        let acc2_presets = list(&pool, "acc2").await.unwrap();
        assert_eq!(acc2_presets.len(), 1);
        assert_eq!(acc2_presets[0].is_recurring, 1);
    }

    #[tokio::test]
    async fn test_create_recurring() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let preset = create(&pool, "acc1", "Daily recurring", 1440, true, 5)
            .await
            .expect("create recurring should succeed");

        assert_eq!(preset.is_recurring, 1);
        assert_eq!(preset.duration_minutes, 1440);
    }

    #[tokio::test]
    async fn test_delete() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acc1").await;

        let preset = create(&pool, "acc1", "To delete", 5, false, 1).await.unwrap();

        delete(&pool, &preset.id).await.expect("delete should succeed");

        let all = list(&pool, "acc1").await.unwrap();
        assert!(all.is_empty());
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

        let preset = create(&pool, "acc1", "1 hour", 60, false, 10).await.unwrap();
        assert_eq!(preset.label, "1 hour");

        let all = list(&pool, "acc1").await.unwrap();
        assert_eq!(all.len(), 1);

        delete(&pool, &preset.id).await.unwrap();
        assert!(list(&pool, "acc1").await.unwrap().is_empty());
    }
}
