/**
 * Static provider capability manifest.
 *
 * The runtime capability system (capabilities.ts) discovers capabilities by
 * instantiating providers and running type guards. This static manifest lets
 * the UI show capabilities WITHOUT instantiating providers — no API key
 * needed, no network call, no side effects.
 *
 * @module
 */

import type { AiProvider } from './types';

/** All 14 capabilities, with metadata for the UI. */
export interface CapabilityInfo {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const CAPABILITY_INFO: CapabilityInfo[] = [
  { id: 'text', label: 'Text Generation', description: 'Generate text responses', icon: 'Type' },
  { id: 'streaming', label: 'Streaming', description: 'Token-by-token streaming', icon: 'Zap' },
  { id: 'embedding', label: 'Embeddings', description: 'Text to vector', icon: 'Database' },
  { id: 'stt', label: 'Speech-to-Text', description: 'Audio to text', icon: 'Mic' },
  { id: 'tts', label: 'Text-to-Speech', description: 'Text to audio', icon: 'Volume2' },
  {
    id: 'realtime_voice',
    label: 'Realtime Voice',
    description: 'Live voice conversation',
    icon: 'Phone',
  },
  {
    id: 'model_discovery',
    label: 'Model Discovery',
    description: 'List available models',
    icon: 'List',
  },
  {
    id: 'structured_output',
    label: 'Structured Output',
    description: 'JSON/schema output',
    icon: 'Braces',
  },
  { id: 'tool_calling', label: 'Tool Calling', description: 'Function calling', icon: 'Wrench' },
  { id: 'reasoning', label: 'Reasoning', description: 'Chain-of-thought', icon: 'Brain' },
  { id: 'vision', label: 'Vision', description: 'Image understanding', icon: 'Eye' },
  { id: 'context_caching', label: 'Context Caching', description: 'Cache prompts', icon: 'Layers' },
  {
    id: 'batch_processing',
    label: 'Batch Processing',
    description: 'Batch requests',
    icon: 'Layers',
  },
  {
    id: 'connection_test',
    label: 'Connection Test',
    description: 'Test connectivity',
    icon: 'CheckCircle',
  },
];

/**
 * Static capability matrix — which provider supports which capability.
 *
 * This is the SINGLE SOURCE OF TRUTH for the UI. The runtime system
 * (capabilities.ts) is the source of truth for actual behavior; this map
 * mirrors it for display purposes.
 */
export const PROVIDER_CAPABILITIES: Record<AiProvider, string[]> = {
  claude: ['text', 'streaming', 'model_discovery'],
  openai: [
    'text',
    'streaming',
    'embedding',
    'stt',
    'tts',
    'realtime_voice',
    'model_discovery',
    'structured_output',
    'tool_calling',
    'reasoning',
    'vision',
    'context_caching',
    'batch_processing',
    'connection_test',
  ],
  gemini: [
    'text',
    'streaming',
    'embedding',
    'stt',
    'model_discovery',
    'structured_output',
    'tool_calling',
    'reasoning',
    'vision',
    'context_caching',
    'batch_processing',
    'connection_test',
  ],
  mistral: [
    'text',
    'streaming',
    'embedding',
    'stt',
    'tts',
    'realtime_voice',
    'model_discovery',
    'structured_output',
    'tool_calling',
    'reasoning',
    'vision',
    'context_caching',
    'batch_processing',
    'connection_test',
  ],
  byteplus: [
    'text',
    'streaming',
    'embedding',
    'stt',
    'tts',
    'realtime_voice',
    'model_discovery',
    'structured_output',
    'tool_calling',
    'reasoning',
    'vision',
    'context_caching',
    'batch_processing',
    'connection_test',
  ],
  ollama: ['text', 'streaming', 'embedding', 'model_discovery', 'connection_test'],
  copilot: ['text', 'streaming', 'model_discovery', 'connection_test'],
  custom: ['text', 'streaming', 'embedding', 'model_discovery', 'connection_test'],
  lmstudio: ['text', 'streaming', 'embedding', 'model_discovery', 'connection_test'],
  openrouter: ['text', 'streaming', 'model_discovery', 'connection_test'],
  local: ['stt', 'tts'],
};

/** Provider display metadata. */
export interface ProviderMeta {
  id: AiProvider;
  label: string;
  description: string;
  authType: 'api_key' | 'server_url' | 'none';
  color: string;
}

export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  claude: {
    id: 'claude',
    label: 'Claude',
    description: 'Anthropic Claude models',
    authType: 'api_key',
    color: '#d97757',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT, Whisper, TTS, Embeddings',
    authType: 'api_key',
    color: '#10a37f',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    description: 'Google Gemini models',
    authType: 'api_key',
    color: '#4285f4',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    description: 'Mistral, Voxtral STT/TTS',
    authType: 'api_key',
    color: '#ff7000',
  },
  byteplus: {
    id: 'byteplus',
    label: 'BytePlus',
    description: 'Doubao, Seed ASR/TTS',
    authType: 'api_key',
    color: '#3c8cff',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    description: 'Local models via Ollama',
    authType: 'server_url',
    color: '#888',
  },
  copilot: {
    id: 'copilot',
    label: 'Copilot',
    description: 'GitHub Models',
    authType: 'api_key',
    color: '#f0f0f0',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    description: 'OpenAI-compatible endpoint',
    authType: 'api_key',
    color: '#8b5cf6',
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio',
    description: 'Local models via LM Studio',
    authType: 'server_url',
    color: '#ff6b35',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Multi-provider router',
    authType: 'api_key',
    color: '#6366f1',
  },
  local: {
    id: 'local',
    label: 'On-device',
    description: 'Local sherpa-onnx models',
    authType: 'none',
    color: '#22c55e',
  },
};

/** Task-to-capability mapping for the UI. */
export interface TaskInfo {
  id: string;
  label: string;
  requiredCapabilities: string[];
  description: string;
}

export const AI_TASKS: TaskInfo[] = [
  {
    id: 'chat',
    label: 'Chat / Text',
    requiredCapabilities: ['text'],
    description: 'Generate text responses',
  },
  {
    id: 'stream',
    label: 'Streaming Chat',
    requiredCapabilities: ['streaming'],
    description: 'Token-by-token streaming',
  },
  {
    id: 'transcribe',
    label: 'Transcribe Audio',
    requiredCapabilities: ['stt'],
    description: 'Speech to text',
  },
  {
    id: 'speak',
    label: 'Speak Text',
    requiredCapabilities: ['tts'],
    description: 'Text to speech',
  },
  {
    id: 'embed',
    label: 'Embed Documents',
    requiredCapabilities: ['embedding'],
    description: 'Text to vectors for RAG',
  },
  {
    id: 'vision',
    label: 'Analyze Image',
    requiredCapabilities: ['vision'],
    description: 'Image understanding',
  },
  {
    id: 'tools',
    label: 'Tool Calling',
    requiredCapabilities: ['tool_calling'],
    description: 'Function calling',
  },
  {
    id: 'reasoning',
    label: 'Reasoning',
    requiredCapabilities: ['reasoning'],
    description: 'Chain-of-thought',
  },
  {
    id: 'realtime',
    label: 'Realtime Voice',
    requiredCapabilities: ['realtime_voice'],
    description: 'Live voice conversation',
  },
  {
    id: 'batch',
    label: 'Batch Processing',
    requiredCapabilities: ['batch_processing'],
    description: 'Process multiple items',
  },
];

/** Get providers that support ALL of the given capabilities. */
export function getProvidersForCapabilities(caps: string[]): AiProvider[] {
  return (Object.keys(PROVIDER_CAPABILITIES) as AiProvider[]).filter((p) =>
    caps.every((c) => PROVIDER_CAPABILITIES[p].includes(c)),
  );
}

/** Get capability info by id. */
export function getCapabilityInfo(id: string): CapabilityInfo | undefined {
  return CAPABILITY_INFO.find((c) => c.id === id);
}
