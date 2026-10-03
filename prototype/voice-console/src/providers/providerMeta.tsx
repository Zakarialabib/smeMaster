import type { AiProvider, AiCapabilitySlot } from '../types';

/**
 * Display metadata per provider. No API keys, no SDK imports, no runtime
 * dependencies — this file is pure data so any page can import it without
 * pulling in a provider's client library.
 *
 * `color` uses a CSS-var fallback; the design tokens are in
 * src/shared/styles/ui-tokens.ts in the real app.
 */
export interface ProviderMeta {
  label: string;
  short: string;
  color: string;
  /** Which capability slots this provider can plausibly serve. Advisory — the
   *  router does not enforce it; it is here so the catalog can render the
   *  coverage chips without a second lookup. */
  capabilities: AiCapabilitySlot[];
  /** Host shown under the label in the Keys tab. No path, no scheme. */
  baseUrlHost: string;
  docsUrl: string;
}

export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    short: 'OpenAI',
    color: 'var(--accent)',
    capabilities: ['voice.llm', 'voice.stt', 'voice.tts', 'voice.realtime', 'email.classify', 'email.compose', 'email.summarize', 'rag.embedQuery', 'rag.embedDocument'],
    baseUrlHost: 'api.openai.com',
    docsUrl: 'https://platform.openai.com/docs',
  },
  gemini: {
    label: 'Google Gemini',
    short: 'Gemini',
    color: 'var(--ai)',
    capabilities: ['voice.llm', 'voice.stt', 'voice.tts', 'voice.realtime', 'email.classify', 'email.compose', 'email.summarize', 'rag.embedQuery', 'rag.embedDocument'],
    baseUrlHost: 'generativelanguage.googleapis.com',
    docsUrl: 'https://ai.google.dev/docs',
  },
  mistral: {
    label: 'Mistral',
    short: 'Mistral',
    color: '#fa520f',
    capabilities: ['voice.llm', 'voice.stt', 'voice.tts', 'email.classify', 'email.compose', 'rag.embedQuery'],
    baseUrlHost: 'api.mistral.ai',
    docsUrl: 'https://docs.mistral.ai',
  },
  byteplus: {
    label: 'BytePlus ModelArk',
    short: 'BytePlus',
    color: '#3b5bdb',
    capabilities: ['voice.llm', 'voice.stt', 'email.classify'],
    baseUrlHost: 'ark.ap-southeast.bytepluses.com',
    docsUrl: 'https://docs.byteplus.com/en/docs/ModelArk',
  },
  claude: {
    label: 'Anthropic Claude',
    short: 'Claude',
    color: '#cc785c',
    capabilities: ['email.compose', 'email.summarize', 'email.classify'],
    baseUrlHost: 'api.anthropic.com',
    docsUrl: 'https://docs.anthropic.com',
  },
  copilot: {
    label: 'GitHub Copilot',
    short: 'Copilot',
    color: '#24292f',
    capabilities: ['email.compose', 'email.classify'],
    baseUrlHost: 'api.githubcopilot.com',
    docsUrl: 'https://docs.github.com/copilot',
  },
  openrouter: {
    label: 'OpenRouter',
    short: 'OpenRouter',
    color: '#6d28d9',
    capabilities: ['voice.llm', 'email.compose', 'email.classify'],
    baseUrlHost: 'openrouter.ai',
    docsUrl: 'https://openrouter.ai/docs',
  },
  ollama: {
    label: 'Ollama (local)',
    short: 'Ollama',
    color: '#6b7280',
    capabilities: ['voice.llm', 'email.classify'],
    baseUrlHost: 'localhost:11434',
    docsUrl: 'https://ollama.com',
  },
  lmstudio: {
    label: 'LM Studio (local)',
    short: 'LM Studio',
    color: '#0891b2',
    capabilities: ['voice.llm', 'rag.embedQuery', 'rag.embedDocument'],
    baseUrlHost: 'localhost:1234',
    docsUrl: 'https://lmstudio.ai/docs',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    short: 'Custom',
    color: '#57534e',
    capabilities: ['voice.llm', 'email.classify', 'email.compose', 'rag.embedQuery', 'rag.embedDocument'],
    baseUrlHost: 'user-supplied',
    docsUrl: '',
  },
};

/** Stable display order for the catalog and the credential list. */
export const ALL_PROVIDERS: AiProvider[] = [
  'openai',
  'gemini',
  'mistral',
  'byteplus',
  'openrouter',
  'claude',
  'copilot',
  'ollama',
  'lmstudio',
  'custom',
];