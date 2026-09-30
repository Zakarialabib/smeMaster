/**
 * Capability interfaces — narrow, composable contracts for AI providers.
 *
 * Instead of one fat `AiProviderClient` that every provider partially implements,
 * each capability is its own interface. A provider implements only the ones it supports.
 *
 * @module
 */

import type { AiCompletionRequest, AiEmbeddingRequest, ModelOption } from "./types";

// ── Capability Interfaces ──────────────────────────────────────────────────

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
  getEmbeddings(req: AiEmbeddingRequest): Promise<number[][] | null>;
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
  | "model_discovery";

// ── Provider Capability Declaration ────────────────────────────────────────

export interface ProviderCapabilities {
  provider: string;
  capabilities: AiCapability[];
  embeddingDims?: number;
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
