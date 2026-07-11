// ── AI Commands ────────────────────────────────────────────────────────────

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use sqlx::SqlitePool;
use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::{Mutex, RwLock};

use crate::db::ai::schema::{AiCache, AiConfig};
use crate::error::SerializedError;
use crate::ai::models::ModelManager;
use crate::ai::local_engine::LocalEngine;
use crate::ai::vector_db::VectorDb;
use crate::ai::indexer::Indexer;
use crate::ai::rag::RagSystem;

type CmdResult<T> = Result<T, SerializedError>;

pub struct AiState {
    pub engine: Arc<Mutex<LocalEngine>>,
    vector_db: RwLock<Option<Arc<VectorDb>>>,
    app_handle: tauri::AppHandle,
}

impl AiState {
    /// Create an `AiState` with the engine ready but the vector DB deferred.
    ///
    /// The LanceDB connection is opened lazily on the first RAG/index request
    /// (see [`ensure_vector_db`]), so startup stays fast and the vector store
    /// is only touched when the AI assistant actually needs it (on-demand).
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            engine: Arc::new(Mutex::new(
                LocalEngine::new().expect("Failed to init AI engine"),
            )),
            vector_db: RwLock::new(None),
            app_handle,
        }
    }

    /// Lazily open (and cache) the vector DB. Returns a shared handle the
    /// caller can use for the duration of the request.
    pub async fn ensure_vector_db(&self) -> Result<Arc<VectorDb>, String> {
        {
            let guard = self.vector_db.read().await;
            if let Some(db) = guard.as_ref() {
                return Ok(db.clone());
            }
        }
        let db = Arc::new(
            VectorDb::new(&self.app_handle)
                .await
                .map_err(|e| format!("Failed to init AI vector DB: {e}"))?,
        );
        {
            let mut guard = self.vector_db.write().await;
            *guard = Some(db.clone());
        }
        Ok(db)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertAiCacheRequest {
    pub account_id: String,
    pub thread_id: String,
    #[serde(rename = "type")]
    pub cache_type: String,
    pub content: String,
}

#[tauri::command]
pub async fn ai_download_model(
    app_handle: AppHandle,
    repo_id: String,
    filename: String,
) -> CmdResult<String> {
    let manager = ModelManager::new(app_handle);
    let path = manager.download_model(&repo_id, &filename).await
        .map_err(|e| SerializedError::new("AI_DOWNLOAD_ERROR", e.to_string()))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn ai_load_embedding_model(
    state: State<'_, AiState>,
    model_path: String,
    tokenizer_path: String,
) -> CmdResult<()> {
    let mut engine = state.engine.lock().await;
    engine.load_model(PathBuf::from(model_path), PathBuf::from(tokenizer_path))
        .map_err(|e| SerializedError::new("AI_LOAD_ERROR", e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn ai_index_emails(
    app_handle: AppHandle,
    pool: State<'_, SqlitePool>,
    state: State<'_, AiState>,
) -> CmdResult<()> {
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let indexer = Indexer::new((*pool).clone(), state.engine.clone(), vector_db, app_handle);
    indexer.index_all().await
        .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn ai_query_rag(
    state: State<'_, AiState>,
    query: String,
) -> CmdResult<String> {
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let rag = RagSystem::new(vector_db, state.engine.clone());
    rag.generate_augmented_prompt(&query).await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e.to_string()))
}

#[tauri::command]
pub async fn ai_search_by_vector(
    state: State<'_, AiState>,
    embedding: Vec<f32>,
    query: String,
) -> CmdResult<String> {
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let rag = RagSystem::new(vector_db, state.engine.clone());
    rag.generate_augmented_prompt_from_vector(embedding, &query).await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e.to_string()))
}

/// Returns the dedicated local models directory (`<app_data_dir>/models`).
/// Creates it if missing so the UI can always open / manage it.
/// Returns the absolute path of the on-device LanceDB knowledge base.
#[tauri::command]
pub async fn ai_get_vector_db_path(app_handle: AppHandle) -> CmdResult<String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new("AI_MODELS_DIR_ERROR", e.to_string()))?
        .join("knowledge_base.lance");
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn ai_get_models_dir(app_handle: AppHandle) -> CmdResult<String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new("AI_MODELS_DIR_ERROR", e.to_string()))?
        .join("models");
    if let Err(e) = std::fs::create_dir_all(&dir) {
        return Err(SerializedError::new(
            "AI_MODELS_DIR_ERROR",
            format!("Failed to create models directory: {}", e),
        ));
    }
    Ok(dir.to_string_lossy().to_string())
}

/// Removes a downloaded model (and its tokenizer) from the local models folder.
/// `repo_id` uses HF Hub format, e.g. `BAAI/bge-small-en-v1.5`.
#[tauri::command]
pub async fn ai_delete_model(app_handle: AppHandle, repo_id: String) -> CmdResult<()> {
    let models_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| SerializedError::new("AI_MODELS_DIR_ERROR", e.to_string()))?
        .join("models");
    if !models_dir.exists() {
        return Ok(());
    }

    // hf_hub stores each model under `<cache>/models--ORG--NAME`.
    // Sanitize the repo id the same way (`/` -> `--`).
    let sanitized = repo_id.replace('/', "--");
    let target = models_dir.join(format!("models--{}", sanitized));
    if target.exists() {
        std::fs::remove_dir_all(&target).map_err(|e| {
            SerializedError::new("AI_DELETE_ERROR", format!("Failed to remove model: {}", e))
        })?;
    }

    Ok(())
}

#[tauri::command]
pub async fn ai_reset_vector_db(
    state: State<'_, AiState>,
) -> CmdResult<()> {
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    vector_db.reset().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn db_get_ai_cache(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    cache_type: String,
) -> CmdResult<Option<AiCache>> {
    crate::db::tables::ai::ai_cache::get(&pool, &account_id, &thread_id, &cache_type)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_set_ai_cache(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    cache_type: String,
    content: String,
) -> CmdResult<AiCache> {
    crate::db::tables::ai::ai_cache::set(&pool, &account_id, &thread_id, &cache_type, &content)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_ai_cache(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
    cache_type: String,
) -> CmdResult<()> {
    crate::db::tables::ai::ai_cache::delete(&pool, &account_id, &thread_id, &cache_type)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_ai_cache_by_thread(
    pool: State<'_, SqlitePool>,
    account_id: String,
    thread_id: String,
) -> CmdResult<()> {
    crate::db::tables::ai::ai_cache::delete_by_thread(&pool, &account_id, &thread_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_get_ai_config_by_type(
    pool: State<'_, SqlitePool>,
    account_id: String,
    config_type: String,
) -> CmdResult<Option<AiConfig>> {
    crate::db::tables::ai::ai_config::get_by_type(&pool, &account_id, &config_type)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_ai_config(
    pool: State<'_, SqlitePool>,
    account_id: String,
    config_type: String,
    config_json: String,
    is_enabled: bool,
) -> CmdResult<AiConfig> {
    crate::db::tables::ai::ai_config::upsert(&pool, &account_id, &config_type, &config_json, is_enabled)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_delete_ai_config(
    pool: State<'_, SqlitePool>,
    account_id: String,
    config_type: String,
) -> CmdResult<()> {
    crate::db::tables::ai::ai_config::delete(&pool, &account_id, &config_type)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_list_ai_configs(
    pool: State<'_, SqlitePool>,
    account_id: String,
) -> CmdResult<Vec<AiConfig>> {
    crate::db::tables::ai::ai_config::list(&pool, &account_id)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn db_upsert_ai_cache(
    pool: State<'_, SqlitePool>,
    entry: UpsertAiCacheRequest,
) -> CmdResult<AiCache> {
    crate::db::tables::ai::ai_cache::set(
        &pool,
        &entry.account_id,
        &entry.thread_id,
        &entry.cache_type,
        &entry.content,
    )
    .await
    .map_err(Into::into)
}
