/**
 * VoiceSettings — Voice & Speech provider configuration for the AI settings.
 *
 * AnythingLLM-style section covering Text-to-Speech (TTS) and
 * Speech-to-Text (STT) providers, base URL, auth token, and voice/model
 * selection. Config is persisted via the settings store; no audio engine is
 * bundled yet, so this section manages provider connection details.
 *
 * Integrates with the capability system: shows which providers support
 * which voice capabilities, and allows reusing AI provider API keys.
 *
 * @module
 */

import { useState, useEffect } from 'react';
import { SettingGroup, SettingRow, ToggleRow } from '@features/settings/components/SettingsHelpers';
import { HelpCard } from '@features/settings/components/HelpCard';
import { Button } from '@shared/components/ui/Button';
import { TextField } from '@shared/components/ui/TextField';
import { setSetting, setSecureSetting } from '@features/settings/db/settings';
import {
  getVoiceConfig,
  getVoiceCapabilities,
  type VoiceProviderType,
} from '@shared/services/ai/voiceService';

type VoiceProvider = VoiceProviderType;

/**
 * Report a settings read/write failure without treating the expected
 * browser/dev-server condition as an error: when no Tauri backend exists,
 * every `setSetting`/`getSetting` rejects with `TauriUnavailableError`,
 * which callers swallow here instead of surfacing as unhandled rejections
 * (page errors) in the dev console.
 */
function logVoiceError(scope: string, err: unknown): void {
  if (typeof err === 'object' && err !== null && 'isTauriUnavailable' in err) return;
  console.warn(`[VoiceSettings] ${scope} failed:`, err);
}

export default function VoiceSettings() {
  const [provider, setProvider] = useState<VoiceProvider>('browser');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [ttsVoice, setTtsVoice] = useState('alloy');
  const [sttModel, setSttModel] = useState('whisper-1');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [capabilities, setCapabilities] = useState<{ stt: boolean; tts: boolean }>({
    stt: false,
    tts: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const config = await getVoiceConfig();
        setProvider(config.provider);
        setBaseUrl(config.baseUrl);
        setApiKey(config.apiKey);
        setTtsVoice(config.ttsVoice);
        setSttModel(config.sttModel);
        setTtsEnabled(config.ttsEnabled);
        setSttEnabled(config.sttEnabled);
        setCapabilities(getVoiceCapabilities(config));
      } catch (err) {
        // Keep the component defaults when settings can't be read.
        logVoiceError('getVoiceConfig', err);
      }
    })();
  }, []);

  function isValidUrl(str: string): boolean {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function save() {
    try {
      await setSetting('voice_provider', provider);
      await setSetting('voice_base_url', baseUrl.trim());
      if (apiKey.trim()) await setSecureSetting('voice_api_key', apiKey.trim());
      await setSetting('voice_tts_voice', ttsVoice.trim());
      await setSetting('voice_stt_model', sttModel.trim());
      await setSetting('voice_tts_enabled', ttsEnabled ? 'true' : 'false');
      await setSetting('voice_stt_enabled', sttEnabled ? 'true' : 'false');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      logVoiceError('save', err);
    }
  }

  const needsKey = provider !== 'browser' && provider !== 'lmstudio';
  const needsUrl = provider === 'custom' || provider === 'lmstudio';

  return (
    <>
      <SettingGroup
        title="Voice & Speech"
        description="Configure Text-to-Speech (TTS) and Speech-to-Text (STT) providers. Used by the AI assistant for spoken replies and voice input."
      >
        <SettingRow label="Provider">
          <select
            value={provider}
            onChange={(e) => {
              const v = e.target.value as VoiceProvider;
              setProvider(v);
              void setSetting('voice_provider', v).catch((err) =>
                logVoiceError('provider change', err),
              );
            }}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="browser">Browser (Web Speech)</option>
            <option value="openai">OpenAI</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="lmstudio">LM Studio (local)</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
            <option value="agent-core">Agent Core (Python)</option>
          </select>
        </SettingRow>

        <div className="flex gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${capabilities.stt ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          >
            {capabilities.stt ? '✓' : '✗'} STT
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${capabilities.tts ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
          >
            {capabilities.tts ? '✓' : '✗'} TTS
          </span>
        </div>

        <p className="text-xs text-text-tertiary">
          {provider === 'browser'
            ? "Uses the browser's built-in Web Speech API. No API key or server required — runs fully on-device."
            : provider === 'lmstudio'
              ? 'Connects to a local LM Studio server exposing OpenAI-compatible TTS/STT endpoints.'
              : provider === 'custom'
                ? 'Any OpenAI-compatible TTS/STT endpoint. Provide a base URL and auth token.'
                : provider === 'elevenlabs'
                  ? 'High-quality TTS via ElevenLabs. STT uses a compatible endpoint.'
                  : 'OpenAI Whisper (STT) + TTS voices.'}
        </p>

        {needsUrl && (
          <TextField
            label="Base URL"
            size="md"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        )}

        {needsKey && (
          <TextField
            label="API Key / Auth Token"
            size="md"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
          />
        )}

        <SettingRow label="TTS Voice">
          <input
            type="text"
            value={ttsVoice}
            onChange={(e) => setTtsVoice(e.target.value)}
            placeholder="alloy"
            className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
          />
        </SettingRow>

        <SettingRow label="STT Model">
          <input
            type="text"
            value={sttModel}
            onChange={(e) => setSttModel(e.target.value)}
            placeholder="whisper-1"
            className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
          />
        </SettingRow>

        <ToggleRow
          label="Enable Text-to-Speech"
          description="Let the AI assistant speak replies aloud"
          checked={ttsEnabled}
          onToggle={() => {
            const next = !ttsEnabled;
            setTtsEnabled(next);
            void setSetting('voice_tts_enabled', next ? 'true' : 'false').catch((err) =>
              logVoiceError('tts toggle', err),
            );
          }}
        />
        <ToggleRow
          label="Enable Speech-to-Text"
          description="Allow voice input to the AI assistant"
          checked={sttEnabled}
          onToggle={() => {
            const next = !sttEnabled;
            setSttEnabled(next);
            void setSetting('voice_stt_enabled', next ? 'true' : 'false').catch((err) =>
              logVoiceError('stt toggle', err),
            );
          }}
        />

        <div className="pt-1">
          <Button
            variant="primary"
            size="md"
            onClick={save}
            disabled={needsUrl && !isValidUrl(baseUrl.trim())}
          >
            {saved ? 'Saved' : 'Save voice settings'}
          </Button>
        </div>
      </SettingGroup>

      <HelpCard
        collapsible
        items={[
          {
            type: 'why',
            text: 'Voice & Speech lets the AI assistant read replies aloud and accept spoken input — useful for hands-free workflows and accessibility.',
          },
          {
            type: 'how',
            text: 'Pick a provider and supply its base URL + auth token (cloud providers) or leave Browser selected for a zero-config on-device option. TTS voice and STT model tune the output.',
          },
          {
            type: 'when',
            text: 'Enable when you want spoken AI interactions. Browser mode needs no setup; cloud providers give higher-quality voices at the cost of sending audio to an external service.',
          },
        ]}
      />
    </>
  );
}
