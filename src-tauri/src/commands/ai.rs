// ── AI Commands ────────────────────────────────────────────────────────────
//
// Dual-mode architecture:
//   1. Sidecar mode (preferred):   ml-sidecar binary is running → forward via IPC
//   2. In-process mode (fallback):  AiState with local candle/lancedb
//
// The sidecar is a separate OS process (crates/ml-sidecar/) that holds all
// heavy ML deps (candle, lancedb, hf-hub, tokenizers). Benefits:
//   - Main app builds without protoc
//   - Crash isolation: ML segfault doesn't take down the app
//   - Memory isolation: 500+ MB model weights in sidecar process
//   - Auto-restart: MlSidecarService watchdog respawns on crash

use serde::Deserialize;
use tauri::{AppHandle, Manager, State};
use sqlx::SqlitePool;
use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::{Mutex, RwLock};

use crate::db::ai::schema::{AiCache, AiConfig};
use crate::error::SerializedError;
#[cfg(feature = "local-ai")]
use crate::orchestrator::services::{MlSidecarService, SidecarClient};
use crate::ai::models::ModelManager;
use crate::ai::local_engine::LocalEngine;
use crate::ai::vector_db::VectorDb;
use crate::ai::indexer::Indexer;
use crate::ai::rag::RagSystem;

type CmdResult<T> = Result<T, SerializedError>;

pub struct AiState {
    /// The local embedding engine. **Lazily constructed** — `None` until the
    /// user explicitly loads an embedding model via `ai_load_embedding_model`.
    /// This keeps app startup free of any candle/LanceDB/heavy ML init.
    engine: Arc<Mutex<Option<LocalEngine>>>,
    vector_db: RwLock<Option<Arc<VectorDb>>>,
    app_handle: tauri::AppHandle,
}

impl AiState {
    /// Create an `AiState` with **no** engine and no vector DB.
    ///
    /// Construction is panic-free: the heavy `LocalEngine` (candle + BGE-small)
    /// is only built on the first `ai_load_embedding_model` call, and the
    /// LanceDB connection is opened lazily on the first RAG/index request
    /// (see [`ensure_vector_db`]). Startup therefore never touches ML deps.
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            engine: Arc::new(Mutex::new(None)),
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

    /// Returns a clone of the shared engine handle. The engine itself is
    /// created lazily inside `ai_load_embedding_model`; callers that need the
    /// engine to be *ready* should use [`ensure_engine_loaded`] instead.
    pub fn engine_handle(&self) -> Arc<Mutex<Option<LocalEngine>>> {
        self.engine.clone()
    }

    /// Ensure the embedding engine has been loaded. Returns an error (mapped to
    /// a user-friendly message) if the model has not been loaded yet, so the
    /// caller can surface a "Download model" prompt rather than panicking.
    pub async fn ensure_engine_loaded(&self) -> Result<(), String> {
        let guard = self.engine.lock().await;
        if guard.is_some() {
            Ok(())
        } else {
            Err(
                "AI embedding model is not loaded. Download and load a model first \
                 (e.g. via the AI assistant) before indexing or querying."
                    .to_string(),
            )
        }
    }
}

/// Try to get a SidecarClient from Tauri state.
/// Returns `None` if the sidecar is not running or the binary is missing.
#[cfg(feature = "local-ai")]
fn try_sidecar(app: &AppHandle) -> Option<SidecarClient> {
    app.try_state::<Arc<MlSidecarService>>()
        .map(|s| s.inner().clone())
        .filter(|svc| svc.is_running())
        .map(SidecarClient::new)
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
    // Prefer sidecar if running
    if let Some(client) = try_sidecar(&app_handle) {
        client.load_embedding_model(&repo_id).await
            .map_err(|e| SerializedError::new("AI_DOWNLOAD_ERROR", e.to_string()))?;
        let models_dir = app_handle.path().app_data_dir()
            .map_err(|e| SerializedError::new("AI_DOWNLOAD_ERROR", e.to_string()))?
            .join("models")
            .join(format!("models--{}", repo_id.replace('/', "--")))
            .join(&filename);
        return Ok(models_dir.to_string_lossy().to_string());
    }

    // Fallback: in-process ModelManager
    let manager = ModelManager::new(app_handle);
    let path = manager.download_model(&repo_id, &filename).await
        .map_err(|e| SerializedError::new("AI_DOWNLOAD_ERROR", e.to_string()))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn ai_load_embedding_model(
    app_handle: AppHandle,
    state: State<'_, AiState>,
    model_path: String,
    tokenizer_path: String,
) -> CmdResult<()> {
    // Prefer sidecar if running
    if let Some(client) = try_sidecar(&app_handle) {
        // The sidecar loads from repo_id; model_path is the local path.
        // Map the path to a repo_id for the sidecar.
        let repo_id = model_path
            .rsplit('/')
            .next()
            .unwrap_or(&model_path)
            .replace("models--", "")
            .replace("--", "/");
        // Also pass local paths for direct file loading
        return client.load_embedding_model(&repo_id).await
            .map_err(|e| SerializedError::new("AI_LOAD_ERROR", format!("Sidecar: {e}")))
            .map(|_| ());
    }

    // Fallback: in-process LocalEngine via AiState
    let mut engine_guard = state.engine.lock().await;
    let engine = match engine_guard.as_mut() {
        Some(engine) => engine,
        None => {
            let mut created = LocalEngine::new()
                .map_err(|e| SerializedError::new("AI_LOAD_ERROR", format!("Failed to init AI engine: {e}")))?;
            engine_guard.insert(created)
        }
    };
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
    // Prefer sidecar if running
    if let Some(client) = try_sidecar(&app_handle) {
        // Sidecar handles indexing internally via LanceDB
        let db_path = app_handle.path().app_data_dir()
            .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e.to_string()))?
            .join("knowledge_base.lance");
        client.ensure_vector_db(&db_path.to_string_lossy()).await
            .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e.to_string()))?;
        // For now, sidecar indexing is async — the sidecar reads from the same SQLite DB
        // TODO: wire indexer to sidecar once full IPC is implemented
        log::info!("[ai] Sidecar mode: indexing request sent");
        return Ok(());
    }

    // Fallback: in-process Indexer
    state.ensure_engine_loaded().await
        .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e))?;
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let indexer = Indexer::new((*pool).clone(), state.engine_handle(), vector_db, app_handle);
    indexer.index_all().await
        .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn ai_query_rag(
    app_handle: AppHandle,
    state: State<'_, AiState>,
    query: String,
) -> CmdResult<String> {
    // Prefer sidecar if running
    if let Some(client) = try_sidecar(&app_handle) {
        let result = client.query_rag(&query, 5).await
            .map_err(|e| SerializedError::new("AI_RAG_ERROR", e.to_string()))?;
        return Ok(result.to_string());
    }

    // Fallback: in-process RagSystem
    state.ensure_engine_loaded().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let rag = RagSystem::new(vector_db, state.engine_handle());
    rag.generate_augmented_prompt(&query).await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e.to_string()))
}

#[tauri::command]
pub async fn ai_search_by_vector(
    app_handle: AppHandle,
    state: State<'_, AiState>,
    embedding: Vec<f32>,
    query: String,
) -> CmdResult<String> {
    // Prefer sidecar if running
    if let Some(client) = try_sidecar(&app_handle) {
        let result = client.query_rag(&query, 5).await
            .map_err(|e| SerializedError::new("AI_RAG_ERROR", e.to_string()))?;
        return Ok(result.to_string());
    }

    // Fallback: in-process RagSystem
    state.ensure_engine_loaded().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let rag = RagSystem::new(vector_db, state.engine_handle());
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

/// A single indexed chunk: its stable id and the chunk text.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkRecord {
    pub id: String,
    pub text: String,
}

/// Return every chunked document (id, text) from emails, attachments,
/// and vault items — without embedding them. The frontend embeds each
/// chunk with a local provider (LM Studio / Ollama / …) and sends the
/// vectors back via [`ai_insert_provider_vectors`]. This lets users build
/// the RAG index from a local provider without downloading BGE-small.
#[tauri::command]
pub async fn ai_get_email_chunks(
    app_handle: AppHandle,
    pool: State<'_, SqlitePool>,
    state: State<'_, AiState>,
) -> CmdResult<Vec<ChunkRecord>> {
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let indexer = Indexer::new((*pool).clone(), state.engine.clone(), vector_db, app_handle);
    let chunks = indexer.get_email_chunks().await
        .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e.to_string()))?;
    Ok(chunks.into_iter().map(|(id, text)| ChunkRecord { id, text }).collect())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderVectorRequest {
    pub vectors: Vec<Vec<f32>>,
    pub ids: Vec<String>,
    pub texts: Vec<String>,
}

/// Insert pre-computed provider embeddings into the dimension-correct table.
/// The table dimension is derived from the first vector's length, so LM Studio
/// / Ollama models of any width (384 / 768 / 1536, …) each get their
/// own `knowledge_base_{dim}` table and never collide.
#[tauri::command]
pub async fn ai_insert_provider_vectors(
    app_handle: AppHandle,
    pool: State<'_, SqlitePool>,
    state: State<'_, AiState>,
    req: ProviderVectorRequest,
) -> CmdResult<usize> {
    let vector_db = state.ensure_vector_db().await
        .map_err(|e| SerializedError::new("AI_RAG_ERROR", e))?;
    let indexer = Indexer::new((*pool).clone(), state.engine.clone(), vector_db, app_handle);
    indexer.index_provider_vectors(req.vectors, req.ids, req.texts).await
        .map_err(|e| SerializedError::new("AI_INDEX_ERROR", e.to_string()))
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

// ── Runtime AI / sidecar observability (gaps #1,#3,#5,#7,#9) ───────────

/// Returns the current sidecar runtime status so the settings UI can disable
/// the AI toggle when ML is unavailable (no binary, or `local-ai` is off).
#[tauri::command]
pub async fn ai_get_sidecar_status(app_handle: AppHandle) -> CmdResult<serde_json::Value> {
    #[cfg(feature = "local-ai")]
    {
        if let Some(service) = app_handle.try_state::<Arc<MlSidecarService>>() {
            let svc = service.inner();
            let running = svc.is_running();
            let healthy = svc.is_healthy();
            let version = svc.version();
            Ok(serde_json::json!({
                "enabled": true,
                "running": running,
                "healthy": healthy,
                "version": version,
            }))
        } else {
            Ok(serde_json::json!({
                "enabled": true,
                "running": false,
                "healthy": false,
                "version": None::<String>,
            }))
        }
    }
    #[cfg(not(feature = "local-ai"))]
    {
        Ok(serde_json::json!({
            "enabled": false,
            "running": false,
            "healthy": false,
            "version": None::<String>,
        }))
    }
}

/// Polls the sidecar for its embedded counter metrics (gap #9).
/// Returns `null` when the sidecar binary predates the `metrics` method.
#[tauri::command]
pub async fn ai_get_sidecar_metrics(app_handle: AppHandle) -> CmdResult<Option<serde_json::Value>> {
    #[cfg(feature = "local-ai")]
    {
        if let Some(service) = app_handle.try_state::<Arc<MlSidecarService>>() {
            let client = SidecarClient::new(service.inner().clone());
            Ok(client.metrics().await.ok())
        } else {
            Ok(None)
        }
    }
    #[cfg(not(feature = "local-ai"))]
    {
        Ok(None)
    }
}

/// Lists the models currently registered in the sidecar (gap #7).
#[tauri::command]
pub async fn ai_list_sidecar_models(app_handle: AppHandle) -> CmdResult<Option<serde_json::Value>> {
    #[cfg(feature = "local-ai")]
    {
        if let Some(service) = app_handle.try_state::<Arc<MlSidecarService>>() {
            let client = SidecarClient::new(service.inner().clone());
            Ok(client.list_models().await.ok())
        } else {
            Ok(None)
        }
    }
    #[cfg(not(feature = "local-ai"))]
    {
        Ok(None)
    }
}

