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

import { useState, useEffect, useCallback, useRef } from 'react';
import { SettingGroup, SettingRow, ToggleRow } from '@features/settings/components/SettingsHelpers';
import { HelpCard } from '@features/settings/components/HelpCard';
import { Button } from '@shared/components/ui/Button';
import { TextField } from '@shared/components/ui/TextField';
import { setSetting, setSecureSetting, getSetting } from '@features/settings/db/settings';
import {
  getVoiceConfig,
  getVoiceCapabilities,
  synthesizeSpeech,
  transcribeSpeech,
  type VoiceConfig,
  type VoiceProviderType,
} from '@shared/services/ai/voiceService';
import {
  aiSidecarControlStatus,
  aiStartSidecar,
  aiStopSidecar,
  type SidecarControlStatus,
} from '@shared/services/db/invoke/rag';
import { listAgents, updateAgent, type AgentPatch } from '@shared/services/db/invoke/agents';
import { Badge } from '@shared/components/ui/Badge';

type VoiceProvider = VoiceProviderType;

/** Sample sentence spoken by the TTS self-test. */
const TEST_SAMPLE_TEXT = 'Hello! This is a test of the SMEMaster voice.';
/** Microphone capture length (seconds) for the STT self-test. */
const STT_RECORD_SECONDS = 5;

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

  // ── Agent selector (bind voice config to agent record) ──
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // ── Voice self-test (TTS sample + STT mic check) ──────────────────────
  // Tests run against the LIVE form values (no save required) so a freshly
  // downloaded offline voice/model can be verified immediately.
  const [ttsTest, setTtsTest] = useState<{
    state: 'idle' | 'working' | 'playing' | 'done' | 'error';
    message?: string;
  }>({ state: 'idle' });
  const [sttTest, setSttTest] = useState<{
    state: 'idle' | 'recording' | 'working' | 'done' | 'error';
    secondsLeft?: number;
    message?: string;
  }>({ state: 'idle' });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Config built from the current form — the test must not depend on save. */
  const buildTestConfig = useCallback(
    (): VoiceConfig => ({
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      ttsVoice: ttsVoice.trim() || 'alloy',
      sttModel: sttModel.trim() || 'whisper-1',
      // Forced on for the test: the user is explicitly asking "does it work".
      ttsEnabled: true,
      sttEnabled: true,
      ttsSpeed: Number.parseFloat(ttsSpeed) > 0 ? Number.parseFloat(ttsSpeed) : 1.0,
      offlineSttSampleRate: 16000,
    }),
    [provider, baseUrl, apiKey, ttsVoice, sttModel, ttsSpeed],
  );

  async function testTts() {
    audioRef.current?.pause();
    setTtsTest({ state: 'working', message: 'Synthesizing…' });
    try {
      const blob = await synthesizeSpeech(TEST_SAMPLE_TEXT, buildTestConfig());
      if (blob) {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setTtsTest({ state: 'done', message: 'Sample played successfully.' });
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setTtsTest({ state: 'error', message: 'Audio was synthesized but could not be played.' });
        };
        setTtsTest({ state: 'playing', message: 'Playing sample…' });
        await audio.play();
      } else if (provider === 'browser') {
        setTtsTest({ state: 'done', message: 'Spoken via the browser voice.' });
      } else {
        setTtsTest({
          state: 'error',
          message: 'No audio returned. Check the voice/model configuration.',
        });
      }
    } catch (err) {
      setTtsTest({ state: 'error', message: describeIpcError(err) });
    }
  }

  function stopMicTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function testStt() {
    // Toggle: clicking while recording stops early.
    if (sttTest.state === 'recording') {
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setSttTest({ state: 'error', message: 'Microphone capture is unavailable in this browser.' });
      return;
    }
    setSttTest({ state: 'recording', secondsLeft: STT_RECORD_SECONDS });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setSttTest({ state: 'error', message: describeIpcError(err) });
      return;
    }
    streamRef.current = stream;
    const rec = new MediaRecorder(stream);
    recorderRef.current = rec;
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      clearRecordTimer();
      stopMicTracks();
      recorderRef.current = null;
      void (async () => {
        setSttTest({ state: 'working', message: 'Transcribing…' });
        try {
          const text = await transcribeSpeech(
            new Blob(chunks, { type: rec.mimeType || 'audio/webm' }),
            buildTestConfig(),
          );
          setSttTest({
            state: 'done',
            message: text ? `Heard: “${text}”` : 'No speech recognized.',
          });
        } catch (err) {
          setSttTest({ state: 'error', message: describeIpcError(err) });
        }
      })();
    };
    rec.start();
    // Auto-stop with a visible countdown.
    let left = STT_RECORD_SECONDS;
    recordTimerRef.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        if (recorderRef.current === rec && rec.state !== 'inactive') rec.stop();
      } else {
        setSttTest((s) => (s.state === 'recording' ? { ...s, secondsLeft: left } : s));
      }
    }, 1000);
  }

  // Release mic/audio resources if the settings page unmounts mid-test.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
      clearRecordTimer();
      stopMicTracks();
    },
    [],
  );

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
        // Load agent roster for selector. Agent fields serialize snake_case
        // (no serde rename on the Rust struct), so read them as such.
        const agentList = await listAgents();
        setAgents(agentList ?? []);

        // Prefer an agent that already carries voice config, else the first.
        const defaultAgent = agentList.find((a: any) => a.voice_provider) ?? agentList[0] ?? null;
        const agentId = defaultAgent?.id ?? null;
        setSelectedAgentId(agentId);

        if (defaultAgent) {
          // Load voice config from the agent record.
          const agent = defaultAgent;
          const loadedProvider = (agent.voice_provider as VoiceProvider) ?? 'browser';
          const loadedBaseUrl = agent.voice_base_url ?? 'https://api.openai.com/v1';
          const loadedApiKey = ''; // never returned by list_agents; write-only
          const loadedTtsVoice = agent.voice_tts_voice ?? 'alloy';
          const loadedSttModel = agent.voice_stt_model ?? 'whisper-1';
          const loadedTtsEnabled = agent.voice_tts_enabled === 1;
          const loadedSttEnabled = agent.voice_stt_enabled === 1;
          const loadedTtsSpeed = agent.voice_tts_speed ?? 1.0;

          setProvider(loadedProvider);
          setBaseUrl(loadedBaseUrl);
          setApiKey(loadedApiKey);
          setTtsVoice(loadedTtsVoice);
          setSttModel(loadedSttModel);
          setTtsEnabled(loadedTtsEnabled);
          setSttEnabled(loadedSttEnabled);
          setOfflineTtsDir(agent.voice_offline_tts_dir ?? '');
          setOfflineSttDir(agent.voice_offline_stt_dir ?? '');
          setTtsSpeed(String(loadedTtsSpeed));
          setCapabilities(
            getVoiceCapabilities({
              provider: loadedProvider,
              baseUrl: loadedBaseUrl,
              apiKey: loadedApiKey,
              ttsVoice: loadedTtsVoice,
              sttModel: loadedSttModel,
              ttsEnabled: loadedTtsEnabled,
              sttEnabled: loadedSttEnabled,
              ttsSpeed: loadedTtsSpeed,
              offlineSttSampleRate: 16000,
            }),
          );
        } else {
          // Fallback: global settings (no agents seeded yet).
          const config = await getVoiceConfig();
          setProvider(config.provider);
          setBaseUrl(config.baseUrl);
          setApiKey(config.apiKey);
          setTtsVoice(config.ttsVoice);
          setSttModel(config.sttModel);
          setTtsEnabled(config.ttsEnabled);
          setSttEnabled(config.sttEnabled);
          setOfflineTtsDir((await getSetting('voice_offline_tts_dir')) ?? '');
          setOfflineSttDir((await getSetting('voice_offline_stt_dir')) ?? '');
          setTtsSpeed(String(config.ttsSpeed));
          setCapabilities(getVoiceCapabilities({ ...config, offlineSttSampleRate: 16000 }));
        }
      } catch (err) {
        logVoiceError('loadVoiceConfig', err);
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
      if (selectedAgentId) {
        // Patch keys are SQL column names (snake_case); Rust validates them
        // against a closed ALLOWED list and rejects unknown keys loudly.
        // Booleans are stored as 0/1 integers.
        const patch: AgentPatch = {
          voice_provider: provider,
          voice_base_url: baseUrl.trim(),
          voice_tts_voice: ttsVoice.trim(),
          voice_stt_model: sttModel.trim(),
          voice_tts_enabled: ttsEnabled ? 1 : 0,
          voice_stt_enabled: sttEnabled ? 1 : 0,
          voice_offline_tts_dir: offlineTtsDir.trim(),
          voice_offline_stt_dir: offlineSttDir.trim(),
          voice_tts_speed: Number.parseFloat(ttsSpeed) > 0 ? Number.parseFloat(ttsSpeed) : 1.0,
        };
        await updateAgent(selectedAgentId, patch);
      } else {
        // No agent selected — write the global fallback settings.
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
        {/* Agent selector — voice config binds to the selected agent record */}
        <SettingRow label="Agent">
          <select
            value={selectedAgentId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedAgentId(id || null);
              // TODO: load voice config from the selected agent record
            }}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="">— Global (fallback) —</option>
            {agents.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </SettingRow>

        <SettingRow label="Provider">
          <select
            value={provider}
            onChange={(e) => {
              const v = e.target.value as VoiceProvider;
              setProvider(v);
              // Sync STT/TTS defaults to the provider's native models
              if (v === 'elevenlabs') {
                setTtsVoice('eleven_multilingual_v2');
                setSttModel('whisper-1');
              } else if (v === 'openai') {
                setTtsVoice('alloy');
                setSttModel('whisper-1');
              } else if (v === 'browser') {
                setTtsVoice('alloy');
                setSttModel('whisper-1');
              } else if (v === 'offline') {
                setTtsVoice('');
                setSttModel('');
              } else if (v === 'lmstudio') {
                setTtsVoice('');
                setSttModel('');
              } else if (v === 'custom') {
                setTtsVoice('');
                setSttModel('');
              }
              // Persist to the agent record when one is selected, else global.
              if (selectedAgentId) {
                void updateAgent(selectedAgentId, { voice_provider: v }).catch((err) =>
                  logVoiceError('provider change', err),
                );
              } else {
                void setSetting('voice_provider', v).catch((err) =>
                  logVoiceError('provider change', err),
                );
              }
            }}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="browser">Browser (Web Speech)</option>
            <option value="offline">Offline (on-device, no key)</option>
            <option value="openai">OpenAI</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="lmstudio">LM Studio (local)</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
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
          {provider === 'openai' ? (
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
            >
              <option value="alloy">alloy</option>
              <option value="echo">echo</option>
              <option value="fable">fable</option>
              <option value="onyx">onyx</option>
              <option value="nova">nova</option>
              <option value="shimmer">shimmer</option>
            </select>
          ) : provider === 'elevenlabs' ? (
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
            >
              <option value="eleven_multilingual_v2">Multilingual V2</option>
              <option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>
              <option value="AZnzlk1XvdvUeBnXmlld">Domi</option>
              <option value="VR6AewLTigWEbQNOJfjx">Charlotte</option>
              <option value="EXAVITQu4vr4xnSDxMaL">Sarah</option>
              <option value="yoZ06aMxZJJ28mfd3POQ">Elli</option>
            </select>
          ) : (
            <input
              type="text"
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              placeholder="alloy"
              className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
            />
          )}
        </SettingRow>

        <SettingRow label="STT Model">
          {provider === 'openai' || provider === 'browser' ? (
            <select
              value={sttModel}
              onChange={(e) => setSttModel(e.target.value)}
              className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
            >
              <option value="whisper-1">whisper-1</option>
            </select>
          ) : (
            <input
              type="text"
              value={sttModel}
              onChange={(e) => setSttModel(e.target.value)}
              placeholder="whisper-1"
              className="w-48 text-text-primary text-sm px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary"
            />
          )}
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

      <SettingGroup
        title="Test voice"
        description="Verify TTS and STT with the settings above — no need to save first. Useful right after downloading an offline voice or model."
      >
        <SettingRow label="Text-to-Speech">
          <div className="flex flex-col gap-1.5">
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void testTts()}
                disabled={ttsTest.state === 'working' || ttsTest.state === 'playing'}
              >
                {ttsTest.state === 'working'
                  ? 'Synthesizing…'
                  : ttsTest.state === 'playing'
                    ? 'Playing…'
                    : 'Test voice'}
              </Button>
            </div>
            {ttsTest.message && (
              <p
                role="status"
                className={`text-xs ${
                  ttsTest.state === 'error' ? 'text-danger' : 'text-text-tertiary'
                } break-words`}
              >
                {ttsTest.message}
              </p>
            )}
          </div>
        </SettingRow>

        <SettingRow label="Speech-to-Text">
          <div className="flex flex-col gap-1.5">
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void testStt()}
                disabled={sttTest.state === 'working'}
              >
                {sttTest.state === 'recording'
                  ? `Stop (${sttTest.secondsLeft ?? STT_RECORD_SECONDS}s)`
                  : 'Record & transcribe'}
              </Button>
            </div>
            {sttTest.state === 'recording' && (
              <p role="status" className="text-xs text-accent">
                Listening — speak now ({sttTest.secondsLeft ?? STT_RECORD_SECONDS}s)…
              </p>
            )}
            {sttTest.message && sttTest.state !== 'recording' && (
              <p
                role="status"
                className={`text-xs ${
                  sttTest.state === 'error' ? 'text-danger' : 'text-text-tertiary'
                } break-words`}
              >
                {sttTest.message}
              </p>
            )}
          </div>
        </SettingRow>
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
