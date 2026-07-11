use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Emitter;
use crate::error::SerializedError;

type CmdResult<T> = Result<T, SerializedError>;

#[derive(Debug, Serialize, Deserialize)]
pub struct OnboardingFlag {
    pub done: bool,
}

#[tauri::command]
pub async fn is_system_initialized(
    pool: tauri::State<'_, SqlitePool>,
) -> CmdResult<bool> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM app_config WHERE key = 'is_initialized'"
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| SerializedError::from(format!("DB error: {e}")))?;

    match row {
        Some((val,)) => Ok(val == "true"),
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn complete_onboarding(
    pool: tauri::State<'_, SqlitePool>,
    app: AppHandle,
) -> CmdResult<()> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO app_config (key, value, updated_at) VALUES ('is_initialized', 'true', ?) \
         ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = ?"
    )
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| SerializedError::from(format!("DB error: {e}")))?;

    log::info!("[onboarding] System initialized — emitting completion event");

    // Emit event so spawn_orchestrator can safely transition the state machine
    let _ = app.emit("onboarding:completed", ());

    Ok(())
}
