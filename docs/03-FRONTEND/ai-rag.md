# AI RAG — Frontend Integration & UI

> **Feature doc:** [04-FEATURES/ai-rag.md](../04-FEATURES/ai-rag.md) · **Backend doc:** [02-BACKEND/ai-rag.md](../02-BACKEND/ai-rag.md)
> **Status:** ✅ Complete (built 2026-07-09, verified 2026-07-11).

The frontend wraps the 5 Tauri commands, holds RAG state in a Zustand store, renders the assistant UI, and exposes model/index management in Settings. It follows the three-layer pattern: **React → Service (`invoke`) → Rust**.

## Invoke wrappers

`src/shared/services/db/invoke/rag.ts` — typed wrappers around the 7 RAG commands:

```ts
export const aiDownloadModel  = (repoId: string, filename: string) => invoke<string>('ai_download_model', { repoId, filename })
export const aiLoadEmbeddingModel = (modelPath: string, tokenizerPath: string) => invoke<void>('ai_load_embedding_model', { modelPath, tokenizerPath })
export const aiIndexEmails    = () => invoke<void>('ai_index_emails')
export const aiQueryRag       = (q: string) => invoke<string>('ai_query_rag', { query: q })
export const aiSearchByVector = (embedding: number[], q: string) => invoke<string>('ai_search_by_vector', { embedding, query: q })
export const aiGetModelsDir   = () => invoke<string>('ai_get_models_dir')
export const aiDeleteModel    = (repoId: string) => invoke<void>('ai_delete_model', { repoId })
```

Embeddings on the TS side (`src/shared/services/ai/embeddingService.ts`) reuse the backend model config (`BGE_SMALL_EN_V1_5`, 384-dim) so the composer/context layer stays consistent.

## State — `ragStore.ts`

`src/features/assistant/store/ragStore.ts` (Zustand) holds:

| Slice | Fields |
| --- | --- |
| Model | `modelStatus`, `modelPath`, `tokenizerPath`, `modelError` |
| Embedding source | `embeddingSource` (`rust_bge` \| `provider` \| `null`=auto), `setEmbeddingSource()` |
| Models folder | `modelsDir`, `fetchModelsDir()`, `removeModel()` |
| Index | `indexingStatus`, `lastIndexedAt`, `indexingError` |
| Query | `conversation`, `isSearching`, `searchError`, `search()` |
| Events | listeners for `ai:indexing_started` / `ai:indexing_completed` |

Standard store boundaries (see [02-state-management](02-state-management.md)): RAG owns its own slice; no cross-store mutation of mail/account state.

## Components (`src/features/assistant/components/`)

| Component | Role |
| --- | --- |
| `RagSearchBar.tsx` | Query input; triggers `searchByVector` / `queryRag`. |
| `RagResultBubble.tsx` | Renders retrieved chunks (local path) or LLM answer + context (cloud path). |
| `RagStatusBadge.tsx` | Live model/index status; "Index Emails" trigger. |
| `AiAssistantPage.tsx` | `/ai-assistant` page composing the above. |

### Settings UI — `LocalRagSettings.tsx`

`src/features/settings/components/LocalRagSettings.tsx`, rendered inside `Settings → AiTab`:

| Card | Responsibility |
| --- | --- |
| `Embedding Model` | Embedding Source selector (Auto / Local BGE-small / AI Provider) + Download model / Load model + model paths. |
| `Local Models Folder` | Shows the dedicated `<app_data_dir>/models` path with "Open folder" and "Remove model" controls. |
| `Knowledge Base Indexing` | "Index All Data" / "Re-index" + last-indexed time + progress. |

## Routing & navigation

- Route: `/ai-assistant` (registered in `src/routeTree.gen.ts` via the assistant feature).
- Nav entry: added to `src/config/navConfig.ts` (nav-rail item, i18n label `nav.assistant`).

## Design tokens (UI/UX)

RAG UI follows the design system with a **frosted-glass** treatment consistent with the rest of settings/assistant:

```tsx
className="rounded-2xl border border-white/20 bg-white/70 p-5 shadow-lg backdrop-blur-xl
           dark:border-slate-700/50 dark:bg-slate-800/50"
```

- Accent: violet/indigo ("rag" semantic color) for actions + status.
- Inline progress bars for download/indexing.
- Empty / error / loading states handled per component.
- i18n via `useTranslation` (keys under `aiRag.*`); RTL + dark mode compliant.

## Cloud LLM path (opt-in)

`queryRag()` returns the augmented prompt (`context` + `query`). The frontend then calls the provider layer:

```
ragStore.queryRag() → { context, query }
  → aiService.ask({ messages: [system + { role:'user', content: context + query }] })
  → providers/ (Qwen / OpenRouter / dashscope)  // only context+query leaves device
  → RagResultBubble renders answer
```

## Key files

| Concern | Path |
| --- | --- |
| Invoke wrappers | `src/shared/services/db/invoke/rag.ts` |
| Embedding (TS) | `src/shared/services/ai/embeddingService.ts` |
| RAG context builder | `src/shared/services/ai/ragContext.ts` |
| AI service (LLM) | `src/shared/services/ai/aiService.ts` |
| Store | `src/features/assistant/stores/ragStore.ts` |
| Components | `src/features/assistant/components/` |
| Page | `src/features/assistant/components/AiAssistantPage.tsx` |
| Settings UI | `src/features/settings/components/LocalRagSettings.tsx` |
| Route + nav | `src/routeTree.gen.ts` · `src/config/navConfig.ts` |
