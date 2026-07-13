# AI/RAG: LMStudio Integration + RAG Full Fix

**Date:** 2026-07-12
**Status:** Approved — ready for implementation planning
**Approach:** A (Full fix) — complete end-to-end local AI + RAG

---

## Problem

SMEMaster has a fully implemented LMStudio provider (`lmstudioProvider.ts`) and a complete RAG system (Rust candle BGE-small + LanceDB + 9 Tauri commands + frontend store + assistant page), but they are not connected end-to-end:

1. **LMStudio is not in the settings UI** — the `AiTab.tsx` dropdown only shows 6 of 8 providers. Users must use the "Custom" workaround.
2. **Vector DB is hardcoded to 384 dims** — LMStudio/Ollama models often output 768 or 1536 dims, causing LanceDB insert failures.
3. **Indexing uses local candle engine only** — the `Indexer` in `indexer.rs` always uses `LocalEngine` for generating embeddings. If a user selected "provider" embeddings and hasn't downloaded BGE-small, indexing fails.
4. **RAG assistant shows raw context chunks** — no LLM-generated natural-language answer.
5. **`askInbox()` doesn't use RAG** — only FTS, missing the `buildFusedContext()` merge.

## Solution

### 1. Wire LMStudio + OpenRouter into AiTab UI

**File:** `src/features/settings/components/tabs/AiTab.tsx`

Changes:
- Add `"lmstudio"` and `"openrouter"` to the provider `<select>` dropdown options
- Extend the `useState` type union to include all 8 providers
- Fix the `useEffect` loader (line 50) to handle `"lmstudio"` and `"openrouter"` (currently only checks `openai|gemini|ollama|copilot`)
- Add LMStudio settings panel (visible when `provider === "lmstudio"`):
  - Server URL input (`http://localhost:1234` default)
  - Model name input (empty default — user fills or auto-detects)
  - "Auto-detect" button — calls `detectLMStudio()` + `listLMStudioModels()` from `lmstudioProvider.ts`; populates model dropdown with results
  - "Test Connection" button — calls `testConnection()` from the provider
  - Save button — writes `lmstudio_server_url` and `lmstudio_model` settings via `db-invoke`
- Add OpenRouter settings panel:
  - API key input
  - Model dropdown (from `PROVIDER_MODELS.openrouter`)
  - Save button

The `providerManager.ts` already fully handles `"lmstudio"` (lines 60-72) and `"openrouter"` — no service-layer changes needed.

### 2. Multi-table vector DB per dimension

**File:** `src-tauri/src/ai/vector_db.rs`

Replace the single `embeddings` table with dynamic per-dimension tables:

- Table naming: `embeddings_{dim}` (e.g. `embeddings_384`, `embeddings_768`, `embeddings_1536`)
- New method: `get_or_create_table(dim: usize) -> Result<Table>` — creates table with `DataType::FixedSizeList(..., dim)` if not exists, returns existing table if already created
- New method: `get_active_table_name(dim: usize) -> String` — returns `"embeddings_{dim}"`
- `search()` and `insert()` methods accept a `dim` parameter and route to the correct table
- The old `embeddings` table (384-dim) is auto-detected on first access and aliased to `embeddings_384` (migration: if old table exists and `embeddings_384` doesn't, rename it)
- `reset_vector_db` command: drops ALL `embeddings_*` tables

**Downstream changes:**
- `rag.rs`: `search()` and `search_by_vector()` accept `dim` parameter, pass to `vector_db`
- `indexer.rs`: `index_emails()` determines dim from the active embedding source (local engine = 384, provider = query model API or accept as parameter from frontend)
- `commands/ai.rs`: `ai_query_rag`, `ai_search_by_vector`, `ai_index_emails` accept optional `dim` parameter

### 3. Provider embeddings for indexing

**New IPC flow** — enables LMStudio/Ollama embeddings for indexing without requiring BGE-small download:

**New Rust command** (`commands/ai.rs`):
```rust
#[tauri::command]
pub async fn ai_insert_provider_vectors(
    state: tauri::State<'_, AiState>,
    vectors: Vec<Vec<f32>>,
    metadata: Vec<IndexMetadata>,
    table_dim: usize,
) -> Result<usize, String>
```
- Accepts pre-computed vectors (from frontend provider's `getEmbeddings()`) + metadata
- Inserts into the correct `embeddings_{table_dim}` table
- Returns count inserted

**Frontend flow** (`ragStore.ts` `indexEmails` action):
- If `embeddingSource === "rust_bge"`: call existing `aiIndexEmails()` (Rust handles everything)
- If `embeddingSource === "provider"`:
  1. Fetch email chunks from Rust (new command `ai_get_email_chunks` or reuse existing indexer's chunking)
  2. For each chunk, call the active provider's `getEmbeddings()` (LMStudio/Ollama/etc.)
  3. Send vectors + metadata to `aiInsertProviderVectors(vectors, metadata, dim)`
- If `embeddingSource === null` (auto): try provider first, fall back to local BGE

**`indexer.rs` change:** Add a `get_email_chunks()` method that returns chunked text + metadata without embedding — so the frontend can embed via provider and send vectors back. The existing `index_emails()` method stays for the local-engine path.

### 4. RAG assistant LLM answer

**File:** `src/features/assistant/pages/AiAssistantPage.tsx`

After fetching RAG context (existing `search()` in `ragStore.ts`):
1. Build augmented prompt: system prompt (from `docs/03-FRONTEND/ai-prompt-engineering.md` section 8) + RAG context chunks + user query
2. Call `callAi(augmentedPrompt)` to get a natural-language answer
3. Display the LLM answer as the primary content
4. Show source chunks in a collapsible "Sources" section below (with file paths, relevance scores)
5. If no AI provider is configured, fall back to showing raw context chunks only

**New store action** (`ragStore.ts`):
```typescript
askQuestion: async (query: string) => {
  const ragResult = await search(query); // existing search
  if (!isAiAvailable()) return { answer: null, sources: ragResult.chunks };
  const augmentedPrompt = buildRagAnswerPrompt(query, ragResult.chunks);
  const answer = await callAi(augmentedPrompt, { system: RAG_ANSWER_SYSTEM_PROMPT });
  return { answer, sources: ragResult.chunks };
}
```

**Prompt constant** (in `src/shared/services/ai/prompts.ts`):
```
RAG_ANSWER_SYSTEM_PROMPT = `You are a knowledgeable assistant for SMEMaster. 
Answer the user's question using ONLY the provided context chunks. 
If the context doesn't contain the answer, say "I couldn't find this in your data."
Cite sources by their file/type when referencing information.`
```

### 5. Fix `askInbox()` RAG

**File:** `src/shared/services/ai/aiService.ts`

Current `askInbox()` (line 315) uses FTS only. Change:
- Call `buildFusedContext(query, ftsResults)` from `ragContext.ts` — merges FTS results with vector search results
- Pass the fused context to the LLM instead of FTS-only context
- Guard: if RAG is not enabled or no vectors indexed, fall back to FTS-only (current behavior)

## Error Handling

- **LMStudio not running:** "Test Connection" shows toast: "Could not reach LM Studio at {url}. Is it running?"
- **Vector dimension mismatch:** Frontend queries the embedding model with a short test text, reads the output dimension, creates the correct-dim table. If dim doesn't match an existing table and data exists at another dim, show warning: "Switching embedding model will create a new index. Your existing index (dim 384) will remain but won't be searched."
- **Provider embedding timeout:** Fall back to local BGE-small if available; show toast: "Provider embeddings timed out, using local model."
- **No AI provider configured for RAG answer:** Show raw context chunks with a banner: "Configure an AI provider to get AI-generated answers."

## Testing

### TypeScript tests
- `AiTab.test.tsx`: renders all 8 provider options; LMStudio panel saves `lmstudio_server_url` + `lmstudio_model` settings; auto-detect button calls `detectLMStudio`
- `ragStore.test.ts`: `askQuestion()` returns LLM answer when provider available; falls back to raw chunks when not
- `aiService.test.ts`: `askInbox()` calls `buildFusedContext` when RAG enabled

### Rust tests
- `vector_db.rs`: `get_or_create_table(384)` creates correct schema; `get_or_create_table(768)` creates separate table; old `embeddings` table auto-migrated to `embeddings_384`
- `commands/ai.rs`: `ai_insert_provider_vectors` inserts into correct-dim table

### Manual tests
- LMStudio running at localhost:1234 → select LMStudio in AiTab → auto-detect models → set model → test connection → index emails → query assistant → get LLM answer
- Switch embedding source from BGE-small to LMStudio → verify new table created → re-index → query → results from new table
- `askInbox()` with RAG enabled → verify fused context (FTS + vector)

## Files Modified

| Layer | File | Change |
|-------|------|--------|
| Frontend UI | `src/features/settings/components/tabs/AiTab.tsx` | Add LMStudio + OpenRouter to dropdown, settings panels, auto-detect |
| Frontend store | `src/features/assistant/stores/ragStore.ts` | Add `askQuestion()` action; update `indexEmails()` for provider path |
| Frontend service | `src/shared/services/ai/aiService.ts` | Fix `askInbox()` to use `buildFusedContext()` |
| Frontend prompts | `src/shared/services/ai/prompts.ts` | Add `RAG_ANSWER_SYSTEM_PROMPT` |
| Frontend page | `src/features/assistant/pages/AiAssistantPage.tsx` | Show LLM answer + collapsible sources |
| Rust vector DB | `src-tauri/src/ai/vector_db.rs` | Multi-table per dimension; auto-migration |
| Rust RAG | `src-tauri/src/ai/rag.rs` | Accept `dim` parameter |
| Rust indexer | `src-tauri/src/ai/indexer.rs` | Add `get_email_chunks()` for provider path |
| Rust commands | `src-tauri/src/commands/ai.rs` | Add `ai_insert_provider_vectors`; add `dim` to existing commands |
| Rust command reg | `src-tauri/src/commands/mod.rs` | Register new command |

## Dependencies

No new crate or npm dependencies required. All infrastructure exists:
- `lmstudioProvider.ts` — fully implemented
- `openAiCompatibleProvider.ts` — shared factory
- LanceDB — already in Cargo.toml
- `getEmbeddings()` — already on the `AiProviderClient` interface

## Risks

1. **Multi-table migration** — if the old `embeddings` table has data, renaming it must be atomic. SQLite supports `ALTER TABLE RENAME TO`, so this is safe.
2. **Provider embedding latency** — indexing 1000 emails via LMStudio requires 1000 embedding calls. Batch where possible; show progress bar; allow cancellation.
3. **Dynamic dimension detection** — we need the embedding model's output dimension before creating the table. Solution: embed a short test text ("test") and read `response[0].length`.
