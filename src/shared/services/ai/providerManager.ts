import { getSetting, getSecureSetting } from '@features/settings/db/settings';
import { AiError } from './errors';
import type { AiProvider, AiProviderClient, TestEmbeddingResult } from './types';
import { DEFAULT_MODELS, MODEL_SETTINGS } from './types';
import { createClaudeProvider, clearClaudeProvider } from './providers/claudeProvider';
import { createOpenAIProvider, clearOpenAIProvider } from './providers/openaiProvider';
import { createGeminiProvider, clearGeminiProvider } from './providers/geminiProvider';
import { createMistralProvider, clearMistralProvider } from './providers/mistralProvider';
import { createBytePlusProvider, clearBytePlusProvider } from './providers/byteplusProvider';
import { createOllamaProvider, clearOllamaProvider } from './providers/ollamaProvider';
import { createCopilotProvider, clearCopilotProvider } from './providers/copilotProvider';
import { createCustomProvider } from './providers/customProvider';
import {
  createLMStudioProvider,
  clearLMStudioProvider,
  testEmbedding,
} from './providers/lmstudioProvider';
import { createOpenRouterProvider, clearOpenRouterProvider } from './providers/openrouterProvider';
import {
  isTextCapable,
  isEmbeddingCapable,
  isStructuredOutputCapable,
  isToolCallingCapable,
  isReasoningCapable,
  isStreamingCapable,
  type AiCapability,
} from './capabilities';

const API_KEY_SETTINGS: Record<
  Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio' | 'local'>,
  string
> = {
  claude: 'claude_api_key',
  openai: 'openai_api_key',
  gemini: 'gemini_api_key',
  mistral: 'mistral_api_key',
  byteplus: 'byteplus_api_key',
  copilot: 'copilot_api_key',
  openrouter: 'openrouter_api_key',
};

let cachedProvider: { name: AiProvider; key: string; client: AiProviderClient } | null = null;

export async function getActiveProviderName(): Promise<AiProvider> {
  const setting = await getSetting('ai_provider');
  if (
    setting === 'openai' ||
    setting === 'gemini' ||
    setting === 'mistral' ||
    setting === 'byteplus' ||
    setting === 'ollama' ||
    setting === 'copilot' ||
    setting === 'lmstudio' ||
    setting === 'openrouter'
  )
    return setting;
  if (setting === 'custom') {
    const apiKey = await getSecureSetting('custom_api_key');
    if (apiKey) return 'custom';
  }
  return 'claude';
}

export async function getActiveProvider(): Promise<AiProviderClient> {
  const providerName = await getActiveProviderName();
  const aiLanguage = (await getSetting('ai_language')) ?? 'auto';

  if (providerName === 'local') {
    // `local` is not a chat provider — it holds the on-device speech models
    // (sherpa-onnx STT/TTS), which are reached through `voiceService`, not this
    // router. It also has no API-key or model setting, so the generic path
    // below cannot index for it. Fail with a clear message rather than an
    // undefined-settings error.
    throw new AiError(
      'NOT_CONFIGURED',
      'Local is not a chat provider — it serves on-device speech models only',
    );
  }

  if (providerName === 'ollama') {
    const serverUrl = (await getSetting('ollama_server_url')) ?? 'http://localhost:11434';
    const model = (await getSetting('ollama_model')) ?? 'llama3.2';
    const cacheKey = `${serverUrl}|${model}|${aiLanguage}`;

    if (cachedProvider && cachedProvider.name === 'ollama' && cachedProvider.key === cacheKey) {
      return cachedProvider.client;
    }

    const client = createOllamaProvider(serverUrl, model, aiLanguage);
    cachedProvider = { name: 'ollama', key: cacheKey, client };
    return client;
  }

  if (providerName === 'lmstudio') {
    const serverUrl = (await getSetting('lmstudio_server_url')) ?? 'http://localhost:1234';
    const model = (await getSetting('lmstudio_model')) ?? '';
    const embeddingModel = (await getSetting('lmstudio_embedding_model')) ?? '';
    const cacheKey = `${serverUrl}|${model}|${embeddingModel}|${aiLanguage}`;

    if (cachedProvider && cachedProvider.name === 'lmstudio' && cachedProvider.key === cacheKey) {
      return cachedProvider.client;
    }

    const client = createLMStudioProvider(
      serverUrl,
      { chatModel: model, embeddingModel },
      aiLanguage,
    );
    cachedProvider = { name: 'lmstudio', key: cacheKey, client };
    return client;
  }

  if (providerName === 'custom') {
    const baseUrl = (await getSetting('custom_base_url')) ?? 'https://api.openai.com/v1';
    const apiKey = await getSecureSetting('custom_api_key');
    if (!apiKey) {
      throw new AiError('NOT_CONFIGURED', 'Custom AI provider API key not configured');
    }
    const model = (await getSetting('custom_model')) ?? 'gpt-4o-mini';
    const cacheKey = `${baseUrl}|${apiKey}|${model}|${aiLanguage}`;

    if (cachedProvider && cachedProvider.name === 'custom' && cachedProvider.key === cacheKey) {
      return cachedProvider.client;
    }

    const client = createCustomProvider(baseUrl, apiKey, model, aiLanguage);
    cachedProvider = { name: 'custom', key: cacheKey, client };
    return client;
  }

  const keySetting = API_KEY_SETTINGS[providerName];
  const apiKey = await getSecureSetting(keySetting);

  if (!apiKey) {
    throw new AiError('NOT_CONFIGURED', `${providerName} API key not configured`);
  }

  const model = (await getSetting(MODEL_SETTINGS[providerName])) ?? DEFAULT_MODELS[providerName];
  const cacheKey = `${apiKey}|${model}|${aiLanguage}`;

  if (cachedProvider && cachedProvider.name === providerName && cachedProvider.key === cacheKey) {
    return cachedProvider.client;
  }

  let client: AiProviderClient;
  switch (providerName) {
    case 'claude':
      client = createClaudeProvider(apiKey, model, aiLanguage);
      break;
    case 'openai':
      client = createOpenAIProvider(apiKey, model, aiLanguage);
      break;
    case 'gemini':
      client = createGeminiProvider(apiKey, model, aiLanguage);
      break;
    case 'mistral':
      client = createMistralProvider(apiKey, model, aiLanguage);
      break;
    case 'byteplus':
      client = createBytePlusProvider(apiKey, model, aiLanguage);
      break;
    case 'copilot':
      client = createCopilotProvider(apiKey, model, aiLanguage);
      break;
    case 'openrouter':
      client = createOpenRouterProvider(apiKey, model, aiLanguage);
      break;
  }

  cachedProvider = { name: providerName, key: cacheKey, client };
  return client;
}

/**
 * Get a streaming-capable client for the active provider.
 *
 * Returns the provider client if it supports `streamComplete`, otherwise
 * throws an `AiError` with a clear message. Use this before calling
 * `streamAi()` to fail fast with a user-friendly error.
 */
export async function streamActiveProvider(): Promise<AiProviderClient> {
  const client = await getActiveProvider();
  if (isStreamingCapable(client)) {
    return client;
  }
  const name = await getActiveProviderName();
  throw new AiError(
    'STREAMING_UNSUPPORTED',
    `${name} does not support streaming. Switch to a provider that supports it (OpenAI, Claude, Gemini, etc.).`,
  );
}

export async function isAiAvailable(): Promise<boolean> {
  try {
    const enabled = await getSetting('ai_enabled');
    if (enabled === 'false') return false;
    const providerName = await getActiveProviderName();

    if (providerName === 'ollama') {
      const serverUrl = await getSetting('ollama_server_url');
      return !!serverUrl;
    }

    if (providerName === 'lmstudio') {
      const serverUrl = await getSetting('lmstudio_server_url');
      return !!serverUrl;
    }

    if (providerName === 'custom') {
      const key = await getSecureSetting('custom_api_key');
      return !!key;
    }

    if (providerName === 'local') {
      // `local` has no API key. "Configured" for it means an on-device speech
      // model directory is set — the thing that actually gates its use.
      const ttsDir = await getSetting('voice_offline_tts_dir');
      const sttDir = await getSetting('voice_offline_stt_dir');
      return !!(ttsDir || sttDir);
    }

    const keySetting = API_KEY_SETTINGS[providerName];
    const key = await getSecureSetting(keySetting);
    return !!key;
  } catch {
    return false;
  }
}

export function clearProviderClients(): void {
  cachedProvider = null;
  clearClaudeProvider();
  clearOpenAIProvider();
  clearGeminiProvider();
  clearMistralProvider();
  clearBytePlusProvider();
  clearOllamaProvider();
  clearLMStudioProvider();
  clearCopilotProvider();
  clearOpenRouterProvider();
}

/**
 * Validate the configured LM Studio embedding model by embedding a test string.
 * Reads the `lmstudio_server_url` + `lmstudio_embedding_model` settings and
 * delegates to the provider's `testEmbedding`. Used by the AI settings UI.
 */
export async function testLMStudioEmbedding(): Promise<TestEmbeddingResult> {
  const serverUrl = (await getSetting('lmstudio_server_url')) ?? 'http://localhost:1234';
  const embeddingModel = (await getSetting('lmstudio_embedding_model')) ?? '';
  return testEmbedding(serverUrl, embeddingModel || undefined);
}

// ── Capability-Aware Resolution ───────────────────────────────────────────

/**
 * Check if the active provider supports a specific capability.
 */
export async function isCapabilityAvailable(cap: AiCapability): Promise<boolean> {
  try {
    const provider = await getActiveProvider();
    switch (cap) {
      case 'text':
        return isTextCapable(provider);
      case 'embedding':
        return isEmbeddingCapable(provider);
      case 'structured_output':
        return isStructuredOutputCapable(provider);
      case 'tool_calling':
        return isToolCallingCapable(provider);
      case 'reasoning':
        return isReasoningCapable(provider);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Get a provider client for a specific provider and model.
 * Used when the user explicitly selects a provider/model in a chat surface.
 */
export async function getProviderClient(
  provider: AiProvider,
  model?: string,
): Promise<AiProviderClient> {
  const aiLanguage = (await getSetting('ai_language')) ?? 'auto';

  if (provider === 'ollama') {
    const serverUrl = (await getSetting('ollama_server_url')) ?? 'http://localhost:11434';
    const ollamaModel = model ?? (await getSetting('ollama_model')) ?? 'llama3.2';
    return createOllamaProvider(serverUrl, ollamaModel, aiLanguage);
  }

  if (provider === 'lmstudio') {
    const serverUrl = (await getSetting('lmstudio_server_url')) ?? 'http://localhost:1234';
    const lmModel = model ?? (await getSetting('lmstudio_model')) ?? '';
    const lmEmb = (await getSetting('lmstudio_embedding_model')) ?? '';
    return createLMStudioProvider(
      serverUrl,
      { chatModel: lmModel, embeddingModel: lmEmb },
      aiLanguage,
    );
  }

  if (provider === 'custom') {
    const baseUrl = (await getSetting('custom_base_url')) ?? 'https://api.openai.com/v1';
    const apiKey = await getSecureSetting('custom_api_key');
    if (!apiKey) throw new AiError('NOT_CONFIGURED', 'Custom AI provider API key not configured');
    const customModel = model ?? (await getSetting('custom_model')) ?? 'gpt-4o-mini';
    return createCustomProvider(baseUrl, apiKey, customModel, aiLanguage);
  }

  const keySetting =
    API_KEY_SETTINGS[provider as Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio' | 'local'>];
  const apiKey = await getSecureSetting(keySetting);
  if (!apiKey) throw new AiError('NOT_CONFIGURED', `${provider} API key not configured`);

  const modelSetting =
    MODEL_SETTINGS[provider as Exclude<AiProvider, 'ollama' | 'custom' | 'lmstudio' | 'local'>];
  const selectedModel = model ?? (await getSetting(modelSetting)) ?? DEFAULT_MODELS[provider];
  switch (provider) {
    case 'claude':
      return createClaudeProvider(apiKey, selectedModel, aiLanguage);
    case 'openai':
      return createOpenAIProvider(apiKey, selectedModel, aiLanguage);
    case 'gemini':
      return createGeminiProvider(apiKey, selectedModel, aiLanguage);
    case 'mistral':
      return createMistralProvider(apiKey, selectedModel, aiLanguage);
    case 'byteplus':
      return createBytePlusProvider(apiKey, selectedModel, aiLanguage);
    case 'copilot':
      return createCopilotProvider(apiKey, selectedModel, aiLanguage);
    case 'openrouter':
      return createOpenRouterProvider(apiKey, selectedModel, aiLanguage);
    default:
      throw new AiError('NOT_CONFIGURED', `Unknown provider: ${provider}`);
  }
}
