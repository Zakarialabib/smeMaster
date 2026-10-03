//! Onboarding commands — step-by-step wizard, demo seeding, status checks

use tauri::{command, State};
use sqlx::SqlitePool;

/// Save onboarding wizard data (step-by-step persistence)
#[command]
pub async fn db_save_onboarding_step(
    pool: State<'_, SqlitePool>,
    step: i64,
    data: String, // JSON blob of current step data
) -> Result<(), String> {
    // Upsert into settings: key='onboarding_step', value=step
    // Upsert into settings: key='onboarding_data', value=data
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_step', ?)")
        .bind(step.to_string())
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to save step: {e}"))?;

    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_data', ?)")
        .bind(&data)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to save data: {e}"))?;

    Ok(())
}

/// Get saved onboarding progress
#[command]
pub async fn db_get_onboarding_progress(
    pool: State<'_, SqlitePool>,
) -> Result<(i64, String), String> {
    let step: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'onboarding_step'")
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .flatten();

    let data: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'onboarding_data'")
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .flatten();

    Ok((step.and_then(|s| s.parse().ok()).unwrap_or(0), data.unwrap_or_else(|| "{}".to_string())))
}

/// Seed demo data with a specific preset
#[command]
pub async fn db_seed_demo_preset(
    pool: State<'_, SqlitePool>,
    preset: String, // "solo_freelancer", "small_team", "sales_focused", "custom"
    business_name: String,
    theme: String,  // "light", "dark", "system"
) -> Result<String, String> {
    // 1. Update company name
    sqlx::query("UPDATE companies SET name = ?, updated_at = ? WHERE id = (SELECT id FROM companies LIMIT 1)")
        .bind(&business_name)
        .bind(chrono::Utc::now().timestamp())
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to update company name: {e}"))?;

    // 2. Set theme
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_theme', ?)")
        .bind(&theme)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to save theme: {e}"))?;

    // 3. Trigger full demo seed
    crate::db::seed::seed_all(&*pool).await
        .map_err(|e| format!("Seed error: {e}"))?;

    // 4. Mark onboarding complete
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('is_initialized', 'true', ?)")
        .bind(chrono::Utc::now().timestamp())
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to finalize: {e}"))?;

    Ok(format!("Seeded with preset: {preset}"))
}

/// Save final onboarding preferences (called at end of wizard)
#[command]
pub async fn db_finalize_onboarding(
    pool: State<'_, SqlitePool>,
    business_name: String,
    theme: String,
    enable_mail: bool,
    enable_crm: bool,
    enable_campaigns: bool,
    enable_calendar: bool,
    enable_ai: bool,
    has_connected_email: bool,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp();

    // 1. Update company name
    sqlx::query("UPDATE companies SET name = ?, updated_at = ? WHERE id = (SELECT id FROM companies LIMIT 1)")
        .bind(&business_name)
        .bind(now)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to update company: {e}"))?;

    // 2. Save theme
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_theme', ?)")
        .bind(&theme)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to save theme: {e}"))?;

    // 3. Save tool preferences as JSON
    let tools_json = serde_json::json!({
        "mail": enable_mail,
        "crm": enable_crm,
        "campaigns": enable_campaigns,
        "calendar": enable_calendar,
        "ai": enable_ai,
    }).to_string();
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('enabled_tools', ?)")
        .bind(&tools_json)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to save tools: {e}"))?;

    // 4. Save email connected status
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('email_connected', ?)")
        .bind(if has_connected_email { "true" } else { "false" })
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to save email status: {e}"))?;

    // 5. Mark complete
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('is_initialized', 'true', ?)")
        .bind(now)
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to finalize: {e}"))?;

    // 6. Clean up onboarding temp data
    sqlx::query("DELETE FROM settings WHERE key IN ('onboarding_step', 'onboarding_data')")
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to cleanup: {e}"))?;

    Ok(())
}

/// Allow or deny demo/seed data.
///
/// When `enabled` is false, the orchestrator will not auto-seed demo data on
/// startup (and any future first-run will stay empty). When true (the default),
/// demo data seeds on first run as before. This gives the user explicit control
/// over whether mock data is present alongside their real data.
///
/// Note: this only gates *auto* seeding. Explicit seeding via
/// `db_seed_demo_preset` (onboarding preset choice) is unaffected.
#[command]
pub async fn db_set_demo_data_enabled(
    pool: State<'_, SqlitePool>,
    enabled: bool,
) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_data_enabled', ?)")
        .bind(if enabled { "true" } else { "false" })
        .execute(&*pool)
        .await
        .map_err(|e| format!("Failed to set demo_data_enabled: {e}"))?;
    Ok(())
}

/// Check if user has connected at least one email account
#[command]
pub async fn db_has_email_accounts(
    pool: State<'_, SqlitePool>,
) -> Result<bool, String> {
    let count: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts WHERE is_active = 1")
        .fetch_one(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    Ok(count > 0)
}

/// Get tool enablement status for feature gating
#[command]
pub async fn db_get_tool_status(
    pool: State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    let tools_json: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'enabled_tools'")
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?
        .flatten();

    let email_count: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts WHERE is_active = 1")
        .fetch_one(&*pool)
        .await
        .map_err(|e| format!("DB error: {e}"))?;
    let email_connected = email_count > 0;

    let mut result = serde_json::json!({
        "email_connected": email_connected,
    });

    if let Some(json_str) = tools_json {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if let Some(obj) = result.as_object_mut() {
                for (k, v) in parsed.as_object().unwrap_or(&serde_json::Map::new()) {
                    obj.insert(k.clone(), v.clone());
                }
            }
        }
    }

    Ok(result)
}
