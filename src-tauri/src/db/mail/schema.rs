use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ─── Core ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Label {
    pub account_id: String,
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub label_type: String, // 'type' is a Rust keyword
    pub color_bg: Option<String>,
    pub color_fg: Option<String>,
    pub visible: i64,
    pub sort_order: i64,
    pub imap_folder_path: Option<String>,
    pub imap_special_use: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Thread {
    pub account_id: String,
    pub id: String,
    pub subject: Option<String>,
    pub snippet: Option<String>,
    pub last_message_at: Option<i64>,
    pub message_count: i64,
    pub is_read: i64,
    pub is_starred: i64,
    pub is_important: i64,
    pub has_attachments: i64,
    pub is_snoozed: i64,
    pub snooze_until: Option<i64>,
    pub is_pinned: i64,
    pub is_muted: i64,
    pub metadata_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub account_id: String,
    pub id: String,
    pub thread_id: String,
    pub from_address: Option<String>,
    pub from_name: Option<String>,
    pub to_addresses: Option<String>,
    pub cc_addresses: Option<String>,
    pub bcc_addresses: Option<String>,
    pub reply_to: Option<String>,
    pub subject: Option<String>,
    pub snippet: Option<String>,
    pub date: i64,
    pub is_read: i64,
    pub is_starred: i64,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub body_cached: i64,
    pub raw_size: Option<i64>,
    pub internal_date: Option<i64>,
    pub list_unsubscribe: Option<String>,
    pub list_unsubscribe_post: Option<String>,
    pub auth_results: Option<String>,
    pub message_id_header: Option<String>,
    pub references_header: Option<String>,
    pub in_reply_to_header: Option<String>,
    pub imap_uid: Option<i64>,
    pub imap_folder: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Attachment {
    pub id: String,
    pub message_id: String,
    pub account_id: String,
    pub filename: Option<String>,
    pub mime_type: Option<String>,
    pub size: Option<i64>,
    pub gmail_attachment_id: Option<String>,
    pub content_id: Option<String>,
    pub is_inline: i64,
    pub local_path: Option<String>,
    pub cached_at: Option<i64>,
    pub cache_size: Option<i64>,
    pub imap_part_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FolderSyncState {
    pub account_id: String,
    pub folder_path: String,
    pub uidvalidity: Option<i64>,
    pub last_uid: i64,
    pub modseq: Option<i64>,
    pub last_sync_at: Option<i64>,
    pub sync_phase: String,
    pub last_error: Option<String>,
    pub retry_count: i64,
    pub is_paused: i64,
}

/// One row per migration / backfill run (report.md §6.2).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SyncJob {
    pub id: String,
    pub account_id: String,
    pub phase: String,
    pub status: String,
    pub total_folders: i64,
    pub done_folders: i64,
    pub estimated_messages: Option<i64>,
    pub synced_messages: i64,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub created_at: i64,
}

/// Audit log of source-vs-local divergences during import (report.md §6.3).
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SyncConflict {
    pub id: String,
    pub account_id: String,
    pub folder_path: String,
    pub conflict_type: String,
    pub message_id_header: Option<String>,
    pub source_value: Option<String>,
    pub local_value: Option<String>,
    pub resolved: String,
    pub created_at: i64,
}

// ─── Comms ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FilterRule {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub is_enabled: i64,
    pub criteria_json: String,
    pub actions_json: String,
    pub group_operator: String,
    pub score_threshold: Option<f64>,
    pub chaining_action: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FilterLog {
    pub id: String,
    pub rule_id: String,
    pub message_id: String,
    pub matched: i64,
    pub score: f64,
    pub applied_actions: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SmartFolder {
    pub id: String,
    pub account_id: Option<String>,
    pub name: String,
    pub query: String,
    pub icon: String,
    pub color: Option<String>,
    pub sort_order: i64,
    pub is_default: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QuickStep {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub description: Option<String>,
    pub shortcut: Option<String>,
    pub actions_json: String,
    pub icon: Option<String>,
    pub is_enabled: i64,
    pub continue_on_error: i64,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QuickReply {
    pub id: String,
    pub account_id: String,
    pub title: String,
    pub body_html: String,
    pub shortcut: Option<String>,
    pub sort_order: i64,
    pub usage_count: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Template {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub subject: Option<String>,
    pub body_html: String,
    pub shortcut: Option<String>,
    pub sort_order: i64,
    pub category_id: Option<String>,
    pub is_favorite: i64,
    pub usage_count: i64,
    pub last_used_at: Option<i64>,
    pub conditional_blocks_json: Option<String>,
    pub template_type: String,
    pub origin: String,
    pub delivery_config_json: Option<String>,
    pub ai_config_json: Option<String>,
    pub voice_config_json: Option<String>,
    pub compliance_profile_id: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Signature {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub body_html: String,
    pub is_default: i64,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SendAsAlias {
    pub id: String,
    pub account_id: String,
    pub email: String,
    pub display_name: Option<String>,
    pub reply_to_address: Option<String>,
    pub signature_id: Option<String>,
    pub is_primary: i64,
    pub is_default: i64,
    pub treat_as_alias: i64,
    pub verification_status: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScheduledEmail {
    pub id: String,
    pub account_id: String,
    pub to_addresses: String,
    pub cc_addresses: Option<String>,
    pub bcc_addresses: Option<String>,
    pub subject: Option<String>,
    pub body_html: String,
    pub reply_to_message_id: Option<String>,
    pub thread_id: Option<String>,
    pub scheduled_at: i64,
    pub signature_id: Option<String>,
    pub attachment_paths: Option<String>,
    pub status: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LocalDraft {
    pub id: String,
    pub account_id: String,
    pub to_addresses: Option<String>,
    pub cc_addresses: Option<String>,
    pub bcc_addresses: Option<String>,
    pub subject: Option<String>,
    pub body_html: Option<String>,
    pub reply_to_message_id: Option<String>,
    pub thread_id: Option<String>,
    pub from_email: Option<String>,
    pub signature_id: Option<String>,
    pub remote_draft_id: Option<String>,
    pub attachments: Option<String>,
    pub sync_status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ComposerPreset {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub default_reply_mode: String,
    pub send_and_archive: i64,
    pub undo_send_delay: i64,
    pub font_family: String,
    pub font_size: i64,
    pub is_default: i64,
    pub created_at: i64,
}
