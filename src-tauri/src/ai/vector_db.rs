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

    pub async fn ensure_table(&self) -> Result<Table> {
        let table_name = "knowledge_base";
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("text", DataType::Utf8, false),
            Field::new("vector", DataType::FixedSizeList(
                Arc::new(Field::new("item", DataType::Float32, true)),
                384 // BGE-Small dimension
            ), false),
        ]));

        match self.conn.open_table(table_name).execute().await {
            Ok(table) => Ok(table),
            Err(_) => {
                let table = self.conn.create_empty_table(table_name, schema).execute().await?;
                Ok(table)
            }
        }
    }

    /// Drop and recreate the knowledge base table, clearing all indexed vectors.
    /// Safe to call when the table does not yet exist.
    pub async fn reset(&self) -> Result<()> {
        match self.conn.drop_table("knowledge_base").await {
            Ok(_) => log::info!("[vector_db] knowledge base table dropped"),
            Err(e) => log::warn!("[vector_db] reset (drop_table) returned: {e}"),
        }
        Ok(())
    }
}
