use anyhow::Result;
use std::sync::Arc;
use crate::ai::vector_db::VectorDb;
use crate::ai::local_engine::LocalEngine;
use lancedb::query::{ExecutableQuery, QueryBase};
use arrow::array::StringArray;
use futures::StreamExt;
use tokio::sync::Mutex;

pub struct RagSystem {
    vector_db: Arc<VectorDb>,
    engine: Arc<Mutex<LocalEngine>>,
}

impl RagSystem {
    pub fn new(vector_db: Arc<VectorDb>, engine: Arc<Mutex<LocalEngine>>) -> Self {
        Self { vector_db, engine }
    }

    pub async fn search(&self, query: &str, limit: usize) -> Result<Vec<String>> {
        let vector = {
            let engine = self.engine.lock().await;
            engine.get_embeddings(query).await?
        };

        let table = self.vector_db.ensure_table().await?;

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

    pub async fn generate_augmented_prompt(&self, query: &str) -> Result<String> {
        let contexts = self.search(query, 3).await?;
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
        let table = self.vector_db.ensure_table().await?;

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
}
