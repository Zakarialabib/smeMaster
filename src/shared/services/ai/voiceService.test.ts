import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@features/settings/db/settings', () => ({
  getSetting: vi.fn(async () => null),
  getSecureSetting: vi.fn(async () => null),
}));

import {
  getVoiceConfig,
  getVoiceCapabilities,
  isBrowserVoiceSupported,
  isBrowserSttSupported,
  speakWithBrowser,
  synthesizeSpeech,
  transcribeSpeech,
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
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
    vi.restoreAllMocks();
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
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };
    // Without SpeechRecognition, browser STT is false
    let caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(false);

    // Mock SpeechRecognition
    (window as any).SpeechRecognition = vi.fn();
    caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(true);
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
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.tts).toBe(true);
    expect(caps.stt).toBe(true);
  });

  it('getVoiceCapabilities does NOT advertise unimplemented providers', () => {
    // agent-core remains unimplemented and throws
    const agentCore: VoiceConfig = {
      provider: 'agent-core',
      baseUrl: 'http://localhost:8000',
      apiKey: '',
      ttsVoice: 'alloy',
      sttModel: 'whisper-1',
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };
    expect(getVoiceCapabilities(agentCore)).toEqual({ stt: false, tts: false });

    // elevenlabs is now fully implemented
    const elevenlabs: VoiceConfig = { ...agentCore, provider: 'elevenlabs' };
    expect(getVoiceCapabilities(elevenlabs)).toEqual({ stt: true, tts: true });
  });

  it('getVoiceCapabilities is truthful for every provider that throws', async () => {
    (window as any).SpeechRecognition = vi.fn();

    const providers = [
      'browser',
      'openai',
      'elevenlabs',
      'lmstudio',
      'custom',
      'agent-core',
      'offline',
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
        ttsSpeed: 1.0,
        offlineSttSampleRate: 16000,
      };
      const caps = getVoiceCapabilities(config);

      if (caps.tts) {
        expect(['openai', 'elevenlabs', 'custom', 'lmstudio', 'browser', 'offline']).toContain(provider);
      }
      if (caps.stt) {
        expect(['openai', 'elevenlabs', 'custom', 'lmstudio', 'browser', 'offline']).toContain(provider);
      }
    }
  });

  it('getVoiceCapabilities advertises offline for both directions', () => {
    // The offline provider has real implementations in both directions
    // (sherpa-onnx via ml-sidecar), so unlike the stub providers it must
    // report true. This is a deliberate flip of the previous behaviour for a
    // provider that used to not exist.
    const config: VoiceConfig = {
      provider: 'offline',
      baseUrl: '',
      apiKey: '',
      ttsVoice: '',
      sttModel: '',
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };
    expect(getVoiceCapabilities(config)).toEqual({ stt: true, tts: true });
  });

  it('offline provider needs neither API key nor base URL', () => {
    // Regression guard for the settings UI: `offline` is on-device, so showing
    // it an API-key field would be asking for a secret it never uses.
    const config: VoiceConfig = {
      provider: 'offline',
      baseUrl: '',
      apiKey: '',
      ttsVoice: '',
      sttModel: '',
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };
    const caps = getVoiceCapabilities(config);
    expect(caps.stt && caps.tts).toBe(true);
  });

  it('isBrowserVoiceSupported returns boolean', () => {
    const result = isBrowserVoiceSupported();
    expect(typeof result).toBe('boolean');
  });

  it('isBrowserSttSupported returns true when SpeechRecognition is present', () => {
    expect(isBrowserSttSupported()).toBe(false);
    (window as any).SpeechRecognition = vi.fn();
    expect(isBrowserSttSupported()).toBe(true);
  });

  it('synthesizeSpeech calls ElevenLabs API correctly', async () => {
    const mockBlob = new Blob(['audio data'], { type: 'audio/mpeg' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      blob: async () => mockBlob,
    } as Response);

    const config: VoiceConfig = {
      provider: 'elevenlabs',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'xi-key-123',
      ttsVoice: '21m00Tcm4TlvDq8ikWAM',
      sttModel: 'scribe_v1',
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };

    const result = await synthesizeSpeech('Hello world', config);
    expect(result).toBe(mockBlob);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'xi-api-key': 'xi-key-123',
        }),
        body: JSON.stringify({
          text: 'Hello world',
          model_id: 'eleven_multilingual_v2',
        }),
      }),
    );
  });

  it('transcribeSpeech calls ElevenLabs STT API correctly', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'Transcribed audio text' }),
    } as Response);

    const config: VoiceConfig = {
      provider: 'elevenlabs',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'xi-key-123',
      ttsVoice: '21m00Tcm4TlvDq8ikWAM',
      sttModel: 'scribe_v1',
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };

    const audioBlob = new Blob(['fake audio'], { type: 'audio/webm' });
    const result = await transcribeSpeech(audioBlob, config);

    expect(result).toBe('Transcribed audio text');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/speech-to-text',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'xi-api-key': 'xi-key-123',
        }),
      }),
    );
  });

  it('transcribeSpeech uses browser Web Speech API when provider is browser', async () => {
    let mockOnResult: ((event: any) => void) | undefined;
    let mockOnEnd: (() => void) | undefined;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      set onresult(cb: (event: any) => void) {
        mockOnResult = cb;
      }
      set onend(cb: () => void) {
        mockOnEnd = cb;
      }
      set onerror(_cb: any) {}
      start() {
        setTimeout(() => {
          if (mockOnResult) {
            mockOnResult({
              resultIndex: 0,
              results: [[{ transcript: 'Browser transcribed text' }]],
            });
          }
          if (mockOnEnd) {
            mockOnEnd();
          }
        }, 10);
      }
    }

    (window as any).SpeechRecognition = MockSpeechRecognition;

    const config: VoiceConfig = {
      provider: 'browser',
      baseUrl: '',
      apiKey: '',
      ttsVoice: '',
      sttModel: '',
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: 1.0,
      offlineSttSampleRate: 16000,
    };

    const audioBlob = new Blob(['test audio'], { type: 'audio/webm' });
    const result = await transcribeSpeech(audioBlob, config);
    expect(result).toBe('Browser transcribed text');
  });
});
