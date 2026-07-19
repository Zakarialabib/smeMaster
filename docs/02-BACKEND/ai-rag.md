# AI RAG — Backend Architecture & Tauri Commands

> **Feature doc:** [04-FEATURES/ai-rag.md](../04-FEATURES/ai-rag.md) · **Frontend doc:** [03-FRONTEND/ai-rag.md](../03-FRONTEND/ai-rag.md)
> **Status:** ✅ Complete (built 2026-07-09, verified 2026-07-11).

The RAG backend is **100% offline Rust** (no server, no external calls) using `candle` for embeddings and `lancedb` for vector storage. The cloud LLM is invoked only by the frontend provider layer (opt-in), never by Rust.

## Module structure

`src-tauri/src/ai/`:

| File              | Responsibility                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `mod.rs`          | Module wiring                                                                                                                     |
| `models.rs`       | `ModelId`, `BGE_SMALL_EN_V1_5`, `EmbeddingModel`, `RagChunk`, `IndexEmailsResponse`, `QueryRagResponse`, `SearchByVectorResponse` |
| `local_engine.rs` | Candle `BertModel` + tokenizer loading from local `.safetensors`; `get_embedding(text)`                                           |
| `vector_db.rs`    | LanceDB connection + `EmailChunk` schema; `search(query_vec, top_k)`                                                              |
| `parser.rs`       | Extract subject/from/date/body text from `Vec<u8>` RFC822; lightweight MIME parse                                                 |
| `indexer.rs`      | Load inbox from SQLite, chunk (512/80), embed, write to LanceDB; emit events                                                      |
| `rag.rs`          | `query_rag()` → embed + search + format augmented prompt; `search_by_vector()`                                                    |

Plus `src-tauri/src/commands/ai.rs` (command surface) and `src-tauri/src/events/` (`AppEvent` enum + `EmitEvent` discriminator live in `events/mod.rs`).

## Model management

- **Model:** `BAAI/bge-small-en-v1.5` (384-dim, ~130MB, int8).
- **Storage:** dedicated app folder `<app_data_dir>/models`, used as the HF Hub `cache_dir` (so downloaded models/embeddings no longer land in the shared `~/.cache/huggingface`). `ModelManager::models_dir()` creates it on first access.
- **Loaders:** `hf_hub::api::tokio::ApiBuilder` with `.with_cache_dir(app_data_dir/models)` for download; `candle` + `tokenizers` for load.
- **Idempotent load:** `ai_load_embedding_model` tracks a static `OnceLock<EmbeddingModel>`; re-loading the already-loaded model returns `AlreadyLoaded`.

```rust
pub struct EmbeddingModel {
    pub model_id: String,
    pub model: BertModel,
    pub tokenizer: Tokenizer,
}

static EMBEDDING_MODEL: OnceLock<EmbeddingModel> = OnceLock::new();
```

## Embedding engine (`local_engine.rs`)

- Pooling = mean of last-hidden over non-padding tokens.
- Normalize embeddings (L2) for cosine similarity.
- `get_embedding(text: &str) -> Result<Vec<f32>>`.

## Vector DB (`vector_db.rs`)

LanceDB table `email_chunks` with schema:

| Column        | Type           | Notes                  |
| ------------- | -------------- | ---------------------- |
| `id`          | `String`       | `{message_id}:{index}` |
| `message_id`  | `String`       | FK to mail row         |
| `folder`      | `String`       | e.g. `inbox`           |
| `subject`     | `String`       |                        |
| `from_addr`   | `String`       |                        |
| `date`        | `String`       | RFC3339                |
| `chunk_index` | `Int32`        |                        |
| `content`     | `String`       | chunk text             |
| `vector`      | `Float32[384]` | normalized embedding   |

`search(query_vec, top_k)` returns top-k by cosine, sorted by score desc.

## Parser (`parser.rs`)

- `fn parse_email(raw: &[u8]) -> ParsedEmail` extracts subject / from / date / body text.
- Intentional **lightweight** parse (not full `mailparse`) to keep the binary small.

## Indexer (`indexer.rs`)

```
load inbox rows (FOLDER = 'inbox')
  → for each: parse → chunk (512 tokens / 80 stride)
  → embed each chunk via candle
  → write rows to LanceDB `email_chunks`
emit ai:indexing_started  (before)
emit ai:indexing_completed (after, with count)
```

## RAG logic (`rag.rs`)

- `query_rag(query) -> String`:
  1. embed query, 2. `vector_db::search`, 3. format `context` blocks (subject/from/date/snippet), 4. return augmented prompt string.
- `search_by_vector(embedding, query) -> String`:
  - use pre-computed embedding + search, return augmented prompt string (no LLM call).

## Tauri commands (`commands/ai.rs`)

All live-registered in the single `generate_handler!` in `src-tauri/src/commands/mod.rs` alongside the 831 existing commands (canonical total per `docs/STATUS.md`: 768 `#[tauri::command]` + 63 `#[command]` shorthand = 831; the "802" figure is stale).

| Command                   | Params                           | Returns                     | Notes                                                                                        |
| ------------------------- | -------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `ai_download_model`       | `{ repo_id, filename }`          | model path string           | Downloads from HF Hub into `<app_data_dir>/models` (used as the HF `cache_dir`).             |
| `ai_load_embedding_model` | `{ model_path, tokenizer_path }` | `()`                        | Loads the local `.safetensors` + `tokenizer.json` into the candle engine.                    |
| `ai_get_models_dir`       | —                                | models folder path          | Returns (and creates) `<app_data_dir>/models`; surfaced in Settings → "Local Models Folder". |
| `ai_delete_model`         | `{ repo_id }`                    | `()`                        | Removes the HF cache subfolder (`models--ORG--NAME`) for the given repo id.                  |
| `ai_index_emails`         | —                                | `()`                        | Emits `ai:indexing_started` / `ai:indexing_completed`.                                       |
| `ai_query_rag`            | `{ query }`                      | `String` (augmented prompt) | Augmented prompt only (no LLM in Rust).                                                      |
| `ai_search_by_vector`     | `{ embedding, query }`           | `String` (augmented prompt) | Local vector search path.                                                                    |

### Command signatures (reference)

```rust
#[tauri::command]
pub async fn ai_download_model(repo_id: String, filename: String) -> Result<String, SerializedError>

#[tauri::command]
pub async fn ai_load_embedding_model(model_path: String, tokenizer_path: String) -> Result<(), SerializedError>

#[tauri::command]
pub async fn ai_get_models_dir(app_handle: AppHandle) -> Result<String, SerializedError>

#[tauri::command]
pub async fn ai_delete_model(app_handle: AppHandle, repo_id: String) -> Result<(), SerializedError>

#[tauri::command]
pub async fn ai_index_emails(state: State<'_, DbState>, window: Window) -> Result<(), String>

#[tauri::command]
pub async fn ai_query_rag(query: String) -> Result<String, String>

#[tauri::command]
pub async fn ai_search_by_vector(embedding: Vec<f32>, query: String) -> Result<String, String>
```

## Events (`events/`)

```rust
pub enum AppEvent {
    // ...
    Ai(AiEvent),
}
pub enum AiEvent {
    IndexingStarted { total: usize },
    IndexingCompleted { indexed_count: usize },
}
// emitted via window.emit("ai:indexing_started", payload)
```

Frontend listens in `ragStore.ts` (see [Frontend doc](../03-FRONTEND/ai-rag.md)).

## Security & privacy

- **No network egress in Rust.** Only `ai_download_model` (explicit user action, with mirror option) touches the network.
- **Local-only data.** All embeddings + chunks live in `app_data_dir`; mail never leaves the device on the local path.
- **Cloud path is opt-in** and handled by the frontend provider layer (`src/shared/services/ai/providers/`), which only ever receives the _retrieved context + query_, not raw mail.
- Models are user-deletable via the `ai_delete_model` command (Settings → Local Models Folder → "Remove model"), which removes the HF cache subfolder; the folder is browsable via "Open folder".

## Challenges & solutions

| Challenge                | Solution                                                                     |
| ------------------------ | ---------------------------------------------------------------------------- |
| Binary size from ML deps | Use `candle-core` (not full `candle`), `hf-hub` minimal, lightweight parser. |
| CPU embedding speed      | `bge-small` (384-dim) + int8 quantization; ~ms per chunk.                    |
| Memory                   | Stream indexer; 512-token chunks; top-k=3.                                   |
| LLM cost/privacy         | Local embeddings + local vector store; cloud LLM optional and context-only.  |

## Key files

| Concern      | Path                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| AI module    | `src-tauri/src/ai/` (`models.rs`, `local_engine.rs`, `vector_db.rs`, `parser.rs`, `indexer.rs`, `rag.rs`) |
| Commands     | `src-tauri/src/commands/ai.rs`                                                                            |
| Events       | `src-tauri/src/events/`                                                                                  |
| Registration | `src-tauri/src/lib.rs`                                                                                    |
| Cargo deps   | `src-tauri/Cargo.toml` (`candle*, `lancedb`, `hf-hub`, `tokenizers`)                                      |

## Source reconciliation (2026-07-19)

Two path/metric corrections verified against source:
- The "802 existing commands" figure was stale. The canonical total per `docs/STATUS.md` is **831** (`grep -rE '#\[tauri::command\]|#\[command\]' src-tauri/src | wc -l` → 831 = 768 + 63). The AI commands are registered in the single `generate_handler!` in `src-tauri/src/commands/mod.rs` (via `commands::register()` from `lib.rs`), not directly in `lib.rs`, so the wording was corrected accordingly.
- `events.rs` does not exist at the crate root; `AppEvent` and the `EmitEvent` discriminator live in `src-tauri/src/events/mod.rs` (the `events` module directory). All three references were corrected to `src-tauri/src/events/`.
