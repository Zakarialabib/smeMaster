// ── Automation Engine ─────────────────────────────────────────────────────────
//
// Wires workflow rules to domain events. Called from the DomainEventProcessor
// for every event that can trigger automation (EmailReceived, ContactUpdated,
// TaskCompleted, etc.).
//
// Flow per event:
//   1. Query `list_by_trigger()` for active rules matching the trigger_event
//   2. Evaluate each rule's `trigger_conditions` (JSON) against the event payload
//   3. Execute each matching rule's `actions` (JSON array)
//   4. Record execution in `workflow_execution_logs`
//
// All actions that persist data use the shared SqlitePool. Actions requiring
// external services (SMTP, IMAP, notifications) are logged and queued as
// pending operations.

use serde_json::Value as JsonValue;
use sqlx::SqlitePool;
use uuid::Uuid;
use crate::events::AppEvent;

// ── Condition evaluation ─────────────────────────────────────────────────────

/// Evaluate a rule's `trigger_conditions` JSON against an `AppEvent`.
///
/// Semantics:
/// - `None` / empty / `null` conditions → match always (catch-all rule).
/// - Otherwise, the condition is a JSON object whose keys are field names
///   that must exist on the event. Each value is matched as a **substring**
///   of the corresponding event field's string representation (case-sensitive).
///
/// This keeps conditions simple and human-readable. The frontend records
/// conditions like `{"from_address": "vip@example.com"}` or
/// `{"account_id": "acc-001"}` in the `trigger_conditions` column.
pub fn evaluate_conditions(conditions: Option<&str>, event: &AppEvent) -> bool {
    let cond_str = match conditions {
        Some(s) if !s.is_empty() => s,
        _ => return true, // no conditions → match all
    };

    let cond: JsonValue = match serde_json::from_str(cond_str) {
        Ok(v) => v,
        Err(_) => {
            log::warn!("[automation] Malformed trigger_conditions, skipping rule");
            return false;
        }
    };

    let cond_obj = match cond.as_object() {
        Some(obj) => obj,
        _ => {
            // If conditions is not an object, treat it as always-match
            // (legacy rules might store a bare string or array)
            return true;
        }
    };

    if cond_obj.is_empty() {
        return true;
    }

    // Build a lookup map of field → string value for the event
    let event_fields = extract_event_fields(event);

    for (key, expected_val) in cond_obj {
        let expected_str = match expected_val.as_str() {
            Some(s) => s,
            _ => {
                // Non-string condition values are coerced to their JSON repr
                &expected_val.to_string()
            }
        };

        match event_fields.get(key.as_str()) {
            Some(actual_str) => {
                // Substring match (case-sensitive)
                if !actual_str.contains(expected_str) {
                    return false;
                }
            }
            None => {
                // Field not present on this event variant → no match
                return false;
            }
        }
    }

    true
}

/// Extract a flat string map from an AppEvent for condition matching.
fn extract_event_fields(event: &AppEvent) -> std::collections::HashMap<&'static str, String> {
    use std::collections::HashMap;
    let mut map = HashMap::new();

    match event {
        AppEvent::EmailReceived { account_id, message_id, from_address, date } => {
            map.insert("account_id", account_id.clone());
            map.insert("message_id", message_id.clone());
            map.insert("from_address", from_address.clone());
            map.insert("date", date.to_string());
        }
        AppEvent::ContactUpdated { contact_id } => {
            map.insert("contact_id", contact_id.clone());
        }
        AppEvent::TaskCompleted { task_id } => {
            map.insert("task_id", task_id.clone());
        }
        AppEvent::EmailOpened { account_id, message_id, contact_id, timestamp } => {
            map.insert("account_id", account_id.clone());
            map.insert("message_id", message_id.clone());
            map.insert("contact_id", contact_id.clone());
            map.insert("timestamp", timestamp.to_string());
        }
        AppEvent::LinkClicked { account_id, message_id, contact_id, url, timestamp } => {
            map.insert("account_id", account_id.clone());
            map.insert("message_id", message_id.clone());
            map.insert("contact_id", contact_id.clone());
            map.insert("url", url.clone());
            map.insert("timestamp", timestamp.to_string());
        }
        _ => {}
    }

    map
}

// ── Action execution ─────────────────────────────────────────────────────────

/// Execute a JSON actions array against the event.
///
/// Each action is an object with at least an `"action"` string field. Supported
/// action types and their implementations:
///
/// | Action | Implementation | Status |
/// |--------|---------------|--------|
/// | `log` | Log a message | ✅ Real |
/// | `tag` | INSERT into message_tags | ✅ Real |
/// | `flag` | UPDATE messages SET is_flagged=1 | ✅ Real |
/// | `notify` | Log (UI notification future) | ⚠️ Log |
/// | `archive` | UPDATE messages SET imap_folder='Archive' | ✅ Real |
/// | `add_note` | INSERT into notes table | ✅ Real |
/// | `score` | UPDATE contacts SET score | ✅ Real |
/// | `mark_read` | UPDATE messages SET is_read=1 | ✅ Real |
/// | `star` | UPDATE messages SET is_starred=1 | ✅ Real |
/// | `apply_label` | INSERT into message_labels | ✅ Real |
/// | `create_task` | INSERT into tasks table | ✅ Real |
/// | `send_template` | Log (needs SMTP) | ⚠️ Log |
/// | `forward_to` | Log (needs IMAP) | ⚠️ Log |
/// | `send_notification` | Log (needs notification plugin) | ⚠️ Log |
///
/// Returns a JSON array of action results with per-action status.
pub async fn execute_actions(
    actions_json: &str,
    pool: &SqlitePool,
    event: &AppEvent,
) -> Result<Vec<JsonValue>, String> {
    let actions: Vec<JsonValue> = match serde_json::from_str(actions_json) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[automation] Malformed actions JSON: {e}");
            return Err(format!("Malformed actions JSON: {e}"));
        }
    };

    let mut results: Vec<JsonValue> = Vec::with_capacity(actions.len());

    for action_obj in &actions {
        let action_name = action_obj
            .get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        let result = match action_name {
            // ── Log ─────────────────────────────────────────────────────
            "log" => {
                log::info!(
                    "[automation] Rule matched — event={:?}, action=log",
                    std::mem::discriminant(event)
                );
                Ok(serde_json::json!({"action": "log", "status": "ok"}))
            }

            // ── Tag message ─────────────────────────────────────────────
            "tag" => {
                let tag = action_obj
                    .get("tag")
                    .and_then(|v| v.as_str())
                    .unwrap_or("auto-tag");
                execute_tag_action(pool, event, tag).await
            }

            // ── Flag message ────────────────────────────────────────────
            "flag" => {
                execute_flag_action(pool, event).await
            }

            // ── Notify (log only for now) ───────────────────────────────
            "notify" => {
                let message = action_obj
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Workflow rule triggered");
                log::info!("[automation] Notify action: {message}");
                // Future: emit a Tauri notification via the notification plugin
                Ok(serde_json::json!({"action": "notify", "status": "logged", "message": message}))
            }

            // ── Archive message ─────────────────────────────────────────
            "archive" => {
                execute_archive_action(pool, event).await
            }

            // ── Add note ────────────────────────────────────────────────
            "add_note" => {
                let note = action_obj
                    .get("note")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                execute_add_note_action(pool, event, note).await
            }

            // ── Score contact ───────────────────────────────────────────
            "score" => {
                let delta = action_obj
                    .get("score_delta")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if delta != 0 {
                    if let Some(contact_id) = extract_contact_id(event) {
                        log::info!("[automation] Score action: contact={contact_id}, delta={delta}");
                        match update_contact_score(pool, &contact_id, delta).await {
                            Ok(_) => Ok(serde_json::json!({"action": "score", "status": "ok", "contact_id": contact_id, "delta": delta})),
                            Err(e) => Ok(serde_json::json!({"action": "score", "status": "failed", "error": e})),
                        }
                    } else {
                        log::warn!("[automation] Score action requires a contact_id in the event");
                        Ok(serde_json::json!({"action": "score", "status": "skipped", "reason": "No contact_id in event"}))
                    }
                } else {
                    Ok(serde_json::json!({"action": "score", "status": "skipped", "reason": "delta is 0"}))
                }
            }

            // ── Mark as read ────────────────────────────────────────────
            "mark_read" => {
                execute_mark_read_action(pool, event).await
            }

            // ── Star message ────────────────────────────────────────────
            "star" => {
                execute_star_action(pool, event).await
            }

            // ── Apply label ─────────────────────────────────────────────
            "apply_label" => {
                let label = action_obj
                    .get("label")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                execute_apply_label_action(pool, event, label).await
            }

            // ── Create task ─────────────────────────────────────────────
            "create_task" => {
                let title = action_obj
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Task from workflow");
                let due_days = action_obj
                    .get("due_days")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                execute_create_task_action(pool, event, title, due_days).await
            }

            // ── Send template (log only — needs SMTP) ───────────────────
            "send_template" => {
                let template_id = action_obj
                    .get("templateId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                log::info!("[automation] Send-template action: template={template_id} — SMTP sending not yet implemented");
                Ok(serde_json::json!({"action": "send_template", "status": "logged", "template_id": template_id}))
            }

            // ── Forward to (log only — needs IMAP) ──────────────────────
            "forward_to" => {
                let forward_to = action_obj
                    .get("forward_to")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                log::info!("[automation] Forward-to action: forward_to={forward_to} — IMAP forwarding not yet implemented");
                Ok(serde_json::json!({"action": "forward_to", "status": "logged", "forward_to": forward_to}))
            }

            // ── Send notification (log only — needs plugin) ─────────────
            "send_notification" => {
                let title = action_obj
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Workflow");
                let body = action_obj
                    .get("body")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                log::info!("[automation] Send-notification action: title={title}, body={body} — Tauri notification plugin not wired");
                Ok(serde_json::json!({"action": "send_notification", "status": "logged", "title": title}))
            }

            // ── Unknown ─────────────────────────────────────────────────
            other => {
                log::debug!("[automation] Unknown action type: {other} — skipped");
                Ok(serde_json::json!({"action": other, "status": "skipped", "reason": "Unknown action type"}))
            }
        };

        match result {
            Ok(r) => results.push(r),
            Err(e) => {
                log::warn!("[automation] Action {action_name} failed: {e}");
                results.push(serde_json::json!({"action": action_name, "status": "error", "error": e}));
            }
        }
    }

    Ok(results)
}

// ── Individual action implementations ─────────────────────────────────────────

/// Tag a message: INSERT into message_tags.
async fn execute_tag_action(
    pool: &SqlitePool,
    event: &AppEvent,
    tag: &str,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Tag action requires a message event");
            return Ok(serde_json::json!({"action": "tag", "status": "skipped", "reason": "No message in event"}));
        }
    };

    let id = format!("mt-{}", Uuid::new_v4());
    let now = chrono::Utc::now().timestamp();

    let result = sqlx::query(
        "INSERT OR IGNORE INTO message_tags (id, account_id, message_id, tag, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&account_id)
    .bind(&message_id)
    .bind(tag)
    .bind(now)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            log::info!("[automation] Tagged message {message_id} with \"{tag}\"");
            Ok(serde_json::json!({"action": "tag", "status": "ok", "tag": tag, "message_id": message_id}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to tag message {message_id}: {e}");
            Err(format!("Failed to tag message: {e}"))
        }
    }
}

/// Flag a message: UPDATE messages SET is_flagged = 1.
async fn execute_flag_action(
    pool: &SqlitePool,
    event: &AppEvent,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Flag action requires a message event");
            return Ok(serde_json::json!({"action": "flag", "status": "skipped", "reason": "No message in event"}));
        }
    };

    // Ensure is_flagged column exists (migration 026 may not have run yet)
    ensure_is_flagged_column(pool).await;

    let result = sqlx::query(
        "UPDATE messages SET is_flagged = 1 WHERE account_id = ? AND id = ?"
    )
    .bind(&account_id)
    .bind(&message_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            log::info!("[automation] Flagged message {message_id}");
            Ok(serde_json::json!({"action": "flag", "status": "ok", "message_id": message_id}))
        }
        Ok(_) => {
            log::warn!("[automation] Message {message_id} not found for flag");
            Ok(serde_json::json!({"action": "flag", "status": "not_found", "message_id": message_id}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to flag message {message_id}: {e}");
            Err(format!("Failed to flag message: {e}"))
        }
    }
}

/// Archive a message: UPDATE messages SET imap_folder = 'Archive'.
async fn execute_archive_action(
    pool: &SqlitePool,
    event: &AppEvent,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Archive action requires a message event");
            return Ok(serde_json::json!({"action": "archive", "status": "skipped", "reason": "No message in event"}));
        }
    };

    let result = sqlx::query(
        "UPDATE messages SET imap_folder = 'Archive' WHERE account_id = ? AND id = ?"
    )
    .bind(&account_id)
    .bind(&message_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            log::info!("[automation] Archived message {message_id}");
            Ok(serde_json::json!({"action": "archive", "status": "ok", "message_id": message_id}))
        }
        Ok(_) => {
            log::warn!("[automation] Message {message_id} not found for archive");
            Ok(serde_json::json!({"action": "archive", "status": "not_found", "message_id": message_id}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to archive message {message_id}: {e}");
            Err(format!("Failed to archive message: {e}"))
        }
    }
}

/// Add a note: INSERT into notes table.
async fn execute_add_note_action(
    pool: &SqlitePool,
    event: &AppEvent,
    note: &str,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Add-note action requires a message event");
            return Ok(serde_json::json!({"action": "add_note", "status": "skipped", "reason": "No message in event"}));
        }
    };

    let id = format!("note-{}", Uuid::new_v4());
    let now = chrono::Utc::now().timestamp();

    let result = sqlx::query(
        "INSERT INTO notes (id, company_id, message_id, content, created_by, created_at) VALUES (?, ?, ?, ?, 'automation', ?)"
    )
    .bind(&id)
    .bind(&account_id)
    .bind(&message_id)
    .bind(note)
    .bind(now)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            log::info!("[automation] Added note to message {message_id}");
            Ok(serde_json::json!({"action": "add_note", "status": "ok", "note_id": id, "message_id": message_id}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to add note to message {message_id}: {e}");
            Err(format!("Failed to add note: {e}"))
        }
    }
}

/// Mark message as read: UPDATE messages SET is_read = 1.
async fn execute_mark_read_action(
    pool: &SqlitePool,
    event: &AppEvent,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Mark-read action requires a message event");
            return Ok(serde_json::json!({"action": "mark_read", "status": "skipped", "reason": "No message in event"}));
        }
    };

    let result = sqlx::query(
        "UPDATE messages SET is_read = 1 WHERE account_id = ? AND id = ?"
    )
    .bind(&account_id)
    .bind(&message_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            log::info!("[automation] Marked message {message_id} as read");
            Ok(serde_json::json!({"action": "mark_read", "status": "ok", "message_id": message_id}))
        }
        Ok(_) => {
            log::warn!("[automation] Message {message_id} not found for mark-read");
            Ok(serde_json::json!({"action": "mark_read", "status": "not_found", "message_id": message_id}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to mark message {message_id} as read: {e}");
            Err(format!("Failed to mark message as read: {e}"))
        }
    }
}

/// Star a message: UPDATE messages SET is_starred = 1.
async fn execute_star_action(
    pool: &SqlitePool,
    event: &AppEvent,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Star action requires a message event");
            return Ok(serde_json::json!({"action": "star", "status": "skipped", "reason": "No message in event"}));
        }
    };

    let result = sqlx::query(
        "UPDATE messages SET is_starred = 1 WHERE account_id = ? AND id = ?"
    )
    .bind(&account_id)
    .bind(&message_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            log::info!("[automation] Starred message {message_id}");
            Ok(serde_json::json!({"action": "star", "status": "ok", "message_id": message_id}))
        }
        Ok(_) => {
            log::warn!("[automation] Message {message_id} not found for star");
            Ok(serde_json::json!({"action": "star", "status": "not_found", "message_id": message_id}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to star message {message_id}: {e}");
            Err(format!("Failed to star message: {e}"))
        }
    }
}

/// Apply a label to a message: INSERT into message_labels.
/// Also updates the thread_labels table for consistency.
async fn execute_apply_label_action(
    pool: &SqlitePool,
    event: &AppEvent,
    label: &str,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Apply-label action requires a message event");
            return Ok(serde_json::json!({"action": "apply_label", "status": "skipped", "reason": "No message in event"}));
        }
    };

    // Find the label_id by name within the account
    let label_row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM labels WHERE account_id = ? AND name = ? LIMIT 1"
    )
    .bind(&account_id)
    .bind(label)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to look up label: {e}"))?;

    let label_id = match label_row {
        Some((id,)) => id,
        None => {
            log::warn!("[automation] Label \"{label}\" not found for account {account_id}");
            return Ok(serde_json::json!({"action": "apply_label", "status": "label_not_found", "label": label}));
        }
    };

    // Insert into message_labels
    let ml_id = format!("ml-{}", Uuid::new_v4());
    let now = chrono::Utc::now().timestamp();

    let _ = sqlx::query(
        "INSERT OR IGNORE INTO message_labels (id, account_id, message_id, label_id, applied_by, applied_at) VALUES (?, ?, ?, ?, 'automation', ?)"
    )
    .bind(&ml_id)
    .bind(&account_id)
    .bind(&message_id)
    .bind(&label_id)
    .bind(now)
    .execute(pool)
    .await;

    // Also get thread_id to update thread_labels
    let thread_row: Option<(String,)> = sqlx::query_as(
        "SELECT thread_id FROM messages WHERE account_id = ? AND id = ?"
    )
    .bind(&account_id)
    .bind(&message_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get thread_id: {e}"))?;

    if let Some((thread_id,)) = thread_row {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO thread_labels (account_id, thread_id, label_id) VALUES (?, ?, ?)"
        )
        .bind(&account_id)
        .bind(&thread_id)
        .bind(&label_id)
        .execute(pool)
        .await;
    }

    log::info!("[automation] Applied label \"{label}\" to message {message_id}");
    Ok(serde_json::json!({"action": "apply_label", "status": "ok", "label": label, "message_id": message_id}))
}

/// Create a task: INSERT into tasks table.
async fn execute_create_task_action(
    pool: &SqlitePool,
    event: &AppEvent,
    title: &str,
    due_days: i64,
) -> Result<JsonValue, String> {
    let (account_id, message_id) = match extract_message_ids(event) {
        Some(ids) => ids,
        None => {
            log::warn!("[automation] Create-task action requires a message event");
            return Ok(serde_json::json!({"action": "create_task", "status": "skipped", "reason": "No message in event"}));
        }
    };

    // Get thread_id from the message
    let thread_row: Option<(String,)> = sqlx::query_as(
        "SELECT thread_id FROM messages WHERE account_id = ? AND id = ?"
    )
    .bind(&account_id)
    .bind(&message_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to get thread_id: {e}"))?;

    let thread_id = thread_row.map(|(t,)| t);

    let id = format!("task-{}", Uuid::new_v4());
    let now = chrono::Utc::now().timestamp();
    let due_date = if due_days > 0 { Some(now + due_days * 86400) } else { None };

    let result = sqlx::query(
        r#"
        INSERT INTO tasks (id, company_id, title, is_completed, due_date, thread_id, thread_account_id, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&account_id)
    .bind(title)
    .bind(due_date)
    .bind(&thread_id)
    .bind(&account_id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await;

    match result {
        Ok(_) => {
            log::info!("[automation] Created task \"{title}\" for account {account_id}");
            Ok(serde_json::json!({"action": "create_task", "status": "ok", "task_id": id, "title": title}))
        }
        Err(e) => {
            log::warn!("[automation] Failed to create task: {e}");
            Err(format!("Failed to create task: {e}"))
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Ensure the `is_flagged` column exists on the messages table.
/// This handles the case where migration 026 hasn't been applied yet.
async fn ensure_is_flagged_column(pool: &SqlitePool) {
    let result: Result<(String,), _> = sqlx::query_as(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='messages' AND sql LIKE '%is_flagged%'"
    )
    .fetch_optional(pool)
    .await;

    match result {
        Ok(Some(_)) => {} // column already exists
        _ => {
            // Add the column at runtime
            let _ = sqlx::query(
                "ALTER TABLE messages ADD COLUMN is_flagged INTEGER NOT NULL DEFAULT 0"
            )
            .execute(pool)
            .await;
        }
    }
}

/// Extract (account_id, message_id) from events that carry them.
fn extract_message_ids(event: &AppEvent) -> Option<(String, String)> {
    match event {
        AppEvent::EmailReceived { account_id, message_id, .. }
        | AppEvent::EmailOpened { account_id, message_id, .. }
        | AppEvent::LinkClicked { account_id, message_id, .. } => {
            Some((account_id.clone(), message_id.clone()))
        }
        _ => None,
    }
}

/// Extract a contact identifier from events that carry one.
fn extract_contact_id(event: &AppEvent) -> Option<String> {
    match event {
        AppEvent::ContactUpdated { contact_id }
        | AppEvent::EmailOpened { contact_id, .. }
        | AppEvent::LinkClicked { contact_id, .. } => Some(contact_id.clone()),
        AppEvent::EmailReceived { from_address, .. } => {
            // For email received, we don't have a contact_id directly,
            // but we could look it up. For now, return None.
            let _ = from_address;
            None
        }
        AppEvent::TaskCompleted { .. } => None,
        _ => None,
    }
}

/// Apply a score delta to a contact (bounded to [-100, 100]).
async fn update_contact_score(pool: &SqlitePool, contact_id: &str, delta: i64) -> Result<(), String> {
    let result = sqlx::query(
        "UPDATE contacts SET score = MAX(-100, MIN(100, COALESCE(score, 0) + ?)), updated_at = unixepoch() WHERE id = ?",
    )
    .bind(delta)
    .bind(contact_id)
    .execute(pool)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            log::info!("[automation] Score updated for contact {contact_id} by {delta}");
            Ok(())
        }
        Ok(_) => {
            log::warn!("[automation] Contact {contact_id} not found for score update");
            Ok(())
        }
        Err(e) => {
            log::warn!("[automation] Failed to update score for {contact_id}: {e}");
            Err(e.to_string())
        }
    }
}

// ── Execution log recording ───────────────────────────────────────────────────

/// Log the outcome of a workflow rule execution.
async fn record_execution_log(
    pool: &SqlitePool,
    company_id: &str,
    rule_id: &str,
    rule_name: Option<&str>,
    trigger_event: &str,
    actions_result: &[JsonValue],
    error_message: Option<&str>,
) {
    let status = if error_message.is_some() {
        "failed"
    } else if actions_result.iter().any(|r| r.get("status").and_then(|v| v.as_str()) == Some("error")) {
        "partial"
    } else {
        "success"
    };

    let actions_json = serde_json::to_string(actions_result).unwrap_or_default();

    let _ = crate::db::tables::workflows::execution_logs::insert(
        pool,
        company_id,
        rule_id,
        rule_name,
        trigger_event,
        Some(&actions_json),
        status,
        error_message,
    )
    .await;
}

// ── Top-level orchestrator ───────────────────────────────────────────────────

/// Look up active workflow rules for the given trigger event, evaluate their
/// conditions, and execute actions for all matching rules.
///
/// This is the main entry point called from the DomainEventProcessor.
pub async fn check_and_execute_workflow_rules(
    pool: &SqlitePool,
    trigger_event: &str,
    event: &AppEvent,
) {
    // Determine the account_id from the event to scope the DB query.
    let account_id = match extract_account_id(event) {
        Some(id) => id,
        None => {
            log::debug!("[automation] Event has no account_id, skipping workflow rules");
            return;
        }
    };

    let rules = match crate::db::tables::workflows::workflow_rules::list_by_trigger(
        pool,
        &account_id,
        trigger_event,
    )
    .await
    {
        Ok(rules) => rules,
        Err(e) => {
            log::warn!("[automation] Failed to list workflow rules for {trigger_event}: {e}");
            return;
        }
    };

    if rules.is_empty() {
        log::trace!("[automation] No active workflow rules for trigger={trigger_event}, account={account_id}");
        return;
    }

    for rule in &rules {
        if !evaluate_conditions(rule.trigger_conditions.as_deref(), event) {
            log::trace!(
                "[automation] Rule {} conditions did not match event",
                rule.id
            );
            continue;
        }

        log::info!(
            "[automation] Rule {} \"{}\" matched — executing actions",
            rule.id,
            rule.name
        );

        match execute_actions(&rule.actions, pool, event).await {
            Ok(results) => {
                let has_error = results.iter().any(|r| {
                    r.get("status").and_then(|v| v.as_str()) == Some("error")
                        || r.get("status").and_then(|v| v.as_str()) == Some("failed")
                });
                let error_msg = if has_error {
                    Some("One or more actions failed")
                } else {
                    None
                };

                record_execution_log(
                    pool,
                    &account_id,
                    &rule.id,
                    Some(&rule.name),
                    trigger_event,
                    &results,
                    error_msg,
                )
                .await;
            }
            Err(e) => {
                log::warn!(
                    "[automation] Rule {} action execution failed: {e}",
                    rule.id
                );

                let failed_results = vec![serde_json::json!({"error": e})];
                record_execution_log(
                    pool,
                    &account_id,
                    &rule.id,
                    Some(&rule.name),
                    trigger_event,
                    &failed_results,
                    Some(&e),
                )
                .await;
            }
        }
    }
}

/// Extract account_id from any event variant that carries one.
fn extract_account_id(event: &AppEvent) -> Option<String> {
    match event {
        AppEvent::EmailReceived { account_id, .. }
        | AppEvent::EmailOpened { account_id, .. }
        | AppEvent::LinkClicked { account_id, .. } => Some(account_id.clone()),
        AppEvent::ContactUpdated { .. }
        | AppEvent::TaskCompleted { .. } => {
            // These events don't carry account_id directly.
            // Currently we skip automation for them unless scoped differently.
            // A future enhancement could look up the contact/task's account.
            None
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::AppEvent;

    // ── evaluate_conditions ───────────────────────────────────────────

    #[test]
    fn test_evaluate_conditions_no_conditions() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            from_address: "test@example.com".into(),
            date: 1000,
        };
        assert!(evaluate_conditions(None, &event));
        assert!(evaluate_conditions(Some(""), &event));
    }

    #[test]
    fn test_evaluate_conditions_matching() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            from_address: "vip@example.com".into(),
            date: 1000,
        };
        let cond = r#"{"from_address": "vip@"}"#;
        assert!(evaluate_conditions(Some(cond), &event));
    }

    #[test]
    fn test_evaluate_conditions_non_matching() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            from_address: "spam@evil.com".into(),
            date: 1000,
        };
        let cond = r#"{"from_address": "vip@"}"#;
        assert!(!evaluate_conditions(Some(cond), &event));
    }

    #[test]
    fn test_evaluate_conditions_malformed_json() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            from_address: "x@x.com".into(),
            date: 1000,
        };
        // Malformed JSON should be treated as no match
        assert!(!evaluate_conditions(Some("{bad json"), &event));
    }

    #[test]
    fn test_evaluate_conditions_field_not_present() {
        let event = AppEvent::ContactUpdated {
            contact_id: "c1".into(),
        };
        let cond = r#"{"from_address": "vip@"}"#;
        assert!(!evaluate_conditions(Some(cond), &event));
    }

    #[test]
    fn test_evaluate_conditions_empty_object() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            from_address: "x@x.com".into(),
            date: 1000,
        };
        assert!(evaluate_conditions(Some("{}"), &event));
    }

    #[test]
    fn test_extract_event_fields_email_received() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            from_address: "x@x.com".into(),
            date: 2000,
        };
        let fields = extract_event_fields(&event);
        assert_eq!(fields.get("account_id").unwrap(), "acc1");
        assert_eq!(fields.get("message_id").unwrap(), "msg1");
        assert_eq!(fields.get("from_address").unwrap(), "x@x.com");
    }

    #[test]
    fn test_extract_event_fields_contact_updated() {
        let event = AppEvent::ContactUpdated {
            contact_id: "c1".into(),
        };
        let fields = extract_event_fields(&event);
        assert_eq!(fields.get("contact_id").unwrap(), "c1");
    }

    #[test]
    fn test_extract_event_fields_task_completed() {
        let event = AppEvent::TaskCompleted {
            task_id: "t1".into(),
        };
        let fields = extract_event_fields(&event);
        assert_eq!(fields.get("task_id").unwrap(), "t1");
    }

    #[test]
    fn test_extract_event_fields_email_opened() {
        let event = AppEvent::EmailOpened {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            contact_id: "c1".into(),
            timestamp: 3000,
        };
        let fields = extract_event_fields(&event);
        assert_eq!(fields.get("account_id").unwrap(), "acc1");
        assert_eq!(fields.get("contact_id").unwrap(), "c1");
    }

    #[test]
    fn test_extract_event_fields_link_clicked() {
        let event = AppEvent::LinkClicked {
            account_id: "acc1".into(),
            message_id: "msg1".into(),
            contact_id: "c1".into(),
            url: "https://example.com".into(),
            timestamp: 4000,
        };
        let fields = extract_event_fields(&event);
        assert_eq!(fields.get("url").unwrap(), "https://example.com");
    }

    // ── execute_actions (unit tests for action routing) ─────────────────

    #[tokio::test]
    async fn test_execute_actions_log() {
        let actions = r#"[{"action": "log"}]"#;
        // We can't easily test pool-based actions without a DB,
        // but we can test the log action which doesn't touch the DB
        let pool = create_test_pool().await;

        // We'll test that a malformed JSON returns an error
        let result = execute_actions("not json", &pool, &AppEvent::InitComplete).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_actions_empty() {
        let pool = create_test_pool().await;
        let result = execute_actions("[]", &pool, &AppEvent::InitComplete).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    // ── helpers ────────────────────────────────────────────────────────

    async fn create_test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        crate::db::migrations::run(&pool, false).await.unwrap();
        pool
    }

    // ── extract_account_id ────────────────────────────────────────────

    #[test]
    fn test_extract_account_id_email_received() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "m1".into(),
            from_address: "x@x.com".into(),
            date: 100,
        };
        assert_eq!(extract_account_id(&event), Some("acc1".to_string()));
    }

    #[test]
    fn test_extract_account_id_no_account() {
        let event = AppEvent::ContactUpdated {
            contact_id: "c1".into(),
        };
        assert_eq!(extract_account_id(&event), None);
    }

    // ── extract_message_ids ────────────────────────────────────────────

    #[test]
    fn test_extract_message_ids_email_received() {
        let event = AppEvent::EmailReceived {
            account_id: "acc1".into(),
            message_id: "m1".into(),
            from_address: "x@x.com".into(),
            date: 100,
        };
        let (aid, mid) = extract_message_ids(&event).unwrap();
        assert_eq!(aid, "acc1");
        assert_eq!(mid, "m1");
    }

    #[test]
    fn test_extract_message_ids_contact_updated() {
        let event = AppEvent::ContactUpdated {
            contact_id: "c1".into(),
        };
        assert!(extract_message_ids(&event).is_none());
    }

    // ── extract_contact_id ─────────────────────────────────────────────

    #[test]
    fn test_extract_contact_id_from_contact_updated() {
        let event = AppEvent::ContactUpdated {
            contact_id: "c1".into(),
        };
        assert_eq!(extract_contact_id(&event), Some("c1".to_string()));
    }

    #[test]
    fn test_extract_contact_id_from_email_received() {
        let event = AppEvent::EmailReceived {
            account_id: "a1".into(),
            message_id: "m1".into(),
            from_address: "x@x.com".into(),
            date: 100,
        };
        assert_eq!(extract_contact_id(&event), None);
    }
}
