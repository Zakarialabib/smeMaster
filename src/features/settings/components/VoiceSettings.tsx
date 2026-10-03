/**
 * VoiceSettings — Voice & Speech provider configuration for the AI settings.
 *
 * AnythingLLM-style section covering Text-to-Speech (TTS) and
 * Speech-to-Text (STT) providers, base URL, auth token, and voice/model
 * selection. Config is persisted via the settings store.
 *
 * An on-device engine IS bundled: the `offline` provider routes through the
 * ml-sidecar's sherpa-onnx support (`offline-speech` cargo feature). It needs
 * no key and no network, but it does need a model directory on disk, so this
 * section exposes those paths.
 *
 * Integrates with the capability system: shows which providers support
 * which voice capabilities, and allows reusing AI provider API keys.
 *
 * @module
 */

import { useState, useEffect, useCallback } from 'react';
import { SettingGroup, SettingRow, ToggleRow } from '@features/settings/components/SettingsHelpers';
import { HelpCard } from '@features/settings/components/HelpCard';
import { Button } from '@shared/components/ui/Button';
import { TextField } from '@shared/components/ui/TextField';
import { setSetting, setSecureSetting, getSetting } from '@features/settings/db/settings';
import {
  getVoiceConfig,
  getVoiceCapabilities,
  type VoiceProviderType,
} from '@shared/services/ai/voiceService';
import {
  aiSidecarControlStatus,
  aiStartSidecar,
  aiStopSidecar,
  type SidecarControlStatus,
} from '@shared/services/db/invoke/rag';
import { Badge } from '@shared/components/ui/Badge';

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

/** True when the failure is just "no Tauri backend" (plain browser / dev server). */
function isBackendMissing(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'isTauriUnavailable' in err;
}

/**
 * Readable text for an IPC rejection.
 *
 * Tauri rejects with a `SerializedError` OBJECT (`{code, message}`), so
 * `String(err)` yields "[object Object]" — which is what a download error
 * showed before this existed. Unwrap `.message`.
 */
function describeIpcError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown };
    if (typeof e.message === 'string' && e.message) {
      return typeof e.code === 'string' && e.code ? `${e.code}: ${e.message}` : e.message;
    }
  }
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export default function VoiceSettings() {
  const [provider, setProvider] = useState<VoiceProvider>('browser');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [ttsVoice, setTtsVoice] = useState('alloy');
  const [sttModel, setSttModel] = useState('whisper-1');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [offlineTtsDir, setOfflineTtsDir] = useState('');
  const [offlineSttDir, setOfflineSttDir] = useState('');
  const [ttsSpeed, setTtsSpeed] = useState('1.0');
  const [saved, setSaved] = useState(false);
  const [sidecar, setSidecar] = useState<SidecarControlStatus | null>(null);
  const [sidecarBusy, setSidecarBusy] = useState(false);
  const [sidecarError, setSidecarError] = useState('');
  const [capabilities, setCapabilities] = useState<{ stt: boolean; tts: boolean }>({
    stt: false,
    tts: false,
  });

  /**
   * Refresh sidecar state. Swallows the "no Tauri backend" case — in a plain
   * browser every IPC call rejects and that is expected, not an error.
   */
  const refreshSidecar = useCallback(async () => {
    try {
      setSidecar(await aiSidecarControlStatus());
      setSidecarError('');
    } catch (err) {
      if (!isBackendMissing(err)) {
        setSidecarError(describeIpcError(err));
      }
      setSidecar(null);
    }
  }, []);

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

        // Offline engine paths live in settings, not in VoiceConfig — they are
        // device-local facts, not provider configuration.
        setOfflineTtsDir((await getSetting('voice_offline_tts_dir')) ?? '');
        setOfflineSttDir((await getSetting('voice_offline_stt_dir')) ?? '');
        setTtsSpeed(String(config.ttsSpeed));
      } catch (err) {
        // Keep the component defaults when settings can't be read.
        logVoiceError('getVoiceConfig', err);
      }
    })();
    void refreshSidecar();
  }, [refreshSidecar]);

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
      await setSetting('voice_offline_tts_dir', offlineTtsDir.trim());
      await setSetting('voice_offline_stt_dir', offlineSttDir.trim());
      const speed = Number.parseFloat(ttsSpeed);
      if (Number.isFinite(speed) && speed > 0) {
        await setSetting('voice_tts_speed', String(speed));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      logVoiceError('save', err);
    }
  }

  // The offline provider needs no key and no URL; it needs model paths instead.
  const needsKey = provider !== 'browser' && provider !== 'lmstudio' && provider !== 'offline';
  const needsUrl = provider === 'custom' || provider === 'lmstudio';
  const isOffline = provider === 'offline';

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
            <option value="offline">Offline (on-device, no key)</option>
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
            : provider === 'offline'
              ? 'On-device speech via sherpa-onnx (ml-sidecar). No API key and no network — audio never leaves this machine. Requires model directories below.'
              : provider === 'lmstudio'
                ? 'Connects to a local LM Studio server exposing OpenAI-compatible TTS/STT endpoints.'
                : provider === 'custom'
                  ? 'Any OpenAI-compatible TTS/STT endpoint. Provide a base URL and auth token.'
                  : provider === 'elevenlabs'
                    ? 'High-quality TTS via ElevenLabs. STT uses a compatible endpoint.'
                    : 'OpenAI Whisper (STT) + TTS voices.'}
        </p>

        {isOffline && (
          <>
            {/* ── On-device engine (ml-sidecar) ─────────────────────────── */}
            {/* The sidecar is OnDemand — it does NOT run until started, and
                until it does every speech call fails. Showing that state (and
                the control) here is the difference between "it's broken" and
                "start it". */}
            <div className="p-3 rounded-xl border border-border-primary bg-bg-secondary">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    On-device engine (ml-sidecar)
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sidecar === null ? (
                      <Badge variant="warning" size="sm">
                        status unavailable
                      </Badge>
                    ) : !sidecar.feature_enabled ? (
                      <Badge variant="danger" size="sm">
                        not built in
                      </Badge>
                    ) : !sidecar.registered ? (
                      <Badge variant="danger" size="sm">
                        not registered
                      </Badge>
                    ) : sidecar.reachable ? (
                      <Badge variant="success" size="sm">
                        running
                      </Badge>
                    ) : sidecar.running ? (
                      <Badge variant="warning" size="sm">
                        running, not answering
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        stopped
                      </Badge>
                    )}
                    {sidecar?.version && (
                      <span className="text-[11px] text-text-tertiary">v{sidecar.version}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">
                    {sidecar === null
                      ? 'Could not read engine status.'
                      : !sidecar.feature_enabled
                        ? 'This build has no local-AI engine. Rebuild with the local-ai feature.'
                        : !sidecar.registered
                          ? 'The engine service did not register at startup.'
                          : sidecar.reachable
                            ? 'Ready. Speech runs locally — no key, no network.'
                            : sidecar.running
                              ? 'The process is alive but not responding. Try Restart.'
                              : 'Stopped. Start it to use offline speech.'}
                  </p>
                  {sidecarError && (
                    <p className="text-[11px] text-danger mt-1 break-all">{sidecarError}</p>
                  )}
                </div>

                <div className="flex gap-1.5 shrink-0">
                  {sidecar?.reachable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={sidecarBusy}
                      onClick={async () => {
                        setSidecarBusy(true);
                        try {
                          await aiStopSidecar();
                        } catch (err) {
                          setSidecarError(describeIpcError(err));
                        } finally {
                          await refreshSidecar();
                          setSidecarBusy(false);
                        }
                      }}
                    >
                      {sidecarBusy ? 'Stopping…' : 'Stop'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={sidecarBusy || sidecar === null || !sidecar.feature_enabled}
                      onClick={async () => {
                        setSidecarBusy(true);
                        setSidecarError('');
                        try {
                          await aiStartSidecar();
                        } catch (err) {
                          setSidecarError(describeIpcError(err));
                        } finally {
                          await refreshSidecar();
                          setSidecarBusy(false);
                        }
                      }}
                    >
                      {sidecarBusy ? 'Starting…' : 'Start'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={sidecarBusy}
                    onClick={() => void refreshSidecar()}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            <TextField
              label="Offline TTS voice directory"
              size="md"
              value={offlineTtsDir}
              onChange={(e) => setOfflineTtsDir(e.target.value)}
              placeholder="…/models/vits-piper-fr_FR-siwis-medium"
            />
            <p className="text-xs text-text-tertiary -mt-1">
              A VITS/Piper voice directory: <code>model.onnx</code>, <code>tokens.txt</code>, and
              the <strong>complete</strong> <code>espeak-ng-data/</code> folder. A partial
              <code> espeak-ng-data</code> fails at phonemisation.
            </p>

            <TextField
              label="Offline STT model directory"
              size="md"
              value={offlineSttDir}
              onChange={(e) => setOfflineSttDir(e.target.value)}
              placeholder="…/models/zipformer-small-en"
            />
            <p className="text-xs text-text-tertiary -mt-1">
              A transducer model directory: <code>encoder</code>, <code>decoder</code>,{' '}
              <code>joiner</code> <code>.onnx</code> files and <code>tokens.txt</code>.
            </p>

            <SettingRow label="Speaking rate">
              <input
                type="text"
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(e.target.value)}
                placeholder="1.0"
                className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
              />
            </SettingRow>

            <p className="text-xs text-text-tertiary">
              Requires the ml-sidecar built with its <code>offline-speech</code> feature. If it
              isn&apos;t, these calls fail with &ldquo;unknown method&rdquo;.
            </p>
          </>
        )}

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
