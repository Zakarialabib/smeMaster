/**
 * RAG Context Integration — Bridge between the local RAG knowledge base and existing AI features.
 *
 * Provides utilities to enrich AI prompts with relevant context from indexed emails,
 * attachments, and vault documents.
 *
 * @module
 */

import { aiQueryRag } from "@shared/services/db/invoke/rag";
import { getProviderEmbedding } from "./embeddingService";

/**
 * Fetch relevant RAG context for a given query.
 * Uses the active embedding source (provider or Rust backend).
 *
 * @param query - The search query (usually the email subject + key terms)
 * @returns Context string with relevant knowledge base snippets, or empty string if unavailable
 */
export async function fetchRagContext(query: string): Promise<string> {
  if (!query.trim()) return "";

  try {
    const result = await aiQueryRag(query.slice(0, 500));
    return result || "";
  } catch {
    return "";
  }
}

/**
 * Check if RAG might have relevant context for a given topic.
 * Returns a boolean (no throw).
 */
export async function hasRagContext(query: string): Promise<boolean> {
  try {
    const context = await fetchRagContext(query);
    return context.length > 50; // Minimum meaningful context
  } catch {
    return false;
  }
}

/**
 * Enrich an AI system prompt with RAG knowledge base context.
 * Appends relevant context from indexed emails/documents if available.
 *
 * @param basePrompt - The original system prompt
 * @param contextQuery - What to search for in the knowledge base
 * @returns The enriched prompt with RAG context appended (or original if search fails)
 */
export async function enrichPromptWithRag(
  basePrompt: string,
  contextQuery: string,
): Promise<string> {
  if (!contextQuery.trim()) return basePrompt;

  try {
    const ragContext = await fetchRagContext(contextQuery);
    if (ragContext && ragContext.length > 50) {
      return `${basePrompt}\n\n---\nRelevant context from your knowledge base:\n${ragContext}\n---`;
    }
  } catch {
    // RAG unavailable — fall through to base prompt
  }

  return basePrompt;
}

/**
 * Build a combined RAG + user context for inbox/reply features.
 * Merges FTS results with vector search results.
 *
 * @param ftsContext - Context from full-text search (FTS)
 * @param ragQuery - Additional query for vector search
 * @returns Combined context string
 */
export async function buildFusedContext(
  ftsContext: string,
  ragQuery: string,
): Promise<string> {
  let combined = ftsContext;

  try {
    const ragContext = await fetchRagContext(ragQuery);
    if (ragContext && ragContext.length > 50) {
      combined += `\n\n---\nAdditional context from knowledge base:\n${ragContext}`;
    }
  } catch {
    // RAG unavailable — use FTS only
  }

  return combined;
}

/**
 * Search the knowledge base using a provider-generated embedding (LM Studio / Ollama / etc.).
 * Useful for testing RAG without downloading the BGE-small model.
 *
 * @param query - The search query
 * @returns relevant context string, or empty string if unavailable
 */
export async function fetchRagContextWithProviderEmbedding(query: string): Promise<string> {
  if (!query.trim()) return "";

  try {
    const providerEmbedding = await getProviderEmbedding(query);
    if (!providerEmbedding) {
      // Fall back to standard RAG
      return fetchRagContext(query);
    }

    const { aiSearchByVector } = await import("@shared/services/db/invoke/rag");
    const result = await aiSearchByVector(providerEmbedding.vector, query);
    return result || "";
  } catch {
    return "";
  }
}
