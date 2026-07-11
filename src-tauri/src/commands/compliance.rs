// ── Compliance Commands ────────────────────────────────────────────────────

use serde::Deserialize;
use tauri::State;
use sqlx::SqlitePool;
use crate::db::error::AppDbError;
use crate::db::compliance::schema::{ComplianceCheck, ComplianceProfile};
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

// ── Request types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertComplianceCheckRequest {
    pub id: String,
    pub company_id: String,
    pub email_draft_id: Option<String>,
    pub campaign_id: Option<String>,
    pub profile_ids: String,
    pub score: f64,
    pub violations_json: String,
}

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//    builder
// }

#[tauri::command]
pub async fn db_list_compliance_profiles(
    pool: State<'_, SqlitePool>,
) -> CmdResult<Vec<ComplianceProfile>> {
    crate::db::tables::compliance::profiles::list(&pool)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_compliance_checks(
    pool: State<'_, SqlitePool>,
    company_id: String,
) -> CmdResult<Vec<ComplianceCheck>> {
    crate::db::tables::compliance::checks::list(&pool, &company_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_compliance_profile_by_code(
    pool: State<'_, SqlitePool>,
    code: String,
) -> CmdResult<ComplianceProfile> {
    crate::db::tables::compliance::profiles::get_by_code(&pool, &code)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_create_compliance_profile(
    pool: State<'_, SqlitePool>,
    code: String,
    name: String,
    description: Option<String>,
    region_hint: String,
    rules_json: String,
    is_default: bool,
) -> CmdResult<ComplianceProfile> {
    crate::db::tables::compliance::profiles::create(
        &pool, &code, &name, description.as_deref(), &region_hint, &rules_json, is_default,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_compliance_check(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<ComplianceCheck> {
    crate::db::tables::compliance::checks::get_by_id(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_set_compliance_profile_active(
    pool: State<'_, SqlitePool>,
    id: String,
    active: bool,
) -> CmdResult<()> {
    crate::db::tables::compliance::profiles::update(
        &pool, &id, None, None, None, None, Some(active), None,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn db_set_default_compliance_profile(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    sqlx::query("UPDATE compliance_profiles SET is_default = 0 WHERE is_default = 1")
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    sqlx::query("UPDATE compliance_profiles SET is_default = 1 WHERE id = ?")
        .bind(&id)
        .execute(&*pool)
        .await
        .map_err(AppDbError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn db_get_compliance_profile(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<Option<ComplianceProfile>> {
    match crate::db::tables::compliance::profiles::get_by_id(&pool, &id).await {
        Ok(profile) => Ok(Some(profile)),
        Err(AppDbError::NotFound(_)) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[tauri::command]
pub async fn db_upsert_compliance_profile(
    pool: State<'_, SqlitePool>,
    id: String,
    code: String,
    name: String,
    description: Option<String>,
    region_hint: Option<String>,
    rules_json: String,
    is_active: Option<bool>,
    is_default: Option<bool>,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO compliance_profiles (id, code, name, description, region_hint, rules_json, is_active, is_default, created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, region_hint=excluded.region_hint, rules_json=excluded.rules_json, is_active=excluded.is_active, is_default=excluded.is_default"
    )
    .bind(&id)
    .bind(&code)
    .bind(&name)
    .bind(&description)
    .bind(region_hint.as_deref().unwrap_or(""))
    .bind(&rules_json)
    .bind(is_active.map(|v| if v {1} else {0}).unwrap_or(1))
    .bind(is_default.map(|v| if v {1} else {0}).unwrap_or(0))
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_delete_compliance_profile(
    pool: State<'_, SqlitePool>,
    id: String,
) -> CmdResult<()> {
    crate::db::tables::compliance::profiles::delete(&pool, &id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_insert_compliance_profile_ignore(
    pool: State<'_, SqlitePool>,
    id: String,
    code: String,
    name: String,
    description: Option<String>,
    region_hint: Option<String>,
    rules_json: String,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT OR IGNORE INTO compliance_profiles (id, code, name, description, region_hint, rules_json, is_active, is_default, created_at) VALUES (?,?,?,?,?,?,1,0,?)"
    )
    .bind(&id)
    .bind(&code)
    .bind(&name)
    .bind(&description)
    .bind(region_hint.as_deref().unwrap_or(""))
    .bind(&rules_json)
    .bind(now)
    .execute(&*pool)
    .await
    .map_err(|e| AppDbError::Database(e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_insert_compliance_check(
    pool: State<'_, SqlitePool>,
    check: InsertComplianceCheckRequest,
) -> CmdResult<()> {
    crate::db::tables::compliance::checks::create(
        &pool,
        &check.id,
        &check.company_id,
        check.email_draft_id.as_deref(),
        check.campaign_id.as_deref(),
        &check.profile_ids,
        check.score,
        Some(&check.violations_json),
    )
    .await
    .map_err(Into::into)
    .map(|_| ())
}

#[tauri::command]
pub async fn db_delete_old_compliance_checks(
    pool: State<'_, SqlitePool>,
    before: i64,
) -> CmdResult<u64> {
    crate::db::tables::compliance::checks::delete_old(&pool, before)
        .await
        .map_err(Into::into)
}
