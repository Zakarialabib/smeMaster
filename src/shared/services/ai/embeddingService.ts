/**
 * Embedding Service — Unified embeddings across providers and the local Rust RAG backend.
 *
 * Provides a single `getQueryEmbedding(query)` function that:
 * 1. Tries the active AI provider if it supports `getEmbeddings()` (LM Studio, OpenAI-compatible, Ollama)
 * 2. Falls back to the Rust candle-based BGE-small model if the provider doesn't support embeddings
 * 3. Returns null if neither source is available
 *
 * Space pinning: every embedding result carries a `spaceId` that identifies the vector space.
 * The knowledge base stores its `spaceId`. The router refuses to embed into a KB whose space doesn't match.
 *
 * @module
 */

import { getActiveProvider } from './providerManager';
import type { AiProviderClient } from './types';
import type { EmbeddingResult } from './capabilities';

/**
 * Attempt to get an embedding vector from the active AI provider (LM Studio, Ollama, etc.).
 *
 * @returns The embedding result with space info, or null if provider has no embeddings support
 */
export async function getProviderEmbedding(text: string): Promise<EmbeddingResult | null> {
  try {
    const provider = await getActiveProvider();

    // Check if provider supports embeddings
    if (
      typeof (provider as AiProviderClient & { getEmbeddings?: Function }).getEmbeddings !==
      'function'
    ) {
      return null;
    }

    const result = await (provider as Required<AiProviderClient>).getEmbeddings({
      input: text,
    });

    if (result && result.vectors && result.vectors.length > 0) {
      const vec = result.vectors[0];
      if (vec && vec.length > 0) {
        return {
          vectors: result.vectors,
          spaceId: result.spaceId,
          dimensions: result.dimensions,
          modelId: result.modelId,
        };
      }
    }

    return null;
  } catch {
    // Provider unavailable or embeddings not supported
    return null;
  }
}

/**
 * Get a query embedding for RAG search.
 *
 * Strategy:
 * 1. Try the active AI provider (LM Studio, Ollama, OpenAI-compatible) for embeddings
 * 2. Fall back to null — caller should use Rust backend (`ai_query_rag`)
 *
 * @param text - The text to embed
 * @returns The embedding result, or null if no embedding source is available
 */
export async function getQueryEmbedding(text: string): Promise<EmbeddingResult | null> {
  return getProviderEmbedding(text);
}

export type { AiProviderClient } from './types';
