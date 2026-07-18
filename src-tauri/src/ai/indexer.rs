use anyhow::Result;
use sqlx::SqlitePool;
use std::path::Path;
use crate::ai::local_engine::LocalEngine;
use crate::ai::vector_db::VectorDb;
use crate::ai::parser::DocParser;
use crate::db::mail::schema::{Message, Attachment};
use crate::db::vault::schema::VaultItem;
use crate::db::tables::core::settings;
use std::sync::Arc;
use arrow::array::{RecordBatch, StringArray, FixedSizeListArray, Float32Array, RecordBatchIterator};
use arrow::datatypes::DataType;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

/// Text-splitting strategy used to chunk documents before embedding.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SplitterKind {
    Sentence,
    Paragraph,
    Token,
}

impl SplitterKind {
    pub fn from_str(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "sentence" => SplitterKind::Sentence,
            "token" => SplitterKind::Token,
            _ => SplitterKind::Paragraph,
        }
    }
}

/// Chunking configuration, sourced from settings at index time.
#[derive(Debug, Clone)]
pub struct ChunkConfig {
    pub size: usize,
    pub overlap: usize,
    pub splitter: SplitterKind,
}

impl Default for ChunkConfig {
    fn default() -> Self {
        Self {
            size: 1000,
            overlap: 100,
            splitter: SplitterKind::Paragraph,
        }
    }
}

pub struct Indexer {
    pool: SqlitePool,
    engine: Arc<Mutex<Option<LocalEngine>>>,
    vector_db: Arc<VectorDb>,
    app_handle: AppHandle,
}

impl Indexer {
    pub fn new(pool: SqlitePool, engine: Arc<Mutex<Option<LocalEngine>>>, vector_db: Arc<VectorDb>, app_handle: AppHandle) -> Self {
        Self { pool, engine, vector_db, app_handle }
    }

    /// Read chunking configuration from the settings table.
    async fn load_chunk_config(&self) -> ChunkConfig {
        let size = settings::get(&self.pool, "rag_chunk_size").await
            .ok().flatten().and_then(|v| v.parse::<usize>().ok()).unwrap_or(1000);
        let overlap = settings::get(&self.pool, "rag_chunk_overlap").await
            .ok().flatten().and_then(|v| v.parse::<usize>().ok()).unwrap_or(100);
        let splitter = settings::get(&self.pool, "rag_splitter").await
            .ok().flatten().map(|s| SplitterKind::from_str(&s)).unwrap_or(SplitterKind::Paragraph);
        ChunkConfig { size, overlap, splitter }
    }

    pub async fn index_all(&self) -> Result<()> {
        let _ = self.app_handle.emit("ai:indexing_started", ());

        let table = self.vector_db.ensure_default_table().await?;
        let cfg = self.load_chunk_config().await;

        if let Err(e) = self.index_all_emails(&table, &cfg).await {
            log::error!("Error indexing emails: {:?}", e);
        }

        if let Err(e) = self.index_all_attachments(&table, &cfg).await {
            log::error!("Error indexing attachments: {:?}", e);
        }

        if let Err(e) = self.index_vault_items(&table, &cfg).await {
            log::error!("Error indexing vault items: {:?}", e);
        }

        let _ = self.app_handle.emit("ai:indexing_completed", ());
        Ok(())
    }

    pub async fn index_all_emails(&self, table: &lancedb::Table, cfg: &ChunkConfig) -> Result<()> {
        let messages = sqlx::query_as::<_, Message>("SELECT * FROM messages")
            .fetch_all(&self.pool)
            .await?;

        for msg in messages {
            let text = format!("Subject: {}\n\n{}", msg.subject.as_deref().unwrap_or(""), msg.body_text.as_deref().unwrap_or(""));
            if text.trim().is_empty() { continue; }
            self.index_document(table, &msg.id, &text, cfg).await?;
        }

        Ok(())
    }

    pub async fn index_all_attachments(&self, table: &lancedb::Table, cfg: &ChunkConfig) -> Result<()> {
        let attachments = sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE local_path IS NOT NULL")
            .fetch_all(&self.pool)
            .await?;

        for attach in attachments {
            if let Some(local_path) = &attach.local_path {
                let path = Path::new(local_path);
                if let Ok(text) = DocParser::parse_file(path) {
                    if text.trim().is_empty() { continue; }
                    self.index_document(table, &attach.id, &text, cfg).await?;
                }
            }
        }

        Ok(())
    }

    pub async fn index_vault_items(&self, table: &lancedb::Table, cfg: &ChunkConfig) -> Result<()> {
        let items = sqlx::query_as::<_, VaultItem>("SELECT * FROM vault_items WHERE is_dir = 0")
            .fetch_all(&self.pool)
            .await?;

        for item in items {
            let app_data = self.app_handle.path().app_data_dir().unwrap();
            let full_path = app_data.join("vault").join(&item.company_id).join(&item.relative_path);

            if full_path.exists() {
                if let Ok(text) = DocParser::parse_file(&full_path) {
                    if text.trim().is_empty() { continue; }
                    self.index_document(table, &item.id, &text, cfg).await?;
                }
            }
        }

        Ok(())
    }

    /// Split `text` into chunks (per `cfg`) and index each chunk.
    async fn index_document(&self, table: &lancedb::Table, id: &str, text: &str, cfg: &ChunkConfig) -> Result<()> {
        let chunks = split_text(text, cfg);
        if chunks.is_empty() {
            return Ok(());
        }
        for (i, chunk) in chunks.iter().enumerate() {
            let chunk_id = if chunks.len() == 1 {
                id.to_string()
            } else {
                format!("{id}#chunk{i}")
            };
            self.index_text(table, &chunk_id, chunk).await?;
        }
        Ok(())
    }

    async fn index_text(&self, table: &lancedb::Table, id: &str, text: &str) -> Result<()> {
        let vector = {
            let engine = self.engine.lock().await;
            let engine = engine.as_ref().ok_or_else(|| anyhow::anyhow!("Model not loaded"))?;
            engine.get_embeddings(text).await?
        };

        let schema = table.schema().await?;
        let id_array = StringArray::from(vec![id.to_string()]);
        let text_array = StringArray::from(vec![text.to_string()]);

        let vector_values = Float32Array::from(vector.clone());
        let vector_array = FixedSizeListArray::try_new(
            std::sync::Arc::new(arrow::datatypes::Field::new("item", DataType::Float32, true)),
            vector.len() as i32,
            std::sync::Arc::new(vector_values),
            None,
        )?;

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                std::sync::Arc::new(id_array),
                std::sync::Arc::new(text_array),
                std::sync::Arc::new(vector_array),
            ],
        )?;

        let reader: Box<dyn arrow::array::RecordBatchReader + Send> = Box::new(RecordBatchIterator::new(vec![Ok(batch)], schema));
        table.add(reader).execute().await?;
        Ok(())
    }

    /// Return all chunked documents (id, text) from emails, attachments, and
    /// vault items — without embedding them. The frontend embeds each chunk
    /// with a provider (LM Studio / Ollama / …) and sends the vectors back
    /// via `index_provider_vectors`. This lets users build the RAG index
    /// from a local provider without downloading the BGE-small model.
    pub async fn get_email_chunks(&self) -> Result<Vec<(String, String)>> {
        let cfg = self.load_chunk_config().await;
        let mut out: Vec<(String, String)> = Vec::new();

        let messages = sqlx::query_as::<_, Message>("SELECT * FROM messages")
            .fetch_all(&self.pool)
            .await?;
        for msg in messages {
            let text = format!(
                "Subject: {}\n\n{}",
                msg.subject.as_deref().unwrap_or(""),
                msg.body_text.as_deref().unwrap_or("")
            );
            if text.trim().is_empty() { continue; }
            for chunk in split_text(&text, &cfg) {
                out.push((msg.id.clone(), chunk));
            }
        }

        let attachments = sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE local_path IS NOT NULL")
            .fetch_all(&self.pool)
            .await?;
        for attach in attachments {
            if let Some(local_path) = &attach.local_path {
                let path = Path::new(local_path);
                if let Ok(text) = DocParser::parse_file(path) {
                    if text.trim().is_empty() { continue; }
                    for chunk in split_text(&text, &cfg) {
                        out.push((attach.id.clone(), chunk));
                    }
                }
            }
        }

        let items = sqlx::query_as::<_, VaultItem>("SELECT * FROM vault_items WHERE is_dir = 0")
            .fetch_all(&self.pool)
            .await?;
        for item in items {
            let app_data = self.app_handle.path().app_data_dir().unwrap();
            let full_path = app_data.join("vault").join(&item.company_id).join(&item.relative_path);
            if full_path.exists() {
                if let Ok(text) = DocParser::parse_file(&full_path) {
                    if text.trim().is_empty() { continue; }
                    for chunk in split_text(&text, &cfg) {
                        out.push((item.id.clone(), chunk));
                    }
                }
            }
        }

        Ok(out)
    }

    /// Insert pre-computed provider embeddings into the dimension-correct table.
    /// `vectors[i]` must correspond to `ids[i]` / `texts[i]`.
    /// The table dimension is taken from the first vector's length, so LM Studio
    /// / Ollama models of any width (384 / 768 / 1536, …) each get their
    /// own `knowledge_base_{dim}` table.
    pub async fn index_provider_vectors(
        &self,
        vectors: Vec<Vec<f32>>,
        ids: Vec<String>,
        texts: Vec<String>,
    ) -> Result<usize> {
        let count = vectors.len();
        if count == 0 {
            return Ok(0);
        }
        if ids.len() != count || texts.len() != count {
            return Err(anyhow::anyhow!(
                "index_provider_vectors: mismatched array lengths (vectors={}, ids={}, texts={})",
                count, ids.len(), texts.len()
            ));
        }

        let dim = vectors[0].len();
        let table = self.vector_db.ensure_table(dim).await?;
        let schema = table.schema().await?;

        let mut id_vec: Vec<String> = Vec::with_capacity(count);
        let mut text_vec: Vec<String> = Vec::with_capacity(count);
        let mut all_values: Vec<f32> = Vec::with_capacity(count * dim);
        for i in 0..count {
            id_vec.push(ids[i].clone());
            text_vec.push(texts[i].clone());
            for x in &vectors[i] {
                all_values.push(*x);
            }
        }

        let id_array = StringArray::from(id_vec);
        let text_array = StringArray::from(text_vec);
        let vector_values = Float32Array::from(all_values);
        let vector_array = FixedSizeListArray::try_new(
            std::sync::Arc::new(arrow::datatypes::Field::new("item", DataType::Float32, true)),
            dim as i32,
            std::sync::Arc::new(vector_values),
            None,
        )?;

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                std::sync::Arc::new(id_array),
                std::sync::Arc::new(text_array),
                std::sync::Arc::new(vector_array),
            ],
        )?;

        let reader: Box<dyn arrow::array::RecordBatchReader + Send> =
            Box::new(RecordBatchIterator::new(vec![Ok(batch)], schema));
        table.add(reader).execute().await?;
        Ok(count)
    }
}

/// Split `text` into overlapping chunks using the configured splitter.
pub fn split_text(text: &str, cfg: &ChunkConfig) -> Vec<String> {
    if cfg.size == 0 {
        return vec![text.to_string()];
    }

    let units: Vec<String> = match cfg.splitter {
        SplitterKind::Sentence => text
            .split(['.', '!', '?', '\n'])
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        SplitterKind::Token => text.split_whitespace().map(|s| s.to_string()).collect(),
        SplitterKind::Paragraph => text
            .split("\n\n")
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
    };

    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut i = 0;
    while i < units.len() {
        let unit = &units[i];
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(unit);
        if current.chars().count() >= cfg.size {
            chunks.push(std::mem::take(&mut current));
            if cfg.overlap > 0 && !chunks.is_empty() {
                let last = chunks.last().unwrap();
                let overlap_text: String = last
                    .chars()
                    .rev()
                    .take(cfg.overlap)
                    .collect::<String>()
                    .chars()
                    .rev()
                    .collect();
                current.push_str(&overlap_text);
            }
        }
        i += 1;
    }
    if !current.trim().is_empty() {
        chunks.push(current);
    }
    if chunks.is_empty() {
        vec![text.to_string()]
    } else {
        chunks
    }
}
