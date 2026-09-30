/**
 * Model Registry — data-driven model definitions with capability metadata.
 *
 * Each model declares its provider, capabilities, and embedding space.
 * The `embeddingSpaceId` is critical: vectors from different spaces are NOT comparable.
 *
 * @module
 */

import type { AiProvider } from "./types";
import type { AiCapability } from "./capabilities";

export type ModelTier = "flagship" | "balanced" | "fast" | "budget";

export interface ModelCapabilities {
  text: boolean;
  streaming: boolean;
  vision: boolean;
  jsonMode: boolean;
  toolCalling: boolean;
  embeddings?: { dimensions: number };
  stt?: boolean;
  tts?: boolean;
  realtime?: boolean;
}

export interface ModelDefinition {
  /** API model id */
  id: string;
  provider: AiProvider;
  /** Human-readable label for UI */
  label: string;
  tier: ModelTier;
  capabilities: ModelCapabilities;
  contextWindow: number;
  pricing?: { inputPer1M?: number; outputPer1M?: number };
  deprecated?: boolean;
  /**
   * Pinned embedding space — vectors from different spaces are NOT comparable.
   * Models sharing an embeddingSpaceId can share a vector index.
   */
  embeddingSpaceId?: string;
}

// ── Model Registry ─────────────────────────────────────────────────────────

export const MODEL_REGISTRY: ModelDefinition[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────────
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1",
    tier: "flagship",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 1_047_576,
    pricing: { inputPer1M: 2.0, outputPer1M: 8.0 },
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 Mini",
    tier: "balanced",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 1_047_576,
    pricing: { inputPer1M: 0.4, outputPer1M: 1.6 },
  },
  {
    id: "gpt-4.1-nano",
    provider: "openai",
    label: "GPT-4.1 Nano",
    tier: "fast",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 1_047_576,
    pricing: { inputPer1M: 0.1, outputPer1M: 0.4 },
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    tier: "balanced",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 128_000,
    pricing: { inputPer1M: 2.5, outputPer1M: 10.0 },
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    label: "GPT-4o Mini",
    tier: "fast",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 128_000,
    pricing: { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
  {
    id: "text-embedding-3-small",
    provider: "openai",
    label: "Embedding 3 Small",
    tier: "balanced",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, embeddings: { dimensions: 1536 } },
    contextWindow: 8_191,
    embeddingSpaceId: "openai-te3-small-1536",
  },
  {
    id: "text-embedding-3-large",
    provider: "openai",
    label: "Embedding 3 Large",
    tier: "flagship",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, embeddings: { dimensions: 3072 } },
    contextWindow: 8_191,
    embeddingSpaceId: "openai-te3-large-3072",
  },
  {
    id: "whisper-1",
    provider: "openai",
    label: "Whisper STT",
    tier: "balanced",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, stt: true },
    contextWindow: 0,
  },
  {
    id: "gpt-4o-transcribe",
    provider: "openai",
    label: "GPT-4o Transcribe",
    tier: "balanced",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, stt: true },
    contextWindow: 0,
  },
  {
    id: "tts-1",
    provider: "openai",
    label: "TTS",
    tier: "balanced",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, tts: true },
    contextWindow: 0,
  },
  {
    id: "gpt-4o-mini-tts",
    provider: "openai",
    label: "GPT-4o Mini TTS",
    tier: "fast",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, tts: true },
    contextWindow: 0,
  },

  // ── Gemini ──────────────────────────────────────────────────────────────
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    tier: "flagship",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 1_048_576,
  },
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    tier: "balanced",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 1_048_576,
  },
  {
    id: "gemini-embedding-2",
    provider: "gemini",
    label: "Gemini Embedding 2",
    tier: "balanced",
    capabilities: { text: false, streaming: false, vision: true, jsonMode: false, toolCalling: false, embeddings: { dimensions: 768 } },
    contextWindow: 2_048,
    embeddingSpaceId: "gemini-embed-2-768",
  },

  // ── Claude ──────────────────────────────────────────────────────────────
  {
    id: "claude-opus-4-20250514",
    provider: "claude",
    label: "Claude Opus 4",
    tier: "flagship",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 200_000,
  },
  {
    id: "claude-sonnet-4-20250514",
    provider: "claude",
    label: "Claude Sonnet 4",
    tier: "balanced",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 200_000,
  },
  {
    id: "claude-haiku-4-5-20251001",
    provider: "claude",
    label: "Claude Haiku 4.5",
    tier: "fast",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 200_000,
  },

  // ── Mistral ────────────────────────────────────────────────────────────
  {
    id: "mistral-large-3",
    provider: "mistral",
    label: "Mistral Large 3",
    tier: "flagship",
    capabilities: { text: true, streaming: true, vision: false, jsonMode: true, toolCalling: true },
    contextWindow: 128_000,
  },
  {
    id: "mistral-small",
    provider: "mistral",
    label: "Mistral Small",
    tier: "fast",
    capabilities: { text: true, streaming: true, vision: false, jsonMode: true, toolCalling: true },
    contextWindow: 32_000,
  },
  {
    id: "mistral-embed",
    provider: "mistral",
    label: "Mistral Embed",
    tier: "balanced",
    capabilities: { text: false, streaming: false, vision: false, jsonMode: false, toolCalling: false, embeddings: { dimensions: 1024 } },
    contextWindow: 8_192,
    embeddingSpaceId: "mistral-embed-1024",
  },

  // ── OpenRouter ──────────────────────────────────────────────────────────
  {
    id: "openai/gpt-4o-mini",
    provider: "openrouter",
    label: "GPT-4o Mini (OpenRouter)",
    tier: "fast",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 128_000,
  },
  {
    id: "openai/gpt-4o",
    provider: "openrouter",
    label: "GPT-4o (OpenRouter)",
    tier: "balanced",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 128_000,
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    provider: "openrouter",
    label: "Claude 3.5 Sonnet (OpenRouter)",
    tier: "balanced",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 200_000,
  },
  {
    id: "anthropic/claude-3-haiku",
    provider: "openrouter",
    label: "Claude 3 Haiku (OpenRouter)",
    tier: "fast",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 200_000,
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    provider: "openrouter",
    label: "Gemini 2.0 Flash (Free)",
    tier: "budget",
    capabilities: { text: true, streaming: true, vision: true, jsonMode: true, toolCalling: true },
    contextWindow: 1_048_576,
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    provider: "openrouter",
    label: "Llama 3.1 8B (Free)",
    tier: "budget",
    capabilities: { text: true, streaming: true, vision: false, jsonMode: false, toolCalling: false },
    contextWindow: 128_000,
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    provider: "openrouter",
    label: "Mistral 7B (Free)",
    tier: "budget",
    capabilities: { text: true, streaming: true, vision: false, jsonMode: false, toolCalling: false },
    contextWindow: 32_000,
  },
];

// ── Lookup Helpers ─────────────────────────────────────────────────────────

export function getModelsForProvider(provider: AiProvider): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider && !m.deprecated);
}

export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function getEmbeddingModels(): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.capabilities.embeddings && !m.deprecated);
}

export function getModelsByCapability(cap: AiCapability): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => {
    if (m.deprecated) return false;
    switch (cap) {
      case "text": return m.capabilities.text;
      case "streaming": return m.capabilities.streaming;
      case "embedding": return !!m.capabilities.embeddings;
      case "stt": return !!m.capabilities.stt;
      case "tts": return !!m.capabilities.tts;
      case "realtime_voice": return !!m.capabilities.realtime;
      case "model_discovery": return true; // all providers can be checked
    }
  });
}

export function getEmbeddingSpaceId(modelId: string): string | undefined {
  return getModelById(modelId)?.embeddingSpaceId;
}

export function getEmbeddingDimensions(modelId: string): number | undefined {
  return getModelById(modelId)?.capabilities.embeddings?.dimensions;
}
