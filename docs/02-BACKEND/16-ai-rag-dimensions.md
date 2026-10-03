# AI RAG Multi-Dimension System

> Three isolated embedding spaces with dimension-specific vector tables.
> **Sources:** `src/features/assistant/stores/ragStore.ts`, `src/shared/services/db/invoke/rag.ts`, `src/shared/services/ai/modelRegistry.ts`

## Overview

SMEMaster's RAG system supports **three distinct embedding spaces** that are never merged. Each space produces vectors of a different dimensionality, and LanceDB stores them in dimension-specific tables (`knowledge_base_{dim}`) to prevent cross-space contamination.

This architecture is defined in **ADR-001 D2** and ensures that vectors from different embedding models are never compared against each other.

## The Three Embedding Spaces (ADR-001 D2)

| Space       | Source                     | Model                                  | Dimensions   | Table                 |
| ----------- | -------------------------- | -------------------------------------- | ------------ | --------------------- |
| **Space A** | Desktop candle (Rust)      | BGE-small-en-v1.5                      | 384 (fixed)  | `knowledge_base_384`  |
| **Space B** | Desktop provider endpoint  | LM Studio / Ollama / OpenAI-compatible | N (variable) | `knowledge_base_{N}`  |
| **Space C** | Server agent-core (Python) | bge-m3                                 | 1024 (fixed) | `knowledge_base_1024` |

### Space A — Desktop Candle BGE-Small (384-dim, Fixed)

- **Model:** `BAAI/bge-small-en-v1.5` (downloaded from Hugging Face)
- **Dimensions:** 384 (fixed by model architecture)
- **Engine:** Rust ml-sidecar (`src-tauri/crates/ml-sidecar/`)
- **Use case:** Fully offline, zero-config local embeddings
- **Limitations:** English-only, lower quality than larger models

### Space B — Desktop Provider Endpoint (N-dim, Variable)

- **Model:** User-configured via LM Studio, Ollama, or any OpenAI-compatible endpoint
- **Dimensions:** Variable — determined by the loaded model (384, 768, 1024, 1536, etc.)
- **Engine:** External provider API
- **Use case:** Higher-quality local embeddings, multilingual support
- **Configuration:** `lmstudio_embedding_model` setting

### Space C — Server Agent-Core (1024-dim, bge-m3)

- **Model:** `bge-m3` (via Python agent-core)
- **Dimensions:** 1024 (fixed by model architecture)
- **Engine:** Python agent-core server
- **Use case:** Server-side RAG for multi-device sync
- **Note:** Separate system from desktop voice (per ADR-001)

## The Invariant: Three Spaces Are Never Merged

**Critical rule:** Vectors from different embedding spaces are **NOT comparable**. A 384-dim BGE-small vector and a 1024-dim bge-m3 vector cannot be searched in the same index — the dimensions don't match, and even if they did, the semantic spaces are different.

This is enforced at multiple levels:

1. **Model registry** — each embedding model has a unique `embeddingSpaceId`
2. **LanceDB tables** — each dimension gets its own table (`knowledge_base_{dim}`)
3. **Runtime checks** — the embedding source setting locks the active space

## Dimension-Specific LanceDB Tables

When provider embeddings are inserted, the dimension is auto-detected from the vector length:

```typescript
// src/shared/services/db/invoke/rag.ts
export async function aiInsertProviderVectors(
  vectors: number[][],
  ids: string[],
  texts: string[],
): Promise<number> {
  return invokeCommand<number>('ai_insert_provider_vectors', { vectors, ids, texts });
}
```

The Rust backend uses `vectors[0].length` to determine the dimension and routes to the correct table:

| Vector Dimension | LanceDB Table         |
| ---------------- | --------------------- |
| 384              | `knowledge_base_384`  |
| 768              | `knowledge_base_768`  |
| 1024             | `knowledge_base_1024` |
| 1536             | `knowledge_base_1536` |
| 3072             | `knowledge_base_3072` |
| N                | `knowledge_base_{N}`  |

This means LM Studio models of any width (384, 768, 1536, etc.) each get their own table, and vectors are never mixed across dimensions.

## Embedding Source Selection

The `embeddingSource` setting controls which space is active:

```typescript
type EmbeddingSource = 'rust_bge' | 'provider' | null;
```

| Value         | Behavior                                   |
| ------------- | ------------------------------------------ |
| `"rust_bge"`  | Force Space A — local BGE-small (384-dim)  |
| `"provider"`  | Force Space B — provider endpoint (N-dim)  |
| `null` (auto) | Try provider first, fall back to BGE-small |

### Auto Mode Resolution

```typescript
// From ragStore.ts search():
const source = get().embeddingSource;

if (source === 'rust_bge') {
  response = await aiQueryRag(query); // Space A
} else if (source === 'provider') {
  const embedding = await getProviderEmbedding(query);
  response = await aiSearchByVector(embedding.vector, query); // Space B
} else {
  // Auto: prefer provider, fall back to local BGE-small
  const embedding = await getProviderEmbedding(query);
  if (embedding) {
    response = await aiSearchByVector(embedding.vector, query);
  } else {
    response = await aiQueryRag(query);
  }
}
```

### Indexing by Source

```typescript
// From ragStore.ts indexAll():
if (source === 'rust_bge') {
  await aiIndexEmails(); // Rust embeds + indexes (Space A)
  return;
}

// Provider embeddings: fetch chunks, embed each, send vectors back
const chunks = await aiGetEmailChunks();
const vectors: number[][] = [];
for (const chunk of chunks) {
  const emb = await getProviderEmbedding(chunk.text);
  if (emb) vectors.push(emb.vector);
}
await aiInsertProviderVectors(vectors, ids, texts); // Space B
```

## Migration Path When Changing Embedding Models

When switching from one embedding model to another (e.g., BGE-small → LM Studio with a different model), the old vectors become invalid:

1. **Reset the vector database:**

   ```typescript
   await aiResetVectorDb(); // Drops and recreates the LanceDB table
   ```

2. **Re-index all documents:**

   ```typescript
   await indexAll(); // Re-embeds and re-inserts all chunks
   ```

3. **The `embeddingSpaceId` prevents half-migrated indexes:** If the new model has a different `embeddingSpaceId`, the old vectors are in a different table and won't be searched. Only after re-indexing will the new table contain valid vectors.

### Migration Checklist

| Step | Action                        | Command                          |
| ---- | ----------------------------- | -------------------------------- |
| 1    | Select new embedding model    | Settings → AI → Embedding Source |
| 2    | Reset vector database         | `aiResetVectorDb()`              |
| 3    | Re-index all documents        | `indexAll()`                     |
| 4    | Verify search returns results | Test with a known query          |

## Settings Keys

| Key                        | Type   | Description                                 |
| -------------------------- | ------ | ------------------------------------------- |
| `embedding_source`         | string | `"rust_bge"` / `"provider"` / `"auto"`      |
| `embedding_dims`           | number | Cached embedding dimension (for UI display) |
| `lmstudio_embedding_model` | string | LM Studio embedding model name              |
| `lmstudio_server_url`      | string | LM Studio server URL                        |

## Key Files

| File                                                         | Purpose                                   |
| ------------------------------------------------------------ | ----------------------------------------- |
| `src/features/assistant/stores/ragStore.ts`                  | Embedding source state, indexing, search  |
| `src/shared/services/db/invoke/rag.ts`                       | Tauri command wrappers for RAG operations |
| `src/shared/services/ai/modelRegistry.ts`                    | `embeddingSpaceId` definitions            |
| `src/features/settings/components/KnowledgeBaseSettings.tsx` | Embedding source UI                       |
| `src-tauri/crates/ml-sidecar/`                               | Rust BGE-small embedding engine           |
