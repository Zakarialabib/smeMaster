# AI Settings Refactor — Embedding Model + Page Reorganization

**Date:** 2026-07-13
**Status:** Approved — ready for implementation planning
**Approach:** A (Provider client owns its embedding model)
**Complements:** [`2026-07-12-ai-rag-lmstudio-design.md`](./2026-07-12-ai-rag-lmstudio-design.md)

---

## Relationship to the prior spec

The 2026-07-12 spec already:
- Wired the **LM Studio** (and OpenRouter) providers into `AiTab.tsx`.
- Added **provider-embedding indexing** (frontend fetches chunks from Rust, embeds via the active provider, sends vectors back through `aiInsertProviderVectors`).
- Added the **Rust multi-dimension vector DB** + `askInbox()` RAG fusion.

That spec **did not** make the embedding model *configurable*. It reused the **chat model** for embeddings (`lmstudioProvider.getEmbeddings` sends `model: model || "default"`, where `model` is the chat model). In LM Studio you load a **separate** embedding model (e.g. `text-embedding-nomic-embed-text-v1.5`), so RAG/vector indexing silently fails or produces wrong-dimension vectors. It also left the Local RAG UI as a single stacked section whose "Local Models Folder" / "Vector Database" blocks are confusing noise when you are actually using a provider.

This spec closes those two gaps: (1) a **dedicated, configurable LM Studio embedding model**; (2) a **reorganized, contextual AI settings page**.

## Out of scope (owned by the prior spec)

- Rust `vector_db.rs` multi-table-per-dimension + dim auto-detection.
- `ai_insert_provider_vectors` / `ai_get_email_chunks` IPC (already implemented per the prior spec).
- `askInbox()` RAG fusion and the RAG assistant LLM answer (already specified).

We only touch the **frontend**: embedding-model config + plumbing (Approach A) and the AI page UI/UX.

---

## Problem

1. **LM Studio embedding model is not configurable.** There is no settings field or UI input for it. `lmstudioProvider.getEmbeddings(req)` ignores `req.model` and sends the chat model id. Users running a dedicated embedding model in LM Studio cannot target it, so indexing/search via provider embeddings is broken.
2. **The Local RAG section is confusing.** Two distinct engines (LM Studio provider embeddings vs on-device BGE/candle) are mixed into one stacked view. The "Local Models Folder" (downloaded BGE) and "Vector Database" blocks are meaningless when using a provider — there is no local model to download.
3. **No way to validate the embedding model.** Users can't confirm the embedding endpoint returns real vectors before indexing.

## Solution

### 1. Configurable LM Studio embedding model (Approach A)

The provider client **owns** its embedding model; callers stay unchanged.

**`src/shared/services/ai/providers/lmstudioProvider.ts`**
- Change factory signature to `createLMStudioProvider(serverUrl, { chatModel, embeddingModel }, aiLanguage)`.
- `getEmbeddings(req)`: send `model: req.model ?? embeddingModel ?? "default"`. (Keeps the existing `AiEmbeddingRequest.model?` override for any future caller.)
- Add `testEmbedding(serverUrl, embeddingModel?)`: POST a tiny string to `/v1/embeddings`, assert a non-empty vector; return `{ ok: boolean; dims?: number; error?: string }`. Reuses the normalized-URL + fetch pattern already in the file.
- `listLMStudioModels` / `detectLMStudio` unchanged.

**`src/shared/services/ai/providerManager.ts`**
- Read new setting `lmstudio_embedding_model` (plain text, **not** secret).
- Pass `{ chatModel, embeddingModel }` into `createLMStudioProvider`.
- Include `embeddingModel` in the LM Studio cache key so a model change rebuilds the client.
- `embeddingService.getQueryEmbedding` / `ragStore` indexing + search are **unchanged** — the client already uses the correct model.

**`src/shared/services/ai/types.ts`**
- Add a small options type, e.g. `interface LMStudioProviderOptions { chatModel: string; embeddingModel?: string }`, and update the `createLMStudioProvider` signature. Keep `DEFAULT_MODELS.lmstudio = ""`.

**New setting key:** `lmstudio_embedding_model` (persisted via `setSetting`, read via `getSetting`).

### 2. AI page reorganization (mirrors `DeliverabilityTab`)

Refactor `src/features/settings/components/tabs/AiTab.tsx` into a single tab with:
- A **header status row** (3 tiles): *Provider connected?* · *Embedding model set?* · *Knowledge base indexed?* (status derived from `isAiAvailable()`, `lmstudio_embedding_model` presence, `ragStore.lastIndexedAt`).
- An **internal sub-navigation** (like `DeliverabilityTab.SUB_TABS`) with three sections:

**Section A — Provider & Models** (existing provider picker + panels)
- For **LM Studio**: Server URL, Chat Model (detect + select + free-text), **new Embedding Model** (free-text input + "detected models" suggestions dropdown populated by `listLMStudioModels`, + **Test embedding** button using `testEmbedding`), Save, Test Connection.
- Other providers unchanged.

**Section B — AI Features** (existing toggles, unchanged)
- Auto-categorize, auto-summarize, smart replies, ask-inbox, AI language, auto-draft, writing-style, categories, bundle delivery.

**Section C — Knowledge Base** (was `LocalRagSettings.tsx`)
- An **engine mode selector**: *Provider embeddings (LM Studio)* vs *On-device BGE (candle)*.
- **Provider mode (contextual UI):** shows provider + embedding-model status, **Index All Data**, last-indexed, re-index, vector-DB location, and chunking settings. **Hides** the download/load-model buttons and the "Local Models Folder" block entirely.
- **On-device BGE mode (contextual UI):** shows download/load BGE model, "Local Models Folder", model status, index, vector DB, chunking. **Hides** provider/embedding notes.
- The shared "Vector Database" + "Text Splitter & Chunking" blocks appear in **both** modes (they are engine-agnostic), but the redundant per-mode folder noise is removed.

### 3. RAG store & indexing (mode-aware)

**`src/features/assistant/stores/ragStore.ts`**
- Keep `embeddingSource: "provider" | "rust_bge" | null` semantics (provider = LM Studio embeddings; `null`/auto = provider→BGE fallback).
- Make the **Index All Data** enable logic mode-aware:
  - Provider mode → enabled when `isAiAvailable()` AND `lmstudio_embedding_model` is set (or the active provider is embeddings-capable with an embedding model).
  - BGE mode → enabled when `modelStatus === "loaded"` (current behavior).
- When provider mode is selected but no embedding model is set → disable Index + show an inline hint: *"Load an embedding model in LM Studio and enter its name in Provider & Models."*
- Add a `testEmbedding()` action that calls through `providerManager` → `lmstudioProvider.testEmbedding` and exposes the result for the UI.

### 4. Error handling & validation
- Server URL validated as `http(s)://` (reuse existing `isValidUrl`).
- Embedding model is free-text; **Test embedding** verifies it returns a real vector and surfaces the dimension or a clear error.
- If indexing fails, `indexingError` already surfaces the message (kept).
- Preserve the prior spec's dimension-mismatch guidance: the first provider embed can report `dims`; if it differs from an existing index, warn before re-indexing (lightweight — no Rust change; read dim from the test-embedding result).

## Testing ("well tested")

### TypeScript unit tests
- `lmstudioProvider.test.ts` (extend): `getEmbeddings` sends the **embedding** model, not the chat model; `req.model` override still wins; `testEmbedding` returns `{ ok: true, dims }` on success and `{ ok: false, error }` on failure; new factory signature wires both models.
- `providerManager.test.ts` (extend): reads `lmstudio_embedding_model`, passes `{ chatModel, embeddingModel }` into the client, and the cache key includes `embeddingModel`.
- `embeddingService.test.ts` (extend): `getQueryEmbedding` returns the provider vector using the configured embedding model (mock provider asserts the model arg).

### Component / integration tests
- `KnowledgeBaseSettings` (extracted from `LocalRagSettings`): switching engine mode shows/hides the correct controls (provider mode hides models-folder + download; BGE mode hides provider notes); Index button enable logic per mode.
- `AiTab.test.tsx` (extend): sub-nav renders the three sections; LM Studio section renders the embedding-model input + Test embedding button; selecting provider mode without an embedding model disables Index with the hint.

### Manual smoke
- LM Studio running with a chat model **and** a separate embedding model loaded.
- Settings → AI → Provider & Models: enter server URL, detect models, set chat model, set embedding model, **Test embedding** (shows dims), Test Connection, Save.
- Knowledge Base → Provider mode → **Index All Data** → confirm indexing completes and `lastIndexedAt` updates.
- Assistant page → ask a question → RAG returns relevant sources (vectors from the configured embedding model).
- Switch to On-device BGE mode → confirm models-folder + download/load UI appears and provider notes are hidden.

## Files modified

| Layer | File | Change |
|-------|------|--------|
| Provider | `src/shared/services/ai/providers/lmstudioProvider.ts` | New factory signature `{ chatModel, embeddingModel }`; `getEmbeddings` uses embedding model; add `testEmbedding` |
| Provider mgr | `src/shared/services/ai/providerManager.ts` | Read `lmstudio_embedding_model`; pass options; cache key includes it |
| Types | `src/shared/services/ai/types.ts` | `LMStudioProviderOptions`; update `createLMStudioProvider` signature |
| AI page | `src/features/settings/components/tabs/AiTab.tsx` | Sub-nav (Provider & Models / AI Features / Knowledge Base) + status row; LM Studio embedding-model input + Test embedding |
| KB section | `src/features/settings/components/LocalRagSettings.tsx` → `KnowledgeBaseSettings` | Two explicit engine modes, contextual UI, remove redundant folder noise |
| RAG store | `src/features/assistant/stores/ragStore.ts` | Mode-aware Index enable logic; embedding-model hint; `testEmbedding` action |
| i18n | `src/locales/{en,fr,ar,it,ja}/translation.json` | Keys: embedding model label/hint, Test embedding, engine-mode labels, status tiles |
| Tests | `lmstudioProvider.test.ts`, `providerManager.test.ts`, `embeddingService.test.ts`, `AiTab.test.tsx`, `KnowledgeBaseSettings.test.tsx` | Cover above |

## Dependencies
None new. All infrastructure already exists (`getEmbeddings`, `listLMStudioModels`, `aiInsertProviderVectors`, `ragStore` provider path).

## Risks
1. **LM Studio `/v1/models` does not label embedding vs chat models.** We use a free-text embedding-model input (with detected-model suggestions) rather than a type-filtered dropdown — matches user intent ("write the embedding running in LM Studio"). `Test embedding` de-risks typos.
2. **Dimension drift:** switching embedding models changes vector dim. We reuse the prior spec's dim-detection (embed a test string, read length) and warn before re-indexing. No Rust change required for the warning.
3. **Backward compatibility:** existing `lmstudio_model` (chat) setting is untouched; `lmstudio_embedding_model` is optional and defaults to empty (falls back to `"default"` / prior behavior) so current users keep working until they set it.
