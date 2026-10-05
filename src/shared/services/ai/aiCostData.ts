/**
 * AI cost data — rate cards + preset picker for the AI Router panel.
 *
 * Every rate carries a source and verified flag (prototype invariant).
 * Presets let the user swap provider mixes in one click.
 *
 * @module
 */

import type { AiProvider } from '@shared/services/ai/types';

export interface RateCard {
  provider: AiProvider;
  model: string;
  per1Mtokens: number;
  unit: 'per_1m_tokens' | 'per_minute' | 'per_char';
  source: string;
  verified: boolean;
}

export interface AiMixPreset {
  id: string;
  label: string;
  overrides: Partial<Record<AiProvider, { model: string }>>;
}

/** Rate cards — every number sourced, verified flag per row. */
export const AI_RATE_CARDS: RateCard[] = [
  {
    provider: 'openai',
    model: 'gpt-4o',
    per1Mtokens: 2.5,
    unit: 'per_1m_tokens',
    source: 'openai.com/pricing',
    verified: true,
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    per1Mtokens: 0.15,
    unit: 'per_1m_tokens',
    source: 'openai.com/pricing',
    verified: true,
  },
  {
    provider: 'openai',
    model: 'whisper-1',
    per1Mtokens: 0.006,
    unit: 'per_minute',
    source: 'openai.com/pricing',
    verified: true,
  },
  {
    provider: 'openai',
    model: 'tts-1',
    per1Mtokens: 0.015,
    unit: 'per_char',
    source: 'openai.com/pricing',
    verified: true,
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    per1Mtokens: 0.3,
    unit: 'per_1m_tokens',
    source: 'ai.google.dev/pricing',
    verified: true,
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    per1Mtokens: 2.0,
    unit: 'per_1m_tokens',
    source: 'ai.google.dev/pricing',
    verified: true,
  },
  {
    provider: 'mistral',
    model: 'mistral-small',
    per1Mtokens: 0.2,
    unit: 'per_1m_tokens',
    source: 'mistral.ai/pricing',
    verified: true,
  },
  {
    provider: 'mistral',
    model: 'voxtral',
    per1Mtokens: 0.001,
    unit: 'per_minute',
    source: 'mistral.ai/pricing',
    verified: true,
  },
  {
    provider: 'claude',
    model: 'claude-sonnet-4',
    per1Mtokens: 3.0,
    unit: 'per_1m_tokens',
    source: 'anthropic.com/pricing',
    verified: true,
  },
  {
    provider: 'openrouter',
    model: 'meta/llama-3.3-70b',
    per1Mtokens: 0.7,
    unit: 'per_1m_tokens',
    source: 'openrouter.ai/pricing',
    verified: true,
  },
  {
    provider: 'ollama',
    model: 'llama3.2',
    per1Mtokens: 0,
    unit: 'per_1m_tokens',
    source: 'local (free)',
    verified: true,
  },
  {
    provider: 'lmstudio',
    model: 'local',
    per1Mtokens: 0,
    unit: 'per_1m_tokens',
    source: 'local (free)',
    verified: true,
  },
  {
    provider: 'local',
    model: 'sherpa-onnx',
    per1Mtokens: 0,
    unit: 'per_1m_tokens',
    source: 'local (free)',
    verified: true,
  },
];

/** Cost-simulator presets — one click swaps the active provider mix. */
export const AI_MIX_PRESETS: AiMixPreset[] = [
  { id: 'openai-primary', label: 'OpenAI-primary (current)', overrides: {} },
  {
    id: 'gemini-primary',
    label: 'Gemini-primary',
    overrides: {
      openai: { model: 'gemini-2.5-flash' },
      mistral: { model: 'gemini-2.5-flash' },
    },
  },
  {
    id: 'mistral-lean',
    label: 'Mistral-lean (cost-optimised)',
    overrides: {
      openai: { model: 'mistral-small' },
      gemini: { model: 'mistral-small' },
    },
  },
  {
    id: 'selfhosted',
    label: 'Self-hosted floor',
    overrides: {
      openai: { model: 'ollama/llama3.2' },
      gemini: { model: 'lmstudio/local' },
      mistral: { model: 'ollama/llama3.2' },
    },
  },
];

/** Default active provider per capability (flat scheme). */
export const DEFAULT_AI_ROUTES: Record<string, AiProvider> = {
  text: 'openai',
  streaming: 'openai',
  embedding: 'ollama',
  stt: 'local',
  tts: 'local',
};
