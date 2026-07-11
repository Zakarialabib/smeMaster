// ── Logging Commands – Frontend log capture and inspection ─────────────

use crate::error::SerializedError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{LazyLock, Mutex};

static LOGS: LazyLock<Mutex<VecDeque<LogEntry>>> = LazyLock::new(|| Mutex::new(VecDeque::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub message: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

impl LogEntry {
    pub fn new(
        level: LogLevel,
        message: String,
        category: String,
        data: Option<serde_json::Value>,
    ) -> Self {
        // Forward to standard logger (file/stdout) based on level
        match level {
            LogLevel::Error => log::error!(target: &category, "{}", message),
            LogLevel::Warn => log::warn!(target: &category, "{}", message),
            LogLevel::Info => log::info!(target: &category, "{}", message),
            LogLevel::Debug => log::debug!(target: &category, "{}", message),
        }

        let entry = Self {
            id: format!(
                "log_{}_{}",
                Utc::now().timestamp_millis(),
                uuid::Uuid::new_v4().simple()
            ),
            timestamp: Utc::now(),
            level,
            message,
            category,
            data,
        };

        // Append to in-memory buffer (capped at 1000 entries)
        if let Ok(mut logs) = LOGS.lock() {
            logs.push_back(entry.clone());
            while logs.len() > 1000 {
                logs.pop_front();
            }
        }

        entry
    }
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_logs(limit: Option<usize>) -> Result<Vec<LogEntry>, SerializedError> {
    let limit = limit.unwrap_or(100);
    let logs = LOGS.lock().map_err(|e| {
        SerializedError::new("INTERNAL_ERROR", format!("Failed to lock logs: {}", e))
    })?;
    // Return the last `limit` entries in reverse order (newest first)
    Ok(logs.iter().rev().take(limit).cloned().collect())
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_logs() -> Result<(), SerializedError> {
    let mut logs = LOGS.lock().map_err(|e| {
        SerializedError::new("INTERNAL_ERROR", format!("Failed to lock logs: {}", e))
    })?;
    logs.clear();
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn log_event(
    level: String,
    message: String,
    category: Option<String>,
    data: Option<serde_json::Value>,
) -> Result<(), SerializedError> {
    let log_level = match level.to_lowercase().as_str() {
        "debug" => LogLevel::Debug,
        "info" => LogLevel::Info,
        "warn" | "warning" => LogLevel::Warn,
        "error" => LogLevel::Error,
        _ => LogLevel::Info,
    };

    LogEntry::new(
        log_level,
        message,
        category.unwrap_or_else(|| "frontend".to_string()),
        data,
    );
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn log_error_command(
    error: String,
    stack: Option<String>,
    component: Option<String>,
    timestamp: Option<String>,
) -> Result<(), SerializedError> {
    let mut data = serde_json::Map::new();
    if let Some(s) = stack {
        data.insert("stack".to_string(), serde_json::Value::String(s));
    }
    if let Some(c) = component {
        data.insert("component".to_string(), serde_json::Value::String(c));
    }
    if let Some(t) = timestamp {
        data.insert(
            "original_timestamp".to_string(),
            serde_json::Value::String(t),
        );
    }

    LogEntry::new(
        LogLevel::Error,
        error,
        "frontend".to_string(),
        Some(serde_json::Value::Object(data)),
    );
    Ok(())
}

// ── Register function ─────────────────────────────────────────────────

// NOTE: This module's #[tauri::command] functions are wired up
//       in the master commands::register() handler list.
//       Calling invoke_handler here would REPLACE the master handler
//       and break all other modules (Tauri v2 keeps only the last
//       invoke_handler). See commands/mod.rs::register().
//     builder
// }
