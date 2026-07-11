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
//
// Unrecognised actions are silently skipped — the engine is extensible by
// adding new action variants below.

use serde_json::Value as JsonValue;
use sqlx::SqlitePool;
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
///
/// ## Example
/// ```ignore
/// // Condition JSON        → matches EmailReceived where
/// { "from_address": "@newsletter.com" }  → from_address contains "@newsletter.com"
/// ```
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
/// Each action is an object with at least an `"action"` string field. Supported:
/// - `"log"` — log a message
/// - `"tag"` — tag the entity (requires `"tag"` field)
/// - `"flag"` — flag the entity
/// - `"notify"` — emit a notification event
/// - `"archive"` — archive the message (future: move to Archive folder)
/// - `"add_note"` — add an internal note (requires `"note"` field)
/// - `"score"` — update contact score (requires `"score_delta"` field, integer)
///
/// Unknown actions are logged and skipped — the engine is forward-compatible.
pub async fn execute_actions(
    actions_json: &str,
    pool: &SqlitePool,
    event: &AppEvent,
) -> Result<(), String> {
    let actions: Vec<JsonValue> = match serde_json::from_str(actions_json) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[automation] Malformed actions JSON: {e}");
            return Err(format!("Malformed actions JSON: {e}"));
        }
    };

    for action_obj in &actions {
        let action_name = action_obj
            .get("action")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        match action_name {
            "log" => {
                log::info!(
                    "[automation] Rule matched — event={:?}, action=log",
                    std::mem::discriminant(event)
                );
            }
            "tag" => {
                let tag = action_obj
                    .get("tag")
                    .and_then(|v| v.as_str())
                    .unwrap_or("auto-tag");
                log::info!("[automation] Tag action: tag={tag}, event={:?}", std::mem::discriminant(event));
                // Future: persist tag via db::contacts or db::mail
            }
            "flag" => {
                log::info!("[automation] Flag action — event={:?}", std::mem::discriminant(event));
                // Future: update message flags
            }
            "notify" => {
                let message = action_obj
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Workflow rule triggered");
                log::info!("[automation] Notify action: {message}");
                // Future: emit a frontend notification event
            }
            "archive" => {
                log::info!("[automation] Archive action — event={:?}", std::mem::discriminant(event));
                // Future: move message to Archive folder via IMAP
            }
            "add_note" => {
                let note = action_obj
                    .get("note")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                log::info!("[automation] Add-note action: note=\"{note}\"");
                // Future: insert note into db
            }
            "score" => {
                let delta = action_obj
                    .get("score_delta")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if delta != 0 {
                    if let Some(contact_id) = extract_contact_id(event) {
                        log::info!("[automation] Score action: contact={contact_id}, delta={delta}");
                        let _ = update_contact_score(pool, &contact_id, delta).await;
                    } else {
                        log::warn!("[automation] Score action requires a contact_id in the event");
                    }
                }
            }
            other => {
                log::debug!("[automation] Unknown action type: {other} — skipped");
            }
        }
    }

    Ok(())
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
            // (the scoring action on inbound email is a future enhancement)
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

        if let Err(e) = execute_actions(&rule.actions, pool, event).await {
            log::warn!(
                "[automation] Rule {} action execution failed: {e}",
                rule.id
            );
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
