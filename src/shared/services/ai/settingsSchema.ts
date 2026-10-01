/**
 * AI Settings Schema — documentation for all AI-related settings keys.
 *
 * This module documents the settings keys used by the AI capability architecture.
 * It serves as a reference for the settings UI and for migration scripts.
 *
 * @module
 */

// ── Core AI Settings ───────────────────────────────────────────────────────

export const AI_SETTINGS_SCHEMA = {
  // Provider selection
  ai_provider: {
    type: 'string',
    secure: false,
    description: 'Active AI provider',
    options: [
      'claude',
      'openai',
      'gemini',
      'mistral',
      'ollama',
      'copilot',
      'custom',
      'lmstudio',
      'openrouter',
    ],
  },
  ai_enabled: { type: 'boolean', secure: false, description: 'Master AI toggle' },
  ai_language: {
    type: 'string',
    secure: false,
    description: 'Response language',
    options: ['auto', 'en', 'fr', 'ar', 'ja', 'it'],
  },

  // Feature toggles
  ai_auto_categorize: { type: 'boolean', secure: false, description: 'Auto-categorize threads' },
  ai_auto_summarize: { type: 'boolean', secure: false, description: 'Auto-summarize threads' },
  ai_smart_replies_enabled: { type: 'boolean', secure: false, description: 'Smart replies toggle' },
  ai_ask_inbox_enabled: { type: 'boolean', secure: false, description: 'Ask Inbox toggle' },
  ai_auto_draft_enabled: { type: 'boolean', secure: false, description: 'Auto-draft toggle' },
  ai_writing_style_enabled: { type: 'boolean', secure: false, description: 'Writing style toggle' },

  // API Keys (encrypted)
  claude_api_key: { type: 'string', secure: true, description: 'Anthropic API key' },
  openai_api_key: { type: 'string', secure: true, description: 'OpenAI API key' },
  gemini_api_key: { type: 'string', secure: true, description: 'Google AI API key' },
  mistral_api_key: { type: 'string', secure: true, description: 'Mistral API key' },
  byteplus_api_key: { type: 'string', secure: true, description: 'BytePlus API key' },
  copilot_api_key: { type: 'string', secure: true, description: 'GitHub PAT' },
  openrouter_api_key: { type: 'string', secure: true, description: 'OpenRouter API key' },
  custom_api_key: { type: 'string', secure: true, description: 'Custom provider key' },

  // Model selection
  claude_model: { type: 'string', secure: false, description: 'Claude model ID' },
  openai_model: { type: 'string', secure: false, description: 'OpenAI model ID' },
  gemini_model: { type: 'string', secure: false, description: 'Gemini model ID' },
  mistral_model: { type: 'string', secure: false, description: 'Mistral model ID' },
  byteplus_model: { type: 'string', secure: false, description: 'BytePlus model ID' },
  copilot_model: { type: 'string', secure: false, description: 'Copilot model ID' },
  openrouter_model: { type: 'string', secure: false, description: 'OpenRouter model ID' },
  custom_model: { type: 'string', secure: false, description: 'Custom provider model' },

  // Ollama settings
  ollama_server_url: { type: 'string', secure: false, description: 'Ollama URL' },
  ollama_model: { type: 'string', secure: false, description: 'Ollama model' },

  // LM Studio settings
  lmstudio_server_url: { type: 'string', secure: false, description: 'LM Studio URL' },
  lmstudio_model: { type: 'string', secure: false, description: 'LM Studio chat model' },
  lmstudio_embedding_model: {
    type: 'string',
    secure: false,
    description: 'LM Studio embedding model',
  },

  // Custom provider settings
  custom_base_url: { type: 'string', secure: false, description: 'Custom provider URL' },

  // Voice settings
  voice_provider: {
    type: 'string',
    secure: false,
    description: 'Voice provider',
    options: ['browser', 'openai', 'elevenlabs', 'lmstudio', 'custom', 'agent-core'],
  },
  voice_base_url: { type: 'string', secure: false, description: 'Voice base URL' },
  voice_api_key: { type: 'string', secure: true, description: 'Voice API key' },
  voice_tts_voice: { type: 'string', secure: false, description: 'TTS voice name' },
  voice_stt_model: { type: 'string', secure: false, description: 'STT model name' },
  voice_tts_enabled: { type: 'boolean', secure: false, description: 'TTS toggle' },
  voice_stt_enabled: { type: 'boolean', secure: false, description: 'STT toggle' },

  // RAG settings
  rag_chunk_size: { type: 'string', secure: false, description: 'RAG chunk size' },
  rag_chunk_overlap: { type: 'string', secure: false, description: 'RAG chunk overlap' },
  rag_splitter: { type: 'string', secure: false, description: 'RAG splitter type' },

  // Task routing (NEW - Phase 2)
  ai_task_routes: { type: 'json', secure: false, description: 'User task routing overrides' },

  // Provider capabilities (NEW - Phase 1)
  ai_provider_capabilities: {
    type: 'json',
    secure: false,
    description: 'Cached provider capability detection',
  },

  // Embedding settings (NEW - Phase 5)
  embedding_source: {
    type: 'string',
    secure: false,
    description: 'Embedding source',
    options: ['rust_bge', 'provider', 'auto'],
  },
  embedding_dims: { type: 'number', secure: false, description: 'Cached embedding dimension' },
} as const;

export type AiSettingKey = keyof typeof AI_SETTINGS_SCHEMA;

// ── Settings Migration Helpers ─────────────────────────────────────────────

/**
 * Get all secure setting keys (encrypted at rest).
 */
export function getSecureSettingKeys(): string[] {
  return Object.entries(AI_SETTINGS_SCHEMA)
    .filter(([, config]) => config.secure)
    .map(([key]) => key);
}

/**
 * Get all setting keys for a specific provider.
 */
export function getProviderSettingKeys(provider: string): string[] {
  const keys: string[] = [];
  for (const [key] of Object.entries(AI_SETTINGS_SCHEMA)) {
    if (key.startsWith(`${provider}_`)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Validate a setting value against its schema.
 */
export function validateSetting(key: string, value: string): boolean {
  const config = AI_SETTINGS_SCHEMA[key as AiSettingKey];
  if (!config) return true; // Unknown keys pass through

  switch (config.type) {
    case 'boolean':
      return value === 'true' || value === 'false';
    case 'number':
      return !Number.isNaN(Number(value));
    case 'json':
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case 'string':
      if ('options' in config && config.options) {
        return (config.options as readonly string[]).includes(value);
      }
      return true;
    default:
      return true;
  }
}
