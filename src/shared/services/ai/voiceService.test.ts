import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@features/settings/db/settings', () => ({
  getSetting: vi.fn(async () => null),
  getSecureSetting: vi.fn(async () => null),
}));

import {
  getVoiceConfig,
  getVoiceCapabilities,
  isBrowserVoiceSupported,
  speakWithBrowser,
} from './voiceService';
import type { VoiceConfig } from './voiceService';

describe('voice service', () => {
  beforeEach(() => {
    // jsdom does not implement the Web Speech API; the browser provider
    // capability check reads `speechSynthesis` off `window`.
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { getVoices: () => [], speak: vi.fn(), cancel: vi.fn() },
    });
  });

  it('getVoiceConfig returns default config', async () => {
    const config = await getVoiceConfig();
    expect(config).toBeDefined();
    expect(config.provider).toBeDefined();
    expect(config.baseUrl).toBeDefined();
    expect(config.ttsVoice).toBeDefined();
    expect(config.sttModel).toBeDefined();
  });

  it('getVoiceCapabilities returns correct capabilities for browser', () => {
    const config: VoiceConfig = {
      provider: 'browser',
      baseUrl: '',
      apiKey: '',
      ttsVoice: 'alloy',
      sttModel: 'whisper-1',
      ttsEnabled: true,
      sttEnabled: false,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(false);
  });

  it('getVoiceCapabilities returns correct capabilities for openai', () => {
    const config: VoiceConfig = {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      ttsVoice: 'alloy',
      sttModel: 'whisper-1',
      ttsEnabled: true,
      sttEnabled: true,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(true);
  });

  it('getVoiceCapabilities does NOT advertise unimplemented providers', () => {
    // agent-core previously reported { stt: true, tts: true } while both
    // directions throw. The badge must reflect reality.
    const agentCore: VoiceConfig = {
      provider: 'agent-core',
      baseUrl: 'http://localhost:8000',
      apiKey: '',
      ttsVoice: 'alloy',
      sttModel: 'whisper-1',
      ttsEnabled: true,
      sttEnabled: true,
    };
    expect(getVoiceCapabilities(agentCore)).toEqual({ stt: false, tts: false });

    const elevenlabs: VoiceConfig = { ...agentCore, provider: 'elevenlabs' };
    expect(getVoiceCapabilities(elevenlabs)).toEqual({ stt: false, tts: false });
  });

  it('getVoiceCapabilities is truthful for every provider that throws', async () => {
    // Guard against re-introducing the over-reporting bug: for each provider
    // the badge claims support for, the corresponding call must not throw
    // "not yet implemented".
    const providers = [
      'browser',
      'openai',
      'elevenlabs',
      'lmstudio',
      'custom',
      'agent-core',
    ] as const;

    for (const provider of providers) {
      const config: VoiceConfig = {
        provider,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        ttsVoice: 'alloy',
        sttModel: 'whisper-1',
        ttsEnabled: true,
        sttEnabled: true,
      };
      const caps = getVoiceCapabilities(config);

      if (caps.tts) {
        // Real TTS paths need fetch/network; only assert the stub providers
        // do not claim capability. For claimed providers we assert they are
        // not the known-stub ones.
        expect(['openai', 'custom', 'lmstudio', 'browser']).toContain(provider);
      }
      if (caps.stt) {
        expect(['openai', 'custom', 'lmstudio']).toContain(provider);
      }
    }
  });

  it('isBrowserVoiceSupported returns boolean', () => {
    const result = isBrowserVoiceSupported();
    expect(typeof result).toBe('boolean');
  });
});
