# Feature: AI RAG — Local Semantic Search & Knowledge Assistant

> **Status:** ✅ **Complete** — fully built in code (2026-07-09) and verified against the live codebase on 2026-07-11.
> **Layer docs:** [Backend](../02-BACKEND/ai-rag.md) (Rust/candle/LanceDB + Tauri commands) · [Frontend](../03-FRONTEND/ai-rag.md) (TS wrappers, store, components, settings UI).
> **Cross-cutting AI guides:** [Prompt Engineering](../03-FRONTEND/ai-prompt-engineering.md) · [Context Engineering](../03-FRONTEND/ai-context-engineering.md).

SMEMaster's AI RAG feature gives the user a local, offline, privacy-first semantic search over their own email + contacts, plus a chat-style "knowledge assistant" that answers questions using retrieved context (Retrieval-Augmented Generation). No data leaves the device for the local path; the cloud LLM path (provider-supplied) is opt-in and only sends the retrieved context + query.

## Why RAG (not full fine-tuning)

| Approach                                                       | Verdict        | Why                                                                                                                                             |
| -------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Full fine-tuning / LoRA                                        | ❌ Rejected    | Needs GPU server, training pipeline, per-user model; impossible offline on consumer laptops.                                                    |
| Cloud RAG (send all mail to API)                               | ❌ Rejected    | Privacy violation — mail is the most sensitive PII.                                                                                             |
| **Local embeddings + local vector store + optional cloud LLM** | ✅ **Adopted** | Embeddings run locally (candle), vectors stored locally (LanceDB), only the _retrieved context_ is sent to the cloud LLM when the user opts in. |

## Architecture

Three layers, fully offline-capable:

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Zustand)                                │
│  ragStore · RagSearchBar · RagResultBubble                     │
│  AiAssistantPage · KnowledgeBaseSettings · Composer RAG button     │
└───────────────┬───────────────────────────────┬─────────────┘
                │ invoke('ai_*')                 │ (context)
                ▼                                │
┌───────────────────────────────┐   ┌──────────────────────────────────┐
│  Tauri Commands (src-tauri)    │   │  AI Services (src/shared/services│
│  ai_download_model             │   │  /ai): ragContext, embeddingService
│  ai_load_embedding_model       │   │  providers, aiService, prompts    │
│  ai_index_emails               │   └───────────────┬──────────────────┘
│  ai_query_rag                  │                   │ (candle embeddings)
│  ai_search_by_vector           │                   ▼
└───────────────┬───────────────┘   ┌──────────────────────────────────┐
                │                   │  Rust AI module (src-tauri/src/ai)│
                │                   │  models · local_engine · vector_db│
                │                   │  parser · indexer · rag           │
                └──────────────────▶│  (candle + LanceDB, 100% offline) │
                                    └──────────────────────────────────┘
```

### Component modules

| Layer    | Module                                                            | Path                                                               |
| -------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Backend  | AI module (models, local_engine, vector_db, parser, indexer, rag) | `src-tauri/src/ai/`                                                |
| Backend  | Tauri command surface                                             | `src-tauri/src/commands/ai.rs`                                     |
| Frontend | RAG services (embed, context, wrappers)                           | `src/shared/services/ai/` + `src/shared/services/db/invoke/rag.ts` |
| Frontend | RAG state                                                         | `src/features/assistant/stores/ragStore.ts`                        |
| Frontend | RAG UI                                                            | `src/features/assistant/` (components + page)                      |
| Frontend | Settings UI                                                       | `src/features/settings/components/KnowledgeBaseSettings.tsx`            |
| Frontend | Composer integration                                              | `src/features/composer/` (RAG lookup button)                       |

### Key design decisions

| #   | Decision                                                                                                                     | Rationale                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| D1  | **Embedding model:** `BAAI/bge-small-en-v1.5` (384-dim, ~130MB, int8-quantized)                                              | Strong MTEB rank, small footprint, fast CPU inference via candle.           |
| D2  | **LLM:** cloud provider (Qwen via OpenRouter/dashscope) — **not** local                                                      | CPU can't run a useful 7B chat model; local LLM rejected for v1.            |
| D3  | **Vector store:** LanceDB (Rust `lancedb` crate)                                                                             | Local, embedded, SQL + vector search, no server.                            |
| D4  | **Chunk size:** 512 tokens / 80-token stride                                                                                 | Balances context granularity vs. recall; restores ~3 chunks.                |
| D5  | **Top-K:** 3 chunks, cosine similarity, rerank by recency + folder weight                                                    | Keeps prompts small, prioritizes recent + important mail.                   |
| D6  | **Indexing scope:** FOLDER = 'inbox'                                                                                         | Only inbox indexed by default (privacy + perf); future: configurable.       |
| D7  | **Two RAG paths:** (A) cloud LLM augmented answer, (B) local vector search only                                              | User can choose; local path is zero-cost and zero-leak.                     |
| D8  | **Events:** `ai:indexing_started` / `ai:indexing_completed`                                                                  | UI can show progress without polling.                                       |
| D9  | **Model storage:** dedicated `<app_data_dir>/models` folder (HF Hub `cache_dir`), user-controllable, deletable via Settings. | Keeps models out of the shared HF cache; browsable + removable from the UI. |

## Data flows

### Query (Path A — cloud LLM)

1. User types query in `RagSearchBar` / `AiAssistantPage`.
2. Frontend calls `invoke('ai_query_rag', { query, top_k, include_draft })`.
3. Rust `ai_query_rag` → `rag::query_rag()` embeds query, searches LanceDB (top-k), returns augmented prompt (context chunks + query).
4. Frontend passes augmented prompt to `askInbox()` / provider (`aiService` → `providers`) → LLM generates answer.
5. Answer + retrieved chunks rendered in `RagResultBubble`.

### Query (Path B — local vector search, no LLM)

1. Frontend calls `invoke('ai_search_by_vector', { query, top_k })`.
2. Rust embeds + searches, returns ranked chunks only.
3. Frontend renders chunks in `RagResultBubble` (no generated answer).

### Indexing

1. User clicks "Index Emails" (`KnowledgeBaseSettings`).
2. `invoke('ai_index_emails')` → `indexer::index_emails()` emits `ai:indexing_started`, parses + chunks inbox mail, embeds via candle, writes to LanceDB, emits `ai:indexing_completed`.
3. UI shows indexed count / ready state.

## Feature integrations

| Feature                                                | Integration                   | Mechanism                                                                                                        |
| ------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Composer**                                           | "Lookup in knowledge" button  | Uses `ai_search_by_vector` to pull relevant past emails/contacts into the draft context.                         |
| **Ask Inbox**                                          | RAG-augmented answers         | `askInbox()` / `aiService` receive the augmented prompt from `rag::query_rag`.                                   |
| **AI service** (`src/shared/services/ai/aiService.ts`) | Unified LLM entry             | Receives retrieved context, routes to provider (`providers/`).                                                   |
| **Smart replies**                                      | Context-aware suggestions     | Retrieval context feeds reply generation.                                                                        |
| **Settings**                                           | `KnowledgeBaseSettings` in `AiTab` | Embedding Source selector, model download/load, dedicated Models Folder (open/remove), indexing trigger, status. |

## UI & Feature Spec

> Full requirements/acceptance detail lives in the [Backend](../02-BACKEND/ai-rag.md) and [Frontend](../03-FRONTEND/ai-rag.md) docs. Summary below.

**Scope:** local model management (download + load), offline semantic email search, AI assistant page with RAG, settings UI. **Out of scope:** local LLM chat, cloud sync of embeddings.

**Component tree:**

```
Settings → AiTab → KnowledgeBaseSettings
  ├─ Local RAG              (enable toggle)
  ├─ Embedding Model        (source selector: Auto / Local BGE-small / AI Provider; download / load)
  ├─ Local Models Folder    (path + Open folder / Remove model)
  └─ Knowledge Base Indexing (index / re-index + progress)

Assistant feature:
  route /ai-assistant → AiAssistantPage
    ├─ RagSearchBar
    └─ RagResultBubble
```

**API contracts (Tauri commands):**

- `ai_download_model { repo_id, filename }` → model path (downloads into `<app_data_dir>/models`)
- `ai_load_embedding_model { model_path, tokenizer_path }` → `()`
- `ai_index_emails` → emits `ai:indexing_started` / `ai:indexing_completed`
- `ai_query_rag { query }` → augmented prompt (local BGE embed + vector search)
- `ai_search_by_vector { embedding, query }` → augmented prompt (provider/precomputed embed)
- `ai_get_models_dir` → `<app_data_dir>/models` path
- `ai_delete_model { repo_id }` → `()` (removes the model's HF cache subfolder)

**UI specs:** consistent with the design system — **frosted-glass cards** (`bg-white/70 dark:bg-slate-800/50` + `backdrop-blur-xl` + subtle border), "rag" accent color (violet/indigo), inline progress for model download/indexing, graceful empty/error states, i18n-ready (`useTranslation`).

**Acceptance criteria (all met):** model downloads with progress; embedding model loads once (idempotent); indexing emits start/complete; query returns augmented prompt ≤ 4s; local search returns ranked chunks; settings UI shows live status; route + nav entry present; RTL + dark mode compliant.

**Open questions (still open):**

- **Q1:** Should the assistant page also stream the LLM answer (not just the augmented prompt)? Currently returns context only.
- **Q2:** Show raw vector chunks or only the augmented prompt? Current scope: augmented prompt.
- **Q3:** Per-document indexing progress events, or only start/complete? Backend emits start/complete only.

## RAG prompts (summary)

The RAG retrieval prompt assembly is documented in [Prompt Engineering → §8 RAG Context Prompt](../03-FRONTEND/ai-prompt-engineering.md#8-rag-context-prompt). Key points:

- System message frames the assistant as "SMEMaster's local email knowledge assistant."
- Retrieved chunks are injected as `<context>` blocks with provenance (subject, from, date).
- Instruction: answer **only from provided context**; if absent, say "I couldn't find that in your emails."
- No PII exfiltration: local path never calls an LLM.

## RAG context construction (summary)

Context assembly (data sourcing, truncation, quality) is documented in [Context Engineering → §5 RAG Context](../03-FRONTEND/ai-context-engineering.md#5-rag-context). Key points:

- Source: LanceDB top-k chunks (already embedded + retrieved).
- Truncation: chunk-level (512 tokens), never mid-sentence cut for display snippets.
- Quality: recency + folder weighting; dedupe by message id; max ~3 chunks to stay within provider token limits.

## Future roadmap

| Item                                         | Status     | Notes                                             |
| -------------------------------------------- | ---------- | ------------------------------------------------- |
| Streaming LLM answers (Q1)                   | ⬜ Planned | Pipe `ai_query_rag` output to provider streaming. |
| Configurable indexing scope (folders/labels) | ⬜ Planned | Beyond inbox-only (D6).                           |
| Per-document progress (Q3)                   | ⬜ Planned | Granular indexing events.                         |
| Hybrid search (BM25 + vector)                | ⬜ Planned | Improves recall on exact-match queries.           |
| Contact/CRM RAG expansion                    | ⬜ Planned | Index contacts for relationship Q&A.              |

## Key files

| Concern          | Path                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Rust AI module   | `src-tauri/src/ai/` (`models.rs`, `local_engine.rs`, `vector_db.rs`, `parser.rs`, `indexer.rs`, `rag.rs`) |
| Tauri commands   | `src-tauri/src/commands/ai.rs`                                                                            |
| Events           | `src-tauri/src/events/mod.rs` (RAG events emitted ad-hoc via `app_handle.emit("ai:indexing_started", ..)` in `src-tauri/src/ai/indexer.rs`)                                                                  |
| Embedding (TS)   | `src/shared/services/ai/embeddingService.ts`                                                              |
| RAG context (TS) | `src/shared/services/ai/ragContext.ts`                                                                    |
| Invoke wrappers  | `src/shared/services/db/invoke/rag.ts`                                                                    |
| AI service       | `src/shared/services/ai/aiService.ts`                                                                     |
| Store            | `src/features/assistant/stores/ragStore.ts`                                                               |
| Components       | `src/features/assistant/components/` (`RagSearchBar.tsx`, `RagResultBubble.tsx`, `AiAssistantPage.tsx`)   |
| Settings UI      | `src/features/settings/components/KnowledgeBaseSettings.tsx`                                                   |
| Route + nav      | `src/routeTree.gen.ts` (`/ai-assistant`) · `src/shared/components/layout/shell/navConfig.ts`                                      |

## Source reconciliation (2026-07-19)

| Claim (before) | Verified reality | Evidence |
| --- | --- | --- |
| RAG Settings UI `src/features/settings/components/LocalRagSettings.tsx` | Actual `src/features/settings/components/KnowledgeBaseSettings.tsx` (imported by `AiTab.tsx`) | `find src/features/settings -iname '*rag*' -o -iname '*knowledge*'` |
| Events `src-tauri/src/events.rs` (`AppEvent::Ai`) | No `events.rs`; events module is `src-tauri/src/events/mod.rs`; RAG events emitted ad-hoc via `app_handle.emit("ai:indexing_started", ())` in `src-tauri/src/ai/indexer.rs` | `ls src-tauri/src/events.rs` → absent; `grep -n 'Ai' src-tauri/src/events/mod.rs` → no match |
| Route/nav `src/config/navConfig.ts` | Actual `src/shared/components/layout/shell/navConfig.ts` | `ls src/config/navConfig.ts` → absent |
