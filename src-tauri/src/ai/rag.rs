use anyhow::Result;
use std::sync::Arc;
use crate::ai::vector_db::VectorDb;
use crate::ai::local_engine::LocalEngine;
use lancedb::query::{ExecutableQuery, QueryBase};
use arrow::array::StringArray;
use futures::StreamExt;
use tokio::sync::Mutex;
use sqlx::SqlitePool;
use std::collections::HashMap;
use crate::db::tables::core::settings;

pub struct RagSystem {
    vector_db: Arc<VectorDb>,
    engine: Arc<Mutex<Option<LocalEngine>>>,
    pool: SqlitePool,
}

impl RagSystem {
    pub fn new(vector_db: Arc<VectorDb>, engine: Arc<Mutex<Option<LocalEngine>>>, pool: SqlitePool) -> Self {
        Self { vector_db, engine, pool }
    }

    pub async fn search(&self, query: &str, dim: usize, limit: usize) -> Result<Vec<String>> {
        let vector = {
            let engine = self.engine.lock().await;
            let engine = engine.as_ref().ok_or_else(|| anyhow::anyhow!("Model not loaded"))?;
            engine.get_embeddings(query).await?
        };

        // The local engine emits `dim`-wide vectors (BGE-small = 384).
        let table = self.vector_db.ensure_table(dim).await?;

        let mut results = table.vector_search(vector)?
            .limit(limit)
            .execute()
            .await?;

        let mut contexts = Vec::new();

        while let Some(batch_result) = results.next().await {
            let batch = batch_result?;
            let text_col = batch.column_by_name("text")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>())
                .ok_or_else(|| anyhow::anyhow!("Failed to get text column"))?;

            for i in 0..batch.num_rows() {
                contexts.push(text_col.value(i).to_string());
            }
        }

        Ok(contexts)
    }

    /// Read the search limit from settings, defaulting to 3.
    async fn load_search_limit(&self) -> usize {
        let raw = settings::get(&self.pool, "rag_search_limit").await.ok().flatten();
        raw.and_then(|v| v.parse::<usize>().ok()).filter(|&n| n > 0).unwrap_or(3)
    }

    pub async fn generate_augmented_prompt(&self, query: &str) -> Result<String> {
        let limit = self.load_search_limit().await;
        let contexts = self.search(query, 384, limit).await?;
        let context_str = contexts.join("\n---\n");

        let prompt = format!(
            "Use the following context to answer the user query.\n\nContext:\n{}\n\nUser Query: {}\n\nAnswer:",
            context_str, query
        );

        Ok(prompt)
    }

    /// Search LanceDB using a pre-computed embedding vector (from a provider like LM Studio).
    /// Skips the local embedding step and goes straight to vector search.
    pub async fn search_by_vector(&self, embedding: Vec<f32>, _query: &str, limit: usize) -> Result<Vec<String>> {
        let dim = embedding.len();
        let table = self.vector_db.ensure_table(dim).await?;

        let mut results = table.vector_search(embedding)?
            .limit(limit)
            .execute()
            .await?;

        let mut contexts = Vec::new();

        while let Some(batch_result) = results.next().await {
            let batch = batch_result?;
            let text_col = batch.column_by_name("text")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>())
                .ok_or_else(|| anyhow::anyhow!("Failed to get text column"))?;

            for i in 0..batch.num_rows() {
                contexts.push(text_col.value(i).to_string());
            }
        }

        Ok(contexts)
    }

    /// Generate augmented prompt from a pre-computed embedding vector.
    pub async fn generate_augmented_prompt_from_vector(&self, embedding: Vec<f32>, query: &str) -> Result<String> {
        let contexts = self.search_by_vector(embedding, query, 3).await?;
        let context_str = contexts.join("\n---\n");

        let prompt = format!(
            "Use the following context to answer the user query.\n\nContext:\n{}\n\nUser Query: {}\n\nAnswer:",
            context_str, query
        );

        Ok(prompt)
    }

    /// Hybrid search: BM25 (SQLite FTS5) + vector similarity (LanceDB),
    /// merged with Reciprocal Rank Fusion (RRF).
    ///
    /// Returns the top-`limit` chunk texts ranked by combined relevance.
    pub async fn hybrid_search(&self, query: &str, dim: usize, limit: usize) -> Result<Vec<String>> {
        let k = 60.0; // RRF constant

        // ── 1. BM25 search via FTS5 ──
        let bm25_rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, text FROM knowledge_base_fts WHERE knowledge_base_fts MATCH ? LIMIT ?"
        )
        .bind(query)
        .bind(limit as i64 * 3)
        .fetch_all(&self.pool)
        .await?;

        // ── 2. Vector search via LanceDB ──
        let vector = {
            let engine = self.engine.lock().await;
            let engine = engine.as_ref().ok_or_else(|| anyhow::anyhow!("Model not loaded"))?;
            engine.get_embeddings(query).await?
        };
        let table = self.vector_db.ensure_table(dim).await?;
        let mut results = table.vector_search(vector)?
            .limit(limit * 3)
            .execute()
            .await?;

        let mut vector_texts: Vec<String> = Vec::new();
        while let Some(batch_result) = results.next().await {
            let batch = batch_result?;
            let text_col = batch.column_by_name("text")
                .and_then(|c| c.as_any().downcast_ref::<StringArray>())
                .ok_or_else(|| anyhow::anyhow!("Failed to get text column"))?;
            for i in 0..batch.num_rows() {
                vector_texts.push(text_col.value(i).to_string());
            }
        }

        // ── 3. Reciprocal Rank Fusion ──
        let mut scores: HashMap<String, f64> = HashMap::new();

        // BM25 results: rank by position (FTS5 returns in rank order)
        for (rank, (_id, text)) in bm25_rows.iter().enumerate() {
            let rrf_score = 1.0 / (k + rank as f64 + 1.0);
            *scores.entry(text.clone()).or_insert(0.0) += rrf_score;
        }

        // Vector results: rank by position
        for (rank, text) in vector_texts.iter().enumerate() {
            let rrf_score = 1.0 / (k + rank as f64 + 1.0);
            *scores.entry(text.clone()).or_insert(0.0) += rrf_score;
        }

        // Sort by RRF score descending
        let mut ranked: Vec<(String, f64)> = scores.into_iter().collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        Ok(ranked.into_iter().take(limit).map(|(text, _)| text).collect())
    }

    /// Generate augmented prompt using hybrid search (BM25 + vector + RRF).
    pub async fn generate_augmented_prompt_hybrid(&self, query: &str) -> Result<String> {
        let contexts = self.hybrid_search(query, 384, 3).await?;
        let context_str = contexts.join("\n---\n");

        let prompt = format!(
            "Use the following context to answer the user query.\n\nContext:\n{}\n\nUser Query: {}\n\nAnswer:",
            context_str, query
        );

        Ok(prompt)
    }
}
