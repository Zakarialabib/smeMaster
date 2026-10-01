import type { EmbeddingResult } from './capabilities';

export type AiProvider =
  | 'claude'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'byteplus'
  | 'ollama'
  | 'copilot'
  | 'custom'
  | 'lmstudio'
  | 'openrouter';

export interface AiCompletionRequest {
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
}

export interface AiEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface AiProviderClient {
  complete(req: AiCompletionRequest): Promise<string>;
  testConnection(): Promise<boolean>;

  /**
   * Generate embeddings for the given text input.
   * Returns an EmbeddingResult with space pinning info.
   * If the provider does not support embeddings, returns null.
   */
  getEmbeddings?(req: AiEmbeddingRequest): Promise<EmbeddingResult | null>;
}

/** Options for the LM Studio provider. `embeddingModel` is the model loaded in
 *  LM Studio for `/v1/embeddings` (usually distinct from the chat `chatModel`). */
export interface LMStudioProviderOptions {
  chatModel: string;
  embeddingModel?: string;
}

/** Result of a lightweight embedding-endpoint health check. */
export interface TestEmbeddingResult {
  ok: boolean;
  dims?: number;
  error?: string;
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  claude: 'claude-sonnet-5-5',
  openai: 'gpt-6.1-sol',
  gemini: 'gemini-3.8-flash',
  mistral: 'mistral-medium-3.5',
  byteplus: 'doubao-seed-2.1-pro',
  ollama: 'llama3.2',
  copilot: 'openai/gpt-6.1-sol',
  custom: 'gpt-6.1-sol',
  lmstudio: '',
  openrouter: 'openai/gpt-6.1-sol',
};

export interface ModelOption {
  id: string;
  label: string;
}

export const PROVIDER_MODELS: Record<
  Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio'>,
  ModelOption[]
> = {
  claude: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (coming soon)' },
    { id: 'claude-opus-5', label: 'Claude Opus 5' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  ],
  openai: [
    { id: 'gpt-6-astra', label: 'GPT-6 Astra (Flagship)' },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol (Balanced)' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna (High-volume)' },
    { id: 'gpt-6-sol', label: 'GPT-6 Sol (Legacy)' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
  ],
  gemini: [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    { id: 'gemini-3.8-flash-lite', label: 'Gemini 3.8 Flash-Lite' },
    { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Legacy)' },
  ],
  mistral: [
    { id: 'mistral-medium-3.5', label: 'Mistral Medium 3.5 (128B)' },
    { id: 'mistral-small-4', label: 'Mistral Small 4 (119B MoE)' },
    { id: 'mistral-large-3', label: 'Mistral Large 3 (675B MoE)' },
    { id: 'mistral-embed', label: 'Mistral Embed' },
    { id: 'voxtral-realtime', label: 'Voxtral Realtime (STT)' },
  ],
  byteplus: [
    { id: 'doubao-seed-2.1-pro', label: 'Doubao Seed 2.1 Pro' },
    { id: 'doubao-seed-2.1-turbo', label: 'Doubao Seed 2.1 Turbo' },
    { id: 'doubao-seed-2.1-lite', label: 'Doubao Seed 2.1 Lite' },
    { id: 'doubao-seed-evolving', label: 'Doubao Seed Evolving' },
  ],
  copilot: [
    { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol (Low)' },
    { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna (Low)' },
    { id: 'openai/gpt-6-astra', label: 'GPT-6 Astra (High)' },
    { id: 'anthropic/claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  ],
  openrouter: [
    { id: 'openai/gpt-6.1-sol', label: 'GPT-6.1 Sol (OpenRouter)' },
    { id: 'openai/gpt-6-astra', label: 'GPT-6 Astra (OpenRouter)' },
    { id: 'anthropic/claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (OpenRouter)' },
    { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash (OpenRouter)' },
    { id: 'mistralai/mistral-medium-3.5', label: 'Mistral Medium 3.5 (OpenRouter)' },
  ],
};

export const MODEL_SETTINGS: Record<
  Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio'>,
  string
> = {
  claude: 'claude_model',
  openai: 'openai_model',
  gemini: 'gemini_model',
  mistral: 'mistral_model',
  byteplus: 'byteplus_model',
  copilot: 'copilot_model',
  openrouter: 'openrouter_model',
};
