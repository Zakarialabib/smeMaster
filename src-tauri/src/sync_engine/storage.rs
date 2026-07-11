// ── Sync Storage — SQLite Persistence ──────────────────────────────────────
//
// Provides CRUD operations for sync_documents stored in SQLite.
// Documents are stored as serialised automerge blobs with metadata.

use anyhow::{Context, Result};
use sqlx::SqlitePool;

use super::document::SyncDocument;

/// SQLite-backed storage for CRDT sync documents.
pub struct SyncStorage {
    pool: SqlitePool,
}

impl SyncStorage {
    /// Create a new `SyncStorage` bound to the given SQLite pool.
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Load a single document by its ID.
    ///
    /// Returns `Ok(None)` if the document does not exist.
    pub async fn load_document(&self, doc_id: &str) -> Result<Option<SyncDocument>> {
        let row = sqlx::query_as::<_, DocumentRow>(
            "SELECT doc_id, doc_bytes, last_modified, version_counter FROM sync_documents WHERE doc_id = ?",
        )
        .bind(doc_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to query sync_documents")?;

        match row {
            Some(row) => {
                let doc = SyncDocument::load(&row.doc_id, &row.doc_bytes)
                    .context("Failed to deserialize sync document")?;
                Ok(Some(doc))
            }
            None => Ok(None),
        }
    }

    /// Upsert a document into the database.
    ///
    /// If the document already exists (same doc_id), it is replaced.
    pub async fn save_document(&self, doc: &mut SyncDocument) -> Result<()> {
        let bytes = doc.save();
        let now = chrono::Utc::now().timestamp_millis();

        sqlx::query(
            "INSERT INTO sync_documents (doc_id, doc_bytes, last_modified, last_synced_at, version_counter)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(doc_id) DO UPDATE SET
               doc_bytes = excluded.doc_bytes,
               last_modified = excluded.last_modified,
               last_synced_at = excluded.last_synced_at,
               version_counter = excluded.version_counter",
        )
        .bind(doc.doc_id())
        .bind(&bytes)
        .bind(now)
        .bind(now)
        .bind(doc.version() as i64)
        .execute(&self.pool)
        .await
        .context("Failed to upsert sync document")?;

        Ok(())
    }

    /// List all document IDs currently stored.
    pub async fn list_documents(&self) -> Result<Vec<String>> {
        let rows: Vec<String> = sqlx::query_scalar("SELECT doc_id FROM sync_documents ORDER BY doc_id")
            .fetch_all(&self.pool)
            .await
            .context("Failed to list sync documents")?;
        Ok(rows)
    }

    /// Delete a document by its ID.
    pub async fn delete_document(&self, doc_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM sync_documents WHERE doc_id = ?")
            .bind(doc_id)
            .execute(&self.pool)
            .await
            .context("Failed to delete sync document")?;
        Ok(())
    }
}

/// Raw row returned from the sync_documents table.
#[derive(sqlx::FromRow)]
struct DocumentRow {
    doc_id: String,
    doc_bytes: Vec<u8>,
    #[allow(dead_code)]
    last_modified: i64,
    #[allow(dead_code)]
    version_counter: i64,
}