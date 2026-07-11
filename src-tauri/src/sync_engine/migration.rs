// ── Migration: JSON Sync Log → CRDT Documents ───────────────────────────
//
// One-time migration that reads the existing `sync_log.json` file and converts
// its entries into automerge operations stored in the `sync_documents` table.
// After successful migration, the old file is archived to `sync_log.json.migrated`.

use anyhow::{Context, Result};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri::Manager;

use super::document::SyncDocument;
use super::storage::SyncStorage;

/// Run the one-time migration from JSON sync log to CRDT documents.
///
/// This checks if `sync_log.json` exists AND the `sync_documents` table is
/// empty before proceeding. It is designed to be called once at startup.
pub async fn migrate_from_json_log(app: &AppHandle, pool: &SqlitePool) -> Result<()> {
    let base_dir = app
        .path()
        .app_data_dir()
        .context("Failed to get app data directory")?;

    let sync_log_path = base_dir.join("sync_log.json");
    if !sync_log_path.exists() {
        log::info!("[sync-migration] No sync_log.json found, skipping migration");
        return Ok(());
    }

    let storage = SyncStorage::new(pool.clone());
    let existing_docs = storage.list_documents().await?;
    if !existing_docs.is_empty() {
        log::info!(
            "[sync-migration] sync_documents table already has {} docs, skipping migration",
            existing_docs.len()
        );
        return Ok(());
    }

    log::info!("[sync-migration] Reading existing sync_log.json...");
    let json_data = tokio::fs::read_to_string(&sync_log_path)
        .await
        .context("Failed to read sync_log.json")?;

    let sync_log: serde_json::Value = serde_json::from_str(&json_data)
        .context("Failed to parse sync_log.json")?;

    // Create a contacts document and populate it from the sync log
    let mut contacts_doc = SyncDocument::new("contacts");

    if let Some(changes) = sync_log.get("changes").and_then(|c| c.as_array()) {
        for change in changes {
            let kind = change
                .get("kind")
                .and_then(|k| k.as_str())
                .unwrap_or("unknown");

            match kind {
                "ContactAdded" | "ContactUpdated" => {
                    if let Some(contact_id) = change.get("payload").and_then(|p| p.as_str()) {
                        let meta = serde_json::json!({
                            "source": "migration",
                            "timestamp": change.get("timestamp"),
                            "kind": kind,
                        });
                        contacts_doc.set(
                            &format!("contact:{}", contact_id),
                            serde_json::to_string(&meta).unwrap_or_default(),
                        );
                    }
                }
                _ => {
                    // Other change types are not yet mapped to CRDT documents
                }
            }
        }
    }

    // Save the migrated document
    storage.save_document(&mut contacts_doc).await?;
    log::info!(
        "[sync-migration] Migrated {} changes to contacts CRDT document (version {})",
        contacts_doc.version(),
        contacts_doc.version()
    );

    // Archive the old sync_log.json
    let archived_path = base_dir.join("sync_log.json.migrated");
    tokio::fs::rename(&sync_log_path, &archived_path)
        .await
        .context("Failed to archive sync_log.json")?;

    log::info!("[sync-migration] sync_log.json archived to sync_log.json.migrated");
    Ok(())
}