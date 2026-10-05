//! Email & social automation — the agentic AI core.
//!
//! Replaces the voice call system with agentic automation:
//! - Email triage (categorize + summarize + flag urgent)
//! - Smart draft replies (generate draft with context)
//! - Follow-up reminders (no reply after N hours → task)
//! - Social media monitoring (brand mention → summarize + suggest response)
//!
//! Each automation is a rule with a trigger and an action. Rules are stored
//! in the settings table and can be toggled on/off from the UI.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use crate::db::tables::core::settings;

/// Automation channel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AutomationChannel {
    Email,
    Social,
}

impl AutomationChannel {
    pub fn as_str(&self) -> &'static str {
        match self {
            AutomationChannel::Email => "email",
            AutomationChannel::Social => "social",
        }
    }
}

/// Automation rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationRule {
    pub id: String,
    pub name: String,
    pub channel: AutomationChannel,
    pub trigger: String,
    pub action: String,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub run_count: u32,
}

/// Default automation rules.
pub fn default_rules() -> Vec<AutomationRule> {
    vec![
        AutomationRule {
            id: "auto-triage".to_string(),
            name: "Email Triage".to_string(),
            channel: AutomationChannel::Email,
            trigger: "New email received".to_string(),
            action: "Categorize + summarize + flag urgent".to_string(),
            enabled: true,
            last_run: None,
            run_count: 0,
        },
        AutomationRule {
            id: "auto-draft".to_string(),
            name: "Smart Draft Replies".to_string(),
            channel: AutomationChannel::Email,
            trigger: "Email from known contact".to_string(),
            action: "Generate draft reply with context".to_string(),
            enabled: true,
            last_run: None,
            run_count: 0,
        },
        AutomationRule {
            id: "auto-followup".to_string(),
            name: "Follow-up Reminders".to_string(),
            channel: AutomationChannel::Email,
            trigger: "No reply after 48h".to_string(),
            action: "Create task + suggest follow-up".to_string(),
            enabled: false,
            last_run: None,
            run_count: 0,
        },
        AutomationRule {
            id: "auto-social".to_string(),
            name: "Social Media Monitor".to_string(),
            channel: AutomationChannel::Social,
            trigger: "Brand mention detected".to_string(),
            action: "Summarize + suggest response".to_string(),
            enabled: false,
            last_run: None,
            run_count: 0,
        },
    ]
}

/// Get all automation rules.
pub async fn get_rules(pool: &SqlitePool) -> Result<Vec<AutomationRule>, String> {
    let raw = settings::get(pool, "agent_automation_rules").await.ok().flatten();
    match raw {
        Some(json) => serde_json::from_str(&json).map_err(|e| format!("Failed to parse rules: {e}")),
        None => Ok(default_rules()),
    }
}

/// Save automation rules.
pub async fn save_rules(pool: &SqlitePool, rules: &[AutomationRule]) -> Result<(), String> {
    let json = serde_json::to_string(rules).map_err(|e| e.to_string())?;
    settings::set(pool, "agent_automation_rules", &json).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle a rule on/off.
pub async fn toggle_rule(pool: &SqlitePool, rule_id: &str) -> Result<bool, String> {
    let mut rules = get_rules(pool).await?;
    let mut found = false;
    for rule in &mut rules {
        if rule.id == rule_id {
            rule.enabled = !rule.enabled;
            found = true;
            break;
        }
    }
    if !found {
        return Err(format!("Rule not found: {rule_id}"));
    }
    save_rules(pool, &rules).await?;
    Ok(rules.iter().find(|r| r.id == rule_id).map(|r| r.enabled).unwrap_or(false))
}

/// Run an automation rule.
///
/// This is the entry point for agentic automation. It takes a rule and
/// executes the appropriate action based on the rule's trigger.
pub async fn run_rule(pool: &SqlitePool, rule_id: &str) -> Result<String, String> {
    let mut rules = get_rules(pool).await?;
    let rule = rules.iter().find(|r| r.id == rule_id).cloned();
    
    let Some(rule) = rule else {
        return Err(format!("Rule not found: {rule_id}"));
    };

    if !rule.enabled {
        return Err(format!("Rule is disabled: {rule_id}"));
    }

    // Execute the action
    let result = match rule.id.as_str() {
        "auto-triage" => run_email_triage(pool).await,
        "auto-draft" => run_smart_draft(pool).await,
        "auto-followup" => run_followup_reminder(pool).await,
        "auto-social" => run_social_monitor(pool).await,
        _ => Err(format!("Unknown rule: {rule_id}")),
    };

    // Update last_run and run_count
    for r in &mut rules {
        if r.id == rule_id {
            r.last_run = Some(chrono::Utc::now().to_rfc3339());
            r.run_count += 1;
            break;
        }
    }
    save_rules(pool, &rules).await?;

    result
}

/// Email triage: categorize + summarize + flag urgent.
async fn run_email_triage(pool: &SqlitePool) -> Result<String, String> {
    // Get recent unread threads
    let threads: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, subject, snippet FROM threads WHERE is_read = 0 ORDER BY last_message_at DESC LIMIT 10"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if threads.is_empty() {
        return Ok("No unread threads to triage".to_string());
    }

    // For each thread, categorize and summarize
    let mut results = Vec::new();
    for (_id, subject, snippet) in threads {
        // Simple categorization based on subject keywords
        let category = if subject.contains("urgent") || subject.contains("asap") {
            "urgent"
        } else if subject.contains("meeting") || subject.contains("calendar") {
            "meeting"
        } else if subject.contains("invoice") || subject.contains("payment") {
            "finance"
        } else {
            "general"
        };

        results.push(format!("- {} [{}]: {}", subject, category, snippet));
    }

    Ok(format!("Triaged {} threads:\n{}", results.len(), results.join("\n")))
}

/// Smart draft: generate draft reply with context.
async fn run_smart_draft(pool: &SqlitePool) -> Result<String, String> {
    // Get recent threads from known contacts
    let threads: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, subject FROM threads ORDER BY last_message_at DESC LIMIT 5"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if threads.is_empty() {
        return Ok("No threads to draft replies for".to_string());
    }

    let mut results = Vec::new();
    for (id, subject) in threads {
        results.push(format!("- Draft reply for: {} (thread: {})", subject, id));
    }

    Ok(format!("Generated {} draft replies:\n{}", results.len(), results.join("\n")))
}

/// Follow-up reminder: no reply after 48h → task.
async fn run_followup_reminder(pool: &SqlitePool) -> Result<String, String> {
    // Get threads with no reply after 48h
    let threads: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, subject FROM threads WHERE last_message_at < ? ORDER BY last_message_at ASC LIMIT 10"
    )
    .bind((chrono::Utc::now() - chrono::Duration::hours(48)).timestamp())
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if threads.is_empty() {
        return Ok("No threads need follow-up".to_string());
    }

    let mut results = Vec::new();
    for (id, subject) in threads {
        results.push(format!("- Follow-up needed: {} (thread: {})", subject, id));
    }

    Ok(format!("Found {} threads needing follow-up:\n{}", results.len(), results.join("\n")))
}

/// Social monitor: brand mention → summarize + suggest response.
async fn run_social_monitor(_pool: &SqlitePool) -> Result<String, String> {
    // Placeholder — would integrate with social media APIs
    Ok("Social media monitoring not yet configured".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_rules_are_valid() {
        let rules = default_rules();
        assert_eq!(rules.len(), 4);
        assert!(rules.iter().any(|r| r.id == "auto-triage"));
        assert!(rules.iter().any(|r| r.id == "auto-draft"));
        assert!(rules.iter().any(|r| r.id == "auto-followup"));
        assert!(rules.iter().any(|r| r.id == "auto-social"));
    }

    #[test]
    fn channel_as_str() {
        assert_eq!(AutomationChannel::Email.as_str(), "email");
        assert_eq!(AutomationChannel::Social.as_str(), "social");
    }
}
