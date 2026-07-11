//! `composer_presets` table data-access layer.
//!
//! CRUD helpers for the `composer_presets` table (per-account composer
//! settings). Functions are async, take a `&SqlitePool`, and return
//! `Result<_, AppDbError>`. Account-scoped lookups/updates/deletes take an
//! `account_id`; single-row operations return `AppDbError::NotFound` when the
//! row is missing. All operations return `AppDbError::Database` on SQL failure.

use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::mail::schema::ComposerPreset;

/// List composer presets for an account, oldest-created first.
///
/// * `account_id` — owning account.
/// * Returns the matching `ComposerPreset` rows.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn list(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<Vec<ComposerPreset>, AppDbError> {
    sqlx::query_as::<_, ComposerPreset>(
        "SELECT * FROM composer_presets WHERE account_id = ? ORDER BY created_at ASC",
    )
    .bind(account_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Fetch a single composer preset by id within an account.
///
/// * `id` — primary key of the preset.
/// * `account_id` — owning account (scopes the lookup).
/// * Returns the matching `ComposerPreset`.
/// * Errors: `AppDbError::NotFound` when no such preset exists for the account;
///   `AppDbError::Database` on SQL failure.
pub async fn get_by_id(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<ComposerPreset, AppDbError> {
    sqlx::query_as::<_, ComposerPreset>(
        "SELECT * FROM composer_presets WHERE id = ? AND account_id = ?",
    )
    .bind(id)
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Composer preset {} not found", id)))
}

/// Fetch the default composer preset (`is_default = 1`) for an account.
///
/// * `account_id` — owning account.
/// * Returns the matching `ComposerPreset`.
/// * Errors: `AppDbError::NotFound` when the account has no default preset;
///   `AppDbError::Database` on SQL failure.
pub async fn get_default(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<ComposerPreset, AppDbError> {
    sqlx::query_as::<_, ComposerPreset>(
        "SELECT * FROM composer_presets WHERE account_id = ? AND is_default = 1 LIMIT 1",
    )
    .bind(account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!(
        "No default composer preset for account {}",
        account_id
    )))
}

/// Insert a new composer preset, generating its `id` and `created_at`.
///
/// * `data` — preset fields (`id`/`created_at` overwritten by the database).
/// * Returns the newly created `ComposerPreset`.
/// * Errors: `AppDbError::Database` on SQL failure.
pub async fn create(
    pool: &SqlitePool,
    data: &ComposerPreset,
) -> Result<ComposerPreset, AppDbError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    sqlx::query_as::<_, ComposerPreset>(
        r#"INSERT INTO composer_presets (
            id, account_id, name, default_reply_mode, send_and_archive,
            undo_send_delay, font_family, font_size, is_default, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"#,
    )
    .bind(&id)
    .bind(&data.account_id)
    .bind(&data.name)
    .bind(&data.default_reply_mode)
    .bind(data.send_and_archive)
    .bind(data.undo_send_delay)
    .bind(&data.font_family)
    .bind(data.font_size)
    .bind(data.is_default)
    .bind(now)
    .fetch_one(pool)
    .await
    .map_err(AppDbError::Database)
}

pub async fn update(
    pool: &SqlitePool,
    data: &ComposerPreset,
) -> Result<ComposerPreset, AppDbError> {
    sqlx::query_as::<_, ComposerPreset>(
        r#"UPDATE composer_presets SET
            name = ?, default_reply_mode = ?, send_and_archive = ?,
            undo_send_delay = ?, font_family = ?, font_size = ?, is_default = ?
        WHERE id = ? AND account_id = ? RETURNING *"#,
    )
    .bind(&data.name)
    .bind(&data.default_reply_mode)
    .bind(data.send_and_archive)
    .bind(data.undo_send_delay)
    .bind(&data.font_family)
    .bind(data.font_size)
    .bind(data.is_default)
    .bind(&data.id)
    .bind(&data.account_id)
    .fetch_optional(pool)
    .await
    .map_err(AppDbError::Database)?
    .ok_or_else(|| AppDbError::NotFound(format!("Composer preset {} not found", data.id)))
}

/// Delete a composer preset by id and account.
///
/// * `id` — primary key of the preset.
/// * `account_id` — owning account (scopes the delete).
/// * Returns `()` on success.
/// * Errors: `AppDbError::NotFound` when no matching row exists (0 rows
///   affected); `AppDbError::Database` on SQL failure.
pub async fn delete(
    pool: &SqlitePool,
    id: &str,
    account_id: &str,
) -> Result<(), AppDbError> {
    let result = sqlx::query("DELETE FROM composer_presets WHERE id = ? AND account_id = ?")
        .bind(id)
        .bind(account_id)
        .execute(pool)
        .await
        .map_err(AppDbError::Database)?;
    if result.rows_affected() == 0 {
        return Err(AppDbError::NotFound(format!("Composer preset {} not found", id)));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    fn make_preset(account_id: &str) -> ComposerPreset {
        ComposerPreset {
            id: String::new(),
            account_id: account_id.to_string(),
            name: "My Preset".to_string(),
            default_reply_mode: "reply".to_string(),
            send_and_archive: 0,
            undo_send_delay: 10,
            font_family: "sans-serif".to_string(),
            font_size: 14,
            is_default: 0,
            created_at: 0,
        }
    }

    #[tokio::test]
    async fn test_create_preset() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let data = make_preset("acct_1");
        let created = create(&pool, &data).await.unwrap();
        assert!(!created.id.is_empty());
        assert_eq!(created.name, "My Preset");
        assert_eq!(created.account_id, "acct_1");
    }

    #[tokio::test]
    async fn test_list_presets() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        // The trigger trg_composer_preset_new_account auto-creates a default preset.
        // Delete it so we can assert on only the ones we create.
        sqlx::query("DELETE FROM composer_presets WHERE account_id = ? AND is_default = 1")
            .bind("acct_1")
            .execute(&pool)
            .await
            .unwrap();
        create(&pool, &make_preset("acct_1")).await.unwrap();
        create(&pool, &make_preset("acct_1")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[tokio::test]
    async fn test_list_presets_scoped() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        helpers::insert_test_account(&pool, "acct_2").await;
        // Delete auto-created defaults from the trigger
        sqlx::query("DELETE FROM composer_presets WHERE is_default = 1")
            .execute(&pool)
            .await
            .unwrap();
        create(&pool, &make_preset("acct_1")).await.unwrap();
        create(&pool, &make_preset("acct_2")).await.unwrap();
        let rows = list(&pool, "acct_1").await.unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[tokio::test]
    async fn test_get_by_id_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_preset("acct_1")).await.unwrap();
        let fetched = get_by_id(&pool, &created.id, "acct_1").await.unwrap();
        assert_eq!(fetched.id, created.id);
    }

    #[tokio::test]
    async fn test_get_by_id_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_by_id(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_default_found() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut data = make_preset("acct_1");
        data.is_default = 1;
        data.name = "Default".to_string();
        create(&pool, &data).await.unwrap();
        let default = get_default(&pool, "acct_1").await.unwrap();
        assert_eq!(default.is_default, 1);
    }

    #[tokio::test]
    async fn test_get_default_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = get_default(&pool, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_update_preset() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let mut created = create(&pool, &make_preset("acct_1")).await.unwrap();
        created.name = "Updated Preset".to_string();
        created.undo_send_delay = 30;
        let updated = update(&pool, &created).await.unwrap();
        assert_eq!(updated.name, "Updated Preset");
        assert_eq!(updated.undo_send_delay, 30);
    }

    #[tokio::test]
    async fn test_delete_preset() {
        let pool = helpers::create_memory_pool().await;
        helpers::insert_test_account(&pool, "acct_1").await;
        let created = create(&pool, &make_preset("acct_1")).await.unwrap();
        delete(&pool, &created.id, "acct_1").await.unwrap();
        let result = get_by_id(&pool, &created.id, "acct_1").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_delete_not_found() {
        let pool = helpers::create_memory_pool().await;
        let result = delete(&pool, "nonexistent", "acct_1").await;
        assert!(result.is_err());
    }
}
