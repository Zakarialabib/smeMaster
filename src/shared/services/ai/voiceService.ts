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
import {
  aiLoadSttModel,
  aiTranscribeAudio,
  aiLoadTtsVoice,
  aiSynthesizeSpeech,
  type SynthesisResult,
} from '../db/invoke/rag';

// ── Voice Provider Types ───────────────────────────────────────────────────

export type VoiceProviderType =
  | 'browser'
  | 'openai'
  | 'elevenlabs'
  | 'lmstudio'
  | 'custom'
  | 'agent-core'
  /** On-device sherpa-onnx (ml-sidecar `offline-speech`). No key, no network. */
  | 'offline';

export interface VoiceConfig {
  provider: VoiceProviderType;
  baseUrl: string;
  apiKey: string;
  ttsVoice: string;
  sttModel: string;
  ttsEnabled: boolean;
  sttEnabled: boolean;
  /** Speaking rate for the offline engine. 1.0 is the voice's natural pace. */
  ttsSpeed: number;
  /** Sample rate the offline STT model expects (sherpa-onnx zipformer: 16000). */
  offlineSttSampleRate: number;
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
  ttsSpeed: 1.0,
  offlineSttSampleRate: 16000,
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
  const ttsSpeedRaw = await getSetting('voice_tts_speed');
  const ttsSpeed = ttsSpeedRaw ? Number.parseFloat(ttsSpeedRaw) : Number.NaN;

  return {
    provider: provider ?? DEFAULT_VOICE_CONFIG.provider,
    baseUrl: baseUrl ?? DEFAULT_VOICE_CONFIG.baseUrl,
    apiKey: apiKey ?? DEFAULT_VOICE_CONFIG.apiKey,
    ttsVoice: ttsVoice ?? DEFAULT_VOICE_CONFIG.ttsVoice,
    sttModel: sttModel ?? DEFAULT_VOICE_CONFIG.sttModel,
    ttsEnabled,
    sttEnabled,
    // Guard against a corrupt/absent setting: NaN or a non-positive rate would
    // make the engine emit garbage timing.
    ttsSpeed: Number.isFinite(ttsSpeed) && ttsSpeed > 0 ? ttsSpeed : DEFAULT_VOICE_CONFIG.ttsSpeed,
    offlineSttSampleRate: DEFAULT_VOICE_CONFIG.offlineSttSampleRate,
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

// ── Offline (sherpa-onnx via ml-sidecar) ───────────────────────────────────
//
// The sidecar returns raw mono f32 samples; `synthesizeSpeech`'s contract is a
// Blob, so this encodes a WAV in the renderer. Keeping the container encoding
// here means the sidecar needs no audio-encoding dependency.
//
// Model paths come from settings rather than being guessed: sherpa-onnx models
// are installed per-device (see FRONTEND.md §3.2 — capability is never assumed).

/** Encode mono f32 samples as a 16-bit PCM WAV Blob. */
function encodeWavBlob(samples: number[], sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (const s of samples) {
    // Clamp before scaling: a sample outside [-1,1] would wrap and click.
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Synthesise via the on-device engine.
 *
 * Returns `null` when no voice is configured, matching the browser path's
 * "no audio data" contract. Throws if a voice IS configured but synthesis
 * fails — silently returning null there would hide a real failure.
 */
async function synthesizeWithOffline(
  text: string,
  config: VoiceConfig,
  options?: TtsOptions,
): Promise<Blob | null> {
  const modelDir = await getSetting('voice_offline_tts_dir');
  if (!modelDir) return null;

  // Load once per call: the sidecar keeps the engine resident after the first
  // load, so subsequent calls are cheap. Loading here avoids a separate
  // "prepare" step in the UI.
  await aiLoadTtsVoice(modelDir);

  const result: SynthesisResult = await aiSynthesizeSpeech(text, options?.speed ?? config.ttsSpeed);

  if (!result.samples?.length) return null;
  return encodeWavBlob(result.samples, result.sample_rate);
}

/**
 * Transcribe via the on-device engine.
 *
 * `audio` is decoded to mono f32 in the renderer — the sidecar takes raw
 * samples, not a container.
 */
async function transcribeWithOffline(audio: Blob, config: VoiceConfig): Promise<string> {
  const modelDir = await getSetting('voice_offline_stt_dir');
  if (!modelDir) {
    throw new Error('No offline STT model configured. Set a model directory in Voice settings.');
  }

  const { samples, sampleRate } = await decodeToMonoF32(audio, config.offlineSttSampleRate);

  await aiLoadSttModel(modelDir);
  const result = await aiTranscribeAudio(samples, sampleRate);
  return result.text;
}

/**
 * Decode an audio Blob to mono f32 samples at `targetRate`.
 *
 * Uses the Web Audio API. Resampling is left to `OfflineAudioContext`, which
 * does it natively — doing it by hand here would be slower and worse. Note
 * `AudioContext.decodeAudioData` needs a *copy* of the buffer in some engines
 * because it detaches the input.
 */
async function decodeToMonoF32(
  audio: Blob,
  targetRate: number,
): Promise<{ samples: number[]; sampleRate: number }> {
  const arrayBuffer = await audio.arrayBuffer();

  const AudioCtx =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;

  if (!AudioCtx) {
    throw new Error('Web Audio API is unavailable — cannot decode audio for offline STT.');
  }

  const ctx = new AudioCtx({ sampleRate: targetRate });
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    // Mix down to mono by averaging channels.
    const channels = decoded.numberOfChannels;
    const length = decoded.length;
    const out = new Float32Array(length);
    for (let c = 0; c < channels; c += 1) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < length; i += 1) {
        // `noUncheckedIndexedAccess` is on, so both accesses are `| undefined`.
        // They are in-bounds by construction (`i < length`), hence the `?? 0`.
        out[i] = (out[i] ?? 0) + (data[i] ?? 0) / channels;
      }
    }
    return { samples: Array.from(out), sampleRate: decoded.sampleRate };
  } finally {
    void ctx.close();
  }
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
    case 'offline':
      // On-device sherpa-onnx via ml-sidecar. No key, no network.
      return synthesizeWithOffline(text, config, options);
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
    case 'offline':
      // On-device sherpa-onnx via ml-sidecar. No key, no network.
      return transcribeWithOffline(audio, config);
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
 * `docs/02-BACKEND/20-offline-stt-and-audio-summarization.md` §2.
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
    case 'offline':
      // Both directions are implemented (sherpa-onnx via ml-sidecar).
      //
      // Caveat that matters: this reports what the *code path* does, not
      // whether a model is installed on this device. The ml-sidecar must have
      // been built with `offline-speech`, and a model directory must be
      // configured — otherwise the call rejects at runtime. The UI should
      // surface "model not configured" separately rather than treating this as
      // a lie; capability here means "this provider can do it at all".
      return { stt: true, tts: true };
    default:
      return { stt: false, tts: false };
  }
}
