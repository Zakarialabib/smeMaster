use anyhow::Result;
use hf_hub::api::tokio::ApiBuilder;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[allow(dead_code)]
pub struct ModelManager {
    app_handle: AppHandle,
}

#[allow(dead_code)]
impl ModelManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Dedicated app-local models directory (`<app_data_dir>/models`).
    /// Created on first access so downloaded models/embeddings live in a
    /// managed folder instead of the generic HF Hub cache.
    pub fn models_dir(&self) -> Result<PathBuf> {
        let dir = self.app_handle.path().app_data_dir()?.join("models");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub async fn download_model(&self, repo_id: &str, filename: &str) -> Result<PathBuf> {
        let cache_dir = self.models_dir()?;
        let api = ApiBuilder::new()
            .with_cache_dir(cache_dir)
            .build()?;
        let repo = api.model(repo_id.to_string());
        let path = repo.get(filename).await?;
        Ok(path)
    }

    pub async fn get_bge_small(&self) -> Result<(PathBuf, PathBuf)> {
        let model_path = self.download_model("BAAI/bge-small-en-v1.5", "model.safetensors").await?;
        let tokenizer_path = self.download_model("BAAI/bge-small-en-v1.5", "tokenizer.json").await?;
        Ok((model_path, tokenizer_path))
    }

    pub async fn get_qwen_05b(&self) -> Result<PathBuf> {
        self.download_model("Qwen/Qwen2.5-0.5B-Instruct-GGUF", "qwen2.5-0.5b-instruct-q4_k_m.gguf").await
    }
}
