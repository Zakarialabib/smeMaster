use anyhow::Result;
use lancedb::connect;
use lancedb::connection::Connection;
use lancedb::table::Table;
use tauri::AppHandle;
use tauri::Manager;
use arrow::datatypes::{Field, Schema, DataType};
use std::sync::Arc;

pub struct VectorDb {
    conn: Connection,
}

impl VectorDb {
    pub async fn new(app_handle: &AppHandle) -> Result<Self> {
        let db_path = app_handle.path().app_data_dir()?.join("knowledge_base.lance");
        std::fs::create_dir_all(&db_path)?;

        // Pass the raw Windows path string to lancedb::connect().
        //
        // Using a file:/// URL causes `url.path()` to return `/C:/Users/...`
        // which `path_abs::PathAbs` on Windows mangles into `C:Users\...`
        // (dropping the separator after the drive letter), and then
        // `object_store::Path::from_absolute_path` fails with
        //   "Unable to convert path ... to URL"
        //
        // With a raw path like `C:\Users\dell\...`, `Url::parse` fails
        // (backslash is invalid in non-file URLs) and lance falls back to
        // `from_path()` → `path_abs::PathAbs::new(raw_path)` which handles
        // Windows paths correctly.
        let uri = db_path.to_string_lossy().to_string();

        log::info!("[vector_db] Opening LanceDB at {}", uri);
        let conn = connect(&uri).execute().await?;
        Ok(Self { conn })
    }

    /// Table name for a given embedding dimension.
    ///
    /// Each embedding model gets its own table so different providers
    /// (BGE-small = 384, LM Studio / Ollama = 768 / 1536, …)
    /// never collide on vector width.
    pub fn table_name(dim: usize) -> String {
        format!("knowledge_base_{dim}")
    }

    /// Get or create the table for the given embedding dimension.
    pub async fn ensure_table(&self, dim: usize) -> Result<Table> {
        let table_name = Self::table_name(dim);
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("text", DataType::Utf8, false),
            Field::new("vector", DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float32, true)),
                dim as i32
            ), false),
        ]));

        match self.conn.open_table(&table_name).execute().await {
            Ok(table) => Ok(table),
            Err(_) => {
                let table = self.conn.create_empty_table(&table_name, schema).execute().await?;
                Ok(table)
            }
        }
    }

    /// Backwards-compatible helper: the default local knowledge base is BGE-small (384).
    pub async fn ensure_default_table(&self) -> Result<Table> {
        self.ensure_table(384).await
    }

    /// Drop every knowledge-base table (all dimensions) and clear all indexed vectors.
    pub async fn reset(&self) -> Result<()> {
        match self.conn.table_names().execute().await {
            Ok(names) => {
                for name in names {
                    if name.starts_with("knowledge_base_") {
                        if let Err(e) = self.conn.drop_table(&name).await {
                            log::warn!("[vector_db] failed to drop {}: {e}", name);
                        }
                    }
                }
            }
            Err(e) => log::warn!("[vector_db] reset (table_names) returned: {e}"),
        }
        Ok(())
    }
}
