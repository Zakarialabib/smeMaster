/**
 * Voice Service — bridges VoiceSettings with the capability system.
 *
 * Provides a unified interface for STT/TTS that works with:
 * - Desktop AI providers (via capability interfaces)
 * - Python agent-core (via HTTP/WebSocket)
 * - Browser Web Speech API (fallback)
 *
 * @module
 */

import { getSetting, getSecureSetting } from '@features/settings/db/settings';
import type { SttOptions, TtsOptions } from './capabilities';

// ── Voice Provider Types ───────────────────────────────────────────────────

export type VoiceProviderType =
  'browser' | 'openai' | 'elevenlabs' | 'lmstudio' | 'custom' | 'agent-core';

export interface VoiceConfig {
  provider: VoiceProviderType;
  baseUrl: string;
  apiKey: string;
  ttsVoice: string;
  sttModel: string;
  ttsEnabled: boolean;
  sttEnabled: boolean;
}

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  provider: 'browser',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  ttsVoice: 'alloy',
  sttModel: 'whisper-1',
  ttsEnabled: false,
  sttEnabled: false,
};

// ── Configuration Loading ──────────────────────────────────────────────────

export async function getVoiceConfig(): Promise<VoiceConfig> {
  const provider = (await getSetting('voice_provider')) as VoiceProviderType | null;
  const baseUrl = await getSetting('voice_base_url');
  const apiKey = await getSecureSetting('voice_api_key');
  const ttsVoice = await getSetting('voice_tts_voice');
  const sttModel = await getSetting('voice_stt_model');
  const ttsEnabled = (await getSetting('voice_tts_enabled')) !== 'false';
  const sttEnabled = (await getSetting('voice_stt_enabled')) !== 'false';

  return {
    provider: provider ?? DEFAULT_VOICE_CONFIG.provider,
    baseUrl: baseUrl ?? DEFAULT_VOICE_CONFIG.baseUrl,
    apiKey: apiKey ?? DEFAULT_VOICE_CONFIG.apiKey,
    ttsVoice: ttsVoice ?? DEFAULT_VOICE_CONFIG.ttsVoice,
    sttModel: sttModel ?? DEFAULT_VOICE_CONFIG.sttModel,
    ttsEnabled,
    sttEnabled,
  };
}

// ── Browser Web Speech API (Fallback) ──────────────────────────────────────

export function isBrowserVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakWithBrowser(text: string, voice?: string): void {
  if (!isBrowserVoiceSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.name.toLowerCase().includes(voice.toLowerCase()));
    if (match) utterance.voice = match;
  }
  window.speechSynthesis.speak(utterance);
}

// ── OpenAI-Compatible TTS/STT ──────────────────────────────────────────────

async function synthesizeWithOpenAI(
  text: string,
  config: VoiceConfig,
  options?: TtsOptions,
): Promise<Blob> {
  const response = await fetch(`${config.baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: options?.model ?? 'tts-1',
      input: text,
      voice: options?.voice ?? config.ttsVoice,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS error (${response.status}): ${errorText}`);
  }

  return response.blob();
}

async function transcribeWithOpenAI(
  audio: Blob,
  config: VoiceConfig,
  options?: SttOptions,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audio, 'audio.webm');
  formData.append('model', options?.model ?? config.sttModel);
  if (options?.language) {
    formData.append('language', options.language);
  }

  const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`STT error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? '';
}

// ── Unified Voice Interface ────────────────────────────────────────────────

export async function synthesizeSpeech(
  text: string,
  config: VoiceConfig,
  options?: TtsOptions,
): Promise<Blob | null> {
  if (!config.ttsEnabled) return null;

  switch (config.provider) {
    case 'browser':
      speakWithBrowser(text, options?.voice);
      return null; // Browser TTS doesn't return audio data
    case 'openai':
    case 'custom':
    case 'lmstudio':
      return synthesizeWithOpenAI(text, config, options);
    case 'elevenlabs':
      // TODO: Implement ElevenLabs TTS
      throw new Error('ElevenLabs TTS not yet implemented');
    case 'agent-core':
      // TODO: Proxy through agent-core HTTP API
      throw new Error('Agent-core TTS not yet implemented');
    default:
      return null;
  }
}

export async function transcribeSpeech(
  audio: Blob,
  config: VoiceConfig,
  options?: SttOptions,
): Promise<string | null> {
  if (!config.sttEnabled) return null;

  switch (config.provider) {
    case 'browser':
      // TODO: Implement browser STT using Web Speech API
      throw new Error('Browser STT not yet implemented');
    case 'openai':
    case 'custom':
    case 'lmstudio':
      return transcribeWithOpenAI(audio, config, options);
    case 'elevenlabs':
      // TODO: Implement ElevenLabs STT
      throw new Error('ElevenLabs STT not yet implemented');
    case 'agent-core':
      // TODO: Proxy through agent-core HTTP API
      throw new Error('Agent-core STT not yet implemented');
    default:
      return null;
  }
}

// ── Capability Detection ──────────────────────────────────────────────────

/**
 * Which speech directions a provider can actually perform **today**.
 *
 * TRUTHFULNESS CONTRACT: this function drives the ✓/✗ badges in VoiceSettings.
 * It must describe what the dispatch in `synthesizeSpeech`/`transcribeSpeech`
 * really does, not what the provider is intended to do eventually. Returning
 * `true` for a code path that throws shows the user a green badge and then
 * fails at call time — see the stub inventory in
 * `docs/06-ROADMAP/18-offline-speech-engine-decision.md` §6.
 *
 * When a stub in `synthesizeSpeech`/`transcribeSpeech` is implemented, flip the
 * corresponding flag here in the same change.
 */
export function getVoiceCapabilities(config: VoiceConfig): {
  stt: boolean;
  tts: boolean;
} {
  switch (config.provider) {
    case 'browser':
      // TTS: real (window.speechSynthesis). STT: throws — not implemented.
      return { stt: false, tts: isBrowserVoiceSupported() };
    case 'openai':
    case 'custom':
    case 'lmstudio':
      // All three route through the OpenAI-compatible fetch path.
      return { stt: true, tts: true };
    case 'elevenlabs':
      // Both directions throw ("not yet implemented") — do not advertise them.
      return { stt: false, tts: false };
    case 'agent-core':
      // Both directions throw ("not yet implemented") — do not advertise them.
      // This previously reported { stt: true, tts: true } for two stubs.
      return { stt: false, tts: false };
    default:
      return { stt: false, tts: false };
  }
}
