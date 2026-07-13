export type AiProvider =
  | "claude"
  | "openai"
  | "gemini"
  | "ollama"
  | "copilot"
  | "custom"
  | "lmstudio"
  | "openrouter";

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
   * Returns an array of vectors (each vector is an array of floats).
   * If the provider does not support embeddings, returns null.
   */
  getEmbeddings?(req: AiEmbeddingRequest): Promise<number[][] | null>;
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
  claude: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.5-flash-preview-05-20",
  ollama: "llama3.2",
  copilot: "openai/gpt-4o-mini",
  custom: "gpt-4o-mini",
  lmstudio: "",
  openrouter: "openai/gpt-4o-mini",
};

export interface ModelOption {
  id: string;
  label: string;
}

export const PROVIDER_MODELS: Record<
  Exclude<AiProvider, "ollama" | "custom" | "lmstudio">,
  ModelOption[]
> = {
  claude: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { id: "gpt-4.1", label: "GPT-4.1" },
  ],
  gemini: [
    { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
  ],
  copilot: [
    { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (Low)" },
    { id: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano (Low)" },
    { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini (High)" },
    { id: "openai/gpt-4o", label: "GPT-4o (High)" },
    { id: "openai/gpt-4.1", label: "GPT-4.1 (High)" },
  ],
  openrouter: [
    { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenRouter)" },
    { id: "openai/gpt-4o", label: "GPT-4o (OpenRouter)" },
    { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (OpenRouter)" },
    { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (OpenRouter)" },
    { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (Free)" },
    { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (Free)" },
    { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B (Free)" },
  ],
};

export const MODEL_SETTINGS: Record<
  Exclude<AiProvider, "ollama" | "custom" | "lmstudio">,
  string
> = {
  claude: "claude_model",
  openai: "openai_model",
  gemini: "gemini_model",
  copilot: "copilot_model",
  openrouter: "openrouter_model",
};
