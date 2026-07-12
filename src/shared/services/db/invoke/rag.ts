/**
 * RAG (Retrieval-Augmented Generation) Tauri command wrappers.
 *
 * These bridge the local embedding + vector search backend to the frontend.
 * See docs/04-FEATURES/ai-rag.md for the full architecture.
 *
 * @module
 */

import { invokeCommand } from './command';

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Download a model from Hugging Face Hub.
 *
 * @param repoId - Hugging Face repo ID (e.g. "BAAI/bge-small-en-v1.5")
 * @param filename - File to download (e.g. "model.safetensors")
 * @returns The local file path of the downloaded model
 */
export async function aiDownloadModel(
  repoId: string,
  filename: string,
): Promise<string> {
  return invokeCommand<string>('ai_download_model', { repoId, filename });
}

/**
 * Load the BGE-small embedding model into memory from local paths.
 *
 * Must be called after `aiDownloadModel` has fetched the files.
 *
 * @param modelPath - Local path to the model.safetensors file
 * @param tokenizerPath - Local path to the tokenizer.json file
 */
export async function aiLoadEmbeddingModel(
  modelPath: string,
  tokenizerPath: string,
): Promise<void> {
  return invokeCommand<void>('ai_load_embedding_model', {
    modelPath,
    tokenizerPath,
  });
}

/**
 * Trigger a full re-index of all emails, attachments, and vault items.
 *
 * Emits Tauri events `ai:indexing_started` and `ai:indexing_completed`
 * which can be listened to via `@tauri-apps/api/event`.
 */
export async function aiIndexEmails(): Promise<void> {
  return invokeCommand<void>('ai_index_emails');
}

/**
 * Perform a semantic RAG search and return an augmented prompt.
 *
 * The backend embeds the query, searches LanceDB for the top-3 similar
 * contexts, and constructs a prompt combining those contexts with the
 * original query.
 *
 * @param query - Natural language question or search phrase
 * @returns Augmented prompt string with context + query
 */
export async function aiQueryRag(query: string): Promise<string> {
  return invokeCommand<string>('ai_query_rag', { query });
}

/**
 * Search the knowledge base using a pre-computed embedding vector.
 *
 * Skips the local embedding step — use this when the embedding was generated
 * by an external provider (LM Studio, Ollama, OpenAI-compatible).
 *
 * @param embedding - Pre-computed embedding vector (e.g. from LM Studio)
 * @param query - Original query text for prompt construction
 * @returns Augmented prompt string with context + query
 */
export async function aiSearchByVector(
  embedding: number[],
  query: string,
): Promise<string> {
  return invokeCommand<string>('ai_search_by_vector', { embedding, query });
}

/**
 * Returns the dedicated local models directory path.
 * The backend creates it on demand.
 */
export async function aiGetModelsDir(): Promise<string> {
  return invokeCommand<string>('ai_get_models_dir');
}

/**
 * Deletes a downloaded model from the local models folder.
 *
 * @param repoId - Hugging Face repo ID (e.g. "BAAI/bge-small-en-v1.5")
 */
export async function aiDeleteModel(repoId: string): Promise<void> {
  return invokeCommand<void>('ai_delete_model', { repoId });
}
/**
 * Returns the absolute path of the on-device LanceDB knowledge base.
 */
export async function aiGetVectorDbPath(): Promise<string> {
  return invokeCommand<string>('ai_get_vector_db_path');
}

/**
 * Drops and recreates the LanceDB knowledge base table, clearing all
 * indexed vectors. The table is rebuilt on the next index.
 */
export async function aiResetVectorDb(): Promise<void> {
  return invokeCommand<void>('ai_reset_vector_db');
}

