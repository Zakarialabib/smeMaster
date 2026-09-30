/**
 * Capability interfaces — narrow, composable contracts for AI providers.
 *
 * Instead of one fat `AiProviderClient` that every provider partially implements,
 * each capability is its own interface. A provider implements only the ones it supports.
 *
 * Extended with 6 new capabilities and 4 cross-cutting concerns:
 * - StructuredOutputCapable (Zod schema validation)
 * - ToolCallingCapable (function calling)
 * - ReasoningCapable (reasoning effort control)
 * - VisionCapable (multimodal input)
 * - ContextCachingCapable (context caching)
 * - BatchProcessingCapable (batch processing)
 * - Embedding space pinning (EmbeddingResult with spaceId)
 * - Fallback chains (array, not single)
 * - Cost-aware routing
 * - Rate-limit retry semantics
 *
 * @module
 */

import type { z } from "zod";
import type { AiCompletionRequest, AiEmbeddingRequest, ModelOption } from "./types";

// ── Original Capability Interfaces ─────────────────────────────────────────

/** Text completion — the baseline capability all remote providers support. */
export interface TextCapable {
  complete(req: AiCompletionRequest): Promise<string>;
}

/** Streaming text completion — live token-by-token output. */
export interface StreamingCapable {
  streamComplete(req: AiCompletionRequest): AsyncIterable<string>;
}

/** Embedding generation — for RAG and semantic search. */
export interface EmbeddingCapable {
  getEmbeddings(req: AiEmbeddingRequest): Promise<EmbeddingResult | null>;
}

/** Speech-to-text — transcribe audio to text. */
export interface SpeechToTextCapable {
  transcribe(audio: Blob, options?: SttOptions): Promise<string>;
}

/** Text-to-speech — synthesize audio from text. */
export interface TextToSpeechCapable {
  synthesize(text: string, options?: TtsOptions): Promise<Blob>;
}

/** Realtime voice — bidirectional voice sessions. */
export interface RealtimeVoiceCapable {
  startRealtimeSession(options?: RealtimeOptions): Promise<RealtimeVoiceSession>;
}

/** Model discovery — list available models from the provider. */
export interface ModelDiscoveryCapable {
  listModels(): Promise<ModelOption[]>;
}

/** Connection health check. */
export interface ConnectionTestable {
  testConnection(): Promise<boolean>;
}

// ── New Capability Interfaces ──────────────────────────────────────────────

/**
 * Structured output — guaranteed schema-conformant JSON output.
 * Uses Zod for schema validation. Provider-adaptive schema enforcement:
 * - OpenAI: response_format: { type: "json_schema", strict: true }
 * - Gemini: responseSchema
 * - Mistral: response_format: { type: "json_object" }
 * - Anthropic: forced tool calls
 */
export interface StructuredOutputCapable {
  completeStructured<T>(
    req: AiCompletionRequest,
    schema: z.ZodSchema<T>,
    options?: { strict?: boolean }
  ): Promise<T>;
}

/**
 * Tool calling / function calling — for agentic workflows.
 * OpenAI has the deepest function-calling stack; Gemini, Mistral, BytePlus all support it.
 */
export interface ToolCallingCapable {
  completeWithTools(
    req: AiCompletionRequest,
    tools: ToolDefinition[],
    options?: { toolChoice?: "auto" | "required" | "none" | { name: string } }
  ): Promise<ToolCallResult>;
}

/**
 * Reasoning effort control — cost lever for task routing.
 * GPT-6 Sol: reasoning_effort; Gemini 3.8: Extended Thinking; Mistral: reasoning modes.
 */
export type ReasoningEffort = "none" | "low" | "medium" | "high";

export interface ReasoningCapable {
  completeWithReasoning(
    req: AiCompletionRequest,
    effort: ReasoningEffort
  ): Promise<string>;
}

/**
 * Multimodal input (vision) — for email attachments, scanned documents, screenshots.
 * Gemini Embedding 2 maps text, images, video, audio, PDFs into a single embedding space.
 */
export interface VisionCapable {
  completeWithImage(
    req: AiCompletionRequest,
    image: Blob,
    options?: { detail?: "low" | "high" }
  ): Promise<string>;
}

/**
 * Context caching — cost reduction on repeated prompts.
 * OpenAI: cached input at 90% discount; Gemini: context caching; Mistral: cached input at 10%.
 */
export interface ContextCachingCapable {
  completeWithCachedContext(
    req: AiCompletionRequest,
    cachedContext: string
  ): Promise<string>;
}

/**
 * Batch processing — for bulk email categorization.
 * OpenAI: v1/batch endpoints; Gemini: batch inference; BytePlus: flex (offline inference).
 */
export interface BatchProcessingCapable {
  completeBatch(
    requests: AiCompletionRequest[],
    options?: { maxConcurrent?: number }
  ): Promise<string[]>;
}

// ── Cross-Cutting Types ────────────────────────────────────────────────────

/**
 * Embedding result with space pinning.
 * The `spaceId` is critical: vectors from different spaces are NOT comparable.
 * Swapping models without re-embedding corrupts the index.
 */
export interface EmbeddingResult {
  vectors: number[][];
  spaceId: string;      // e.g. "openai-te3-small-1536"
  dimensions: number;
  modelId: string;
}

/**
 * Tool definition for function calling.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
}

/**
 * Result from a tool-calling completion.
 */
export interface ToolCallResult {
  content: string;
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

/**
 * Fallback chain entry — ordered fallback pool for production resilience.
 */
export interface FallbackEntry {
  provider: string;
  model: string;
}

/**
 * Cost-aware routing information.
 */
export interface CostInfo {
  inputPer1M: number;
  outputPer1M: number;
  cachedInputPer1M?: number;
}

// ── Voice Types ─────────────────────────────────────────────────────────────

export interface SttOptions {
  model?: string;
  language?: string;
}

export interface TtsOptions {
  voice?: string;
  model?: string;
}

export interface RealtimeOptions {
  model?: string;
  voice?: string;
}

export interface RealtimeVoiceSession {
  sendAudio(audio: Blob): void;
  onTranscript(cb: (text: string) => void): void;
  onResponse(cb: (text: string) => void): void;
  close(): void;
}

// ── Capability Union ───────────────────────────────────────────────────────

export type AiCapability =
  | "text"
  | "streaming"
  | "embedding"
  | "stt"
  | "tts"
  | "realtime_voice"
  | "model_discovery"
  | "structured_output"
  | "tool_calling"
  | "reasoning"
  | "vision"
  | "context_caching"
  | "batch_processing";

// ── Provider Capability Declaration ────────────────────────────────────────

export interface ProviderCapabilities {
  provider: string;
  capabilities: AiCapability[];
  embeddingDims?: number;
  embeddingSpaceId?: string;
  costInfo?: CostInfo;
}

// ── Type Guards ────────────────────────────────────────────────────────────

export function isTextCapable(provider: unknown): provider is TextCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "complete" in provider &&
    typeof (provider as TextCapable).complete === "function"
  );
}

export function isStreamingCapable(provider: unknown): provider is StreamingCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "streamComplete" in provider &&
    typeof (provider as StreamingCapable).streamComplete === "function"
  );
}

export function isEmbeddingCapable(provider: unknown): provider is EmbeddingCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "getEmbeddings" in provider &&
    typeof (provider as EmbeddingCapable).getEmbeddings === "function"
  );
}

export function isSpeechToTextCapable(provider: unknown): provider is SpeechToTextCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "transcribe" in provider &&
    typeof (provider as SpeechToTextCapable).transcribe === "function"
  );
}

export function isTextToSpeechCapable(provider: unknown): provider is TextToSpeechCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "synthesize" in provider &&
    typeof (provider as TextToSpeechCapable).synthesize === "function"
  );
}

export function isRealtimeVoiceCapable(provider: unknown): provider is RealtimeVoiceCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "startRealtimeSession" in provider &&
    typeof (provider as RealtimeVoiceCapable).startRealtimeSession === "function"
  );
}

export function isModelDiscoveryCapable(provider: unknown): provider is ModelDiscoveryCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "listModels" in provider &&
    typeof (provider as ModelDiscoveryCapable).listModels === "function"
  );
}

export function isConnectionTestable(provider: unknown): provider is ConnectionTestable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "testConnection" in provider &&
    typeof (provider as ConnectionTestable).testConnection === "function"
  );
}

export function isStructuredOutputCapable(provider: unknown): provider is StructuredOutputCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "completeStructured" in provider &&
    typeof (provider as StructuredOutputCapable).completeStructured === "function"
  );
}

export function isToolCallingCapable(provider: unknown): provider is ToolCallingCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "completeWithTools" in provider &&
    typeof (provider as ToolCallingCapable).completeWithTools === "function"
  );
}

export function isReasoningCapable(provider: unknown): provider is ReasoningCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "completeWithReasoning" in provider &&
    typeof (provider as ReasoningCapable).completeWithReasoning === "function"
  );
}

export function isVisionCapable(provider: unknown): provider is VisionCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "completeWithImage" in provider &&
    typeof (provider as VisionCapable).completeWithImage === "function"
  );
}

export function isContextCachingCapable(provider: unknown): provider is ContextCachingCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "completeWithCachedContext" in provider &&
    typeof (provider as ContextCachingCapable).completeWithCachedContext === "function"
  );
}

export function isBatchProcessingCapable(provider: unknown): provider is BatchProcessingCapable {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "completeBatch" in provider &&
    typeof (provider as BatchProcessingCapable).completeBatch === "function"
  );
}
