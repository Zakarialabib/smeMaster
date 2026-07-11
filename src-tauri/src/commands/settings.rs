// ── Database Commands – Settings Domain ────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::{State, AppHandle, Emitter};
use sqlx::SqlitePool;

use crate::db::error::AppDbError;
use crate::db::core::schema::Setting;
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

const THEME_PREFERENCE_KEY: &str = "theme_preference";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThemePreference {
    pub mode: String,
    pub color_theme: String,
    pub font_scale: f32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WritingStyleProfileRow {
    pub id: String,
    pub account_id: String,
    pub profile_text: String,
    pub sample_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertWritingStyleProfileRequest {
    pub account_id: String,
    pub profile_text: String,
    pub sample_count: i64,
}

// ── Count-row helper ────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CountRow {
    pub count: i64,
}

// ── Register function ──────────────────────────────────────────────────────

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn db_get_setting(
    pool: State<'_, SqlitePool>,
    key: String,
) -> CmdResult<Option<String>> {
    crate::db::tables::core::settings::get(&pool, &key)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_set_setting(
    pool: State<'_, SqlitePool>,
    key: String,
    value: String,
) -> CmdResult<()> {
    crate::db::tables::core::settings::set(&pool, &key, &value)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_setting(
    pool: State<'_, SqlitePool>,
    // _account_id: String,
    key: String,
) -> CmdResult<()> {
    crate::db::tables::core::settings::delete(&pool, &key)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_settings(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<Setting>> {
    crate::db::tables::core::settings::list_all(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_theme_preference(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Option<ThemePreference>> {
    let raw = crate::db::tables::core::settings::get(&pool, THEME_PREFERENCE_KEY)
        .await
        .map_err(SerializedError::from)?;
    match raw {
        None => Ok(None),
        Some(json) => match serde_json::from_str::<ThemePreference>(&json) {
            Ok(pref) => Ok(Some(pref)),
            Err(e) => {
                log::warn!("Failed to parse theme preference: {e}");
                Ok(None)
            }
        },
    }
}

#[tauri::command]
pub async fn db_set_theme_preference(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
    preference: ThemePreference,
) -> CmdResult<()> {
    let json = serde_json::to_string(&preference)
        .map_err(|e| AppDbError::Crypto(format!("Serialize theme preference: {e}")))?;
    crate::db::tables::core::settings::set(&pool, THEME_PREFERENCE_KEY, &json)
        .await
        .map_err(SerializedError::from)?;
    let _ = app.emit("theme:preference_changed", &preference);
    Ok(())
}

#[tauri::command]
pub async fn db_cache_attachment(
    pool: State<'_, SqlitePool>,
    id: String,
    local_path: String,
    cache_size: i64,
) -> CmdResult<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    sqlx::query("UPDATE attachments SET local_path = ?, cached_at = ?, cache_size = ? WHERE id = ?")
        .bind(&local_path)
        .bind(now)
        .bind(cache_size)
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn db_clear_attachment_cache(
    pool: State<'_, SqlitePool>,
) -> CmdResult<()> {
    sqlx::query("UPDATE attachments SET local_path = NULL, cached_at = NULL, cache_size = NULL WHERE cached_at IS NOT NULL")
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn db_evict_single_attachment_cache(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    sqlx::query("UPDATE attachments SET local_path = NULL, cached_at = NULL, cache_size = NULL WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

// ── Writing Style Profiles ──

#[tauri::command]
pub async fn db_list_writing_style_profiles(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<WritingStyleProfileRow>> {
    sqlx::query_as::<_, WritingStyleProfileRow>(
        "SELECT * FROM writing_style_profiles WHERE account_id = ? ORDER BY created_at DESC"
    )
    .bind(&account_id)
    .fetch_all(&*pool)
    .await
    .map_err(AppDbError::Database)
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_writing_style_profile(
    pool: State<'_, SqlitePool>,
    profile: UpsertWritingStyleProfileRequest,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    // Use INSERT OR REPLACE on UNIQUE(account_id) constraint
    sqlx::query(
        "INSERT INTO writing_style_profiles (id, account_id, profile_text, sample_count, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?) \
         ON CONFLICT(account_id) DO UPDATE SET \
         profile_text = excluded.profile_text, \
         sample_count = excluded.sample_count, \
         updated_at = excluded.updated_at"
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&profile.account_id)
    .bind(&profile.profile_text)
    .bind(profile.sample_count)
    .bind(now)
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn db_delete_writing_style_profile(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    let rows = sqlx::query("DELETE FROM writing_style_profiles WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?
        .rows_affected();
    if rows == 0 {
        return Err(AppDbError::NotFound(format!("WritingStyleProfile {id}")).into());
    }
    Ok(())
}

// ── Count queries ────────────────────────────────────────────────────────────

/// Returns the number of signatures for a given account.
/// Frontend expects `[{ count: number }]` to match existing seed code.
#[tauri::command]
pub async fn db_count_signatures(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<CountRow>> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM signatures WHERE account_id = ?",
    )
    .bind(&account_id)
    .fetch_one(&*pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(vec![CountRow { count }])
}

/// Returns the total number of compliance profiles.
/// Frontend expects `[{ count: number }]` to match existing seed code.
#[tauri::command]
pub async fn db_count_compliance_profiles(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<CountRow>> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM compliance_profiles",
    )
    .fetch_one(&*pool)
    .await
    .map_err(AppDbError::Database)?;
    Ok(vec![CountRow { count }])
}