/**
 * AI Router Panel — unified observability and control for all AI providers.
 *
 * Three tabs:
 * 1. Providers — capability matrix, active provider, credential health,
 *    fallback routing, cost presets
 * 2. Models  — LM Studio-style local model picker with download + selection
 * 3. HuggingFace — browse/search HF Hub and download models
 *
 * @module
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Mic,
  Volume2,
  Database,
  Zap,
  Phone,
  List,
  Braces,
  Wrench,
  Brain,
  Eye,
  Layers,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Square,
  Cpu,
  Globe,
  Download,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import {
  PROVIDER_CAPABILITIES,
  PROVIDER_META,
  CAPABILITY_INFO,
  AI_TASKS,
  getProvidersForCapabilities,
} from '@shared/services/ai/providerCapabilities';
import type { AiProvider } from '@shared/services/ai/types';
import {
  aiGetSidecarMetrics,
  aiListSidecarModels,
  aiStartSidecar,
  aiStopSidecar,
  aiSidecarControlStatus,
} from '@shared/services/db/invoke/rag';
import { ModelPicker } from './ModelPicker';
import { HfModelBrowser } from './HfModelBrowser';
import { ProviderBadge } from './ProviderBadge';
import { AI_RATE_CARDS, AI_MIX_PRESETS, DEFAULT_AI_ROUTES } from '@shared/services/ai/aiCostData';

const CAPABILITY_ICONS: Record<string, typeof Server> = {
  text: Server,
  streaming: Zap,
  embedding: Database,
  stt: Mic,
  tts: Volume2,
  realtime_voice: Phone,
  model_discovery: List,
  structured_output: Braces,
  tool_calling: Wrench,
  reasoning: Brain,
  vision: Eye,
  context_caching: Layers,
  batch_processing: Layers,
  connection_test: CheckCircle,
};

/** Credential test state — per provider. */
interface ProviderCredential {
  provider: AiProvider;
  configured: boolean;
  lastTestedAt: string | null;
  state: 'ok' | 'untested' | 'auth_failed' | 'rate_limited' | 'unconfigured' | 'testing';
  errorMessage?: string;
}

interface SidecarMetrics {
  embed_count: number;
  index_count: number;
  query_count: number;
  parse_count: number;
  unload_count: number;
  last_model_load_ms: number;
  model_loaded: boolean;
  rss_mb: number;
}

interface SidecarControlStatus {
  feature_enabled: boolean;
  registered: boolean;
  running: boolean;
  healthy: boolean;
  version: string | null;
  reachable: boolean;
}

type TabId = 'providers' | 'models' | 'hf';

const TABS: { id: TabId; label: string; icon: typeof Globe }[] = [
  { id: 'providers', label: 'Providers', icon: Globe },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'hf', label: 'HuggingFace', icon: Download },
];

/** Credential state badge config. */
const CRED_STATE_MAP: Record<
  NonNullable<ProviderCredential['state']>,
  { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }
> = {
  ok: { variant: 'success', label: 'Connected' },
  untested: { variant: 'info', label: 'Untested' },
  auth_failed: { variant: 'danger', label: 'Auth failed' },
  rate_limited: { variant: 'warning', label: 'Rate limited' },
  unconfigured: { variant: 'warning', label: 'No key' },
  testing: { variant: 'info', label: 'Testing…' },
};

export function AiRouterPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('providers');
  const [activeProvider, setActiveProvider] = useState<AiProvider>('claude');
  const [sidecarMetrics, setSidecarMetrics] = useState<SidecarMetrics | null>(null);
  const [sidecarModels, setSidecarModels] = useState<string[]>([]);
  const [sidecarControl, setSidecarControl] = useState<SidecarControlStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sidecarBusy, setSidecarBusy] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>('chat');
  const [providerHealth, setProviderHealth] = useState<Record<string, 'ok' | 'fail' | 'testing'>>(
    {},
  );
  const [credentials, setCredentials] = useState<Record<string, ProviderCredential>>({});
  const [testingCred, setTestingCred] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>('openai-primary');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [metrics, models, control] = await Promise.all([
        aiGetSidecarMetrics(),
        aiListSidecarModels(),
        aiSidecarControlStatus(),
      ]);
      setSidecarMetrics(metrics);
      setSidecarModels(Array.isArray(models) ? models.map((m) => String(m)) : []);
      setSidecarControl(control);
    } catch {
      // Sidecar unavailable — leave state as-is
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleStartSidecar = async () => {
    setSidecarBusy(true);
    try {
      await aiStartSidecar();
    } finally {
      await refresh();
      setSidecarBusy(false);
    }
  };

  const handleStopSidecar = async () => {
    setSidecarBusy(true);
    try {
      await aiStopSidecar();
    } finally {
      await refresh();
      setSidecarBusy(false);
    }
  };

  const testProviderHealth = useCallback(async (provider: AiProvider) => {
    setProviderHealth((prev) => ({ ...prev, [provider]: 'testing' }));
    try {
      const { getProviderClient } = await import('@shared/services/ai/providerManager');
      const client = await getProviderClient(provider);
      await client.testConnection();
      setProviderHealth((prev) => ({ ...prev, [provider]: 'ok' }));
    } catch {
      setProviderHealth((prev) => ({ ...prev, [provider]: 'fail' }));
    }
  }, []);

  const testAllProviders = useCallback(async () => {
    const cloudProviders: AiProvider[] = [
      'claude',
      'openai',
      'gemini',
      'mistral',
      'byteplus',
      'copilot',
      'openrouter',
    ];
    await Promise.all(cloudProviders.map((p) => testProviderHealth(p)));
  }, [testProviderHealth]);

  const testCredential = useCallback(async (provider: AiProvider) => {
    setTestingCred(provider);
    setCredentials((prev) => ({
      ...prev,
      [provider]: {
        ...(prev[provider] ?? {
          provider,
          configured: false,
          lastTestedAt: null,
          state: 'untested',
        }),
        lastTestedAt: new Date().toISOString(),
        state: 'testing' as const,
      },
    }));
    try {
      const { getProviderClient } = await import('@shared/services/ai/providerManager');
      const client = await getProviderClient(provider);
      await client.testConnection();
      setCredentials((prev) => ({
        ...prev,
        [provider]: {
          ...(prev[provider] ?? {
            provider,
            configured: false,
            lastTestedAt: null,
            state: 'untested',
          }),
          lastTestedAt: new Date().toISOString(),
          state: 'ok',
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const state =
        msg.includes('401') || msg.includes('Unauthorized')
          ? 'auth_failed'
          : msg.includes('429')
            ? 'rate_limited'
            : 'unconfigured';
      setCredentials((prev) => ({
        ...prev,
        [provider]: {
          ...(prev[provider] ?? {
            provider,
            configured: false,
            lastTestedAt: null,
            state: 'untested',
          }),
          lastTestedAt: new Date().toISOString(),
          state,
          errorMessage: msg || undefined,
        },
      }));
    } finally {
      setTestingCred(null);
    }
  }, []);

  const providers = Object.keys(PROVIDER_CAPABILITIES) as AiProvider[];
  const taskProviders = getProvidersForCapabilities(
    selectedTask === 'chat'
      ? ['text']
      : selectedTask === 'transcribe'
        ? ['stt']
        : selectedTask === 'speak'
          ? ['tts']
          : selectedTask === 'embed'
            ? ['embedding']
            : ['text'],
  );

  return (
    <div className="space-y-4">
      {/* ── Tab Bar ──────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl border border-border-primary bg-bg-secondary">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover',
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Providers Tab ──────────────────────────────── */}
      {activeTab === 'providers' && (
        <>
          {/* Capability Matrix */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Provider Capabilities</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="text-left py-2 px-2 text-text-tertiary font-medium">Provider</th>
                    {CAPABILITY_INFO.map((cap) => {
                      const Icon = CAPABILITY_ICONS[cap.id] ?? Server;
                      return (
                        <th
                          key={cap.id}
                          className="py-2 px-1 text-text-tertiary font-medium"
                          title={cap.label}
                        >
                          <Icon size={14} className="mx-auto" />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => {
                    const meta = PROVIDER_META[provider];
                    const caps = PROVIDER_CAPABILITIES[provider];
                    const isActive = provider === activeProvider;
                    return (
                      <tr
                        key={provider}
                        className={cn(
                          'border-b border-border-primary/50 cursor-pointer transition-colors',
                          isActive ? 'bg-accent/10' : 'hover:bg-bg-hover',
                        )}
                        onClick={() => setActiveProvider(provider)}
                      >
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span
                              className={cn(
                                'font-medium',
                                isActive ? 'text-accent' : 'text-text-primary',
                              )}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </td>
                        {CAPABILITY_INFO.map((cap) => (
                          <td key={cap.id} className="py-2 px-1 text-center">
                            {caps.includes(cap.id) ? (
                              <CheckCircle size={14} className="mx-auto text-success" />
                            ) : (
                              <span className="text-text-tertiary/30">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Provider */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Active Provider</h3>
              <Badge
                variant={taskProviders.includes(activeProvider) ? 'success' : 'warning'}
                size="sm"
              >
                {taskProviders.includes(activeProvider) ? 'Can handle' : 'Cannot handle'}{' '}
                {selectedTask}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${PROVIDER_META[activeProvider].color}20` }}
              >
                <Server size={20} style={{ color: PROVIDER_META[activeProvider].color }} />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {PROVIDER_META[activeProvider].label}
                </p>
                <p className="text-xs text-text-tertiary">
                  {PROVIDER_META[activeProvider].description}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-text-tertiary block mb-1">Task</label>
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
              >
                {AI_TASKS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cloud Provider Health */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Cloud Provider Health</h3>
              <Button size="sm" variant="secondary" onClick={testAllProviders}>
                Test All
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  'claude',
                  'openai',
                  'gemini',
                  'mistral',
                  'byteplus',
                  'copilot',
                  'openrouter',
                ] as AiProvider[]
              ).map((provider) => {
                const health = providerHealth[provider];
                const meta = PROVIDER_META[provider];
                return (
                  <div
                    key={provider}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border-primary bg-bg-tertiary/30 cursor-pointer hover:bg-bg-hover transition-colors"
                    onClick={() => testProviderHealth(provider)}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-xs font-medium text-text-primary truncate">
                      {meta.label}
                    </span>
                    <div className="ml-auto">
                      {health === undefined ? (
                        <span className="text-[10px] text-text-tertiary">—</span>
                      ) : health === 'testing' ? (
                        <span className="text-[10px] text-accent">Testing…</span>
                      ) : health === 'ok' ? (
                        <CheckCircle size={12} className="text-success" />
                      ) : (
                        <AlertCircle size={12} className="text-danger" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Credential State */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Credentials</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // Test all unconfigured providers
                  const unconfigured = Object.values(PROVIDER_META)
                    .filter((m) => m.authType !== 'none' && !credentials[m.id]?.configured)
                    .map((m) => m.id);
                  unconfigured.forEach((p) => void testCredential(p));
                }}
              >
                Test All
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(PROVIDER_META).map((meta) => {
                const cred = credentials[meta.id];
                const state = cred?.state ?? 'untested';
                const stateConfig = CRED_STATE_MAP[state];
                const isTesting = testingCred === meta.id;
                return (
                  <div
                    key={meta.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border-primary bg-bg-tertiary/30"
                  >
                    <ProviderBadge provider={meta.id} muted />
                    <div className="ml-auto flex items-center gap-1">
                      {isTesting ? (
                        <RotateCw size={12} className="text-accent animate-spin" />
                      ) : (
                        <span
                          className={cn(
                            'text-[10px] font-medium',
                            state === 'ok'
                              ? 'text-success'
                              : state === 'auth_failed'
                                ? 'text-danger'
                                : state === 'rate_limited'
                                  ? 'text-warning'
                                  : 'text-text-tertiary',
                          )}
                        >
                          {stateConfig.label}
                        </span>
                      )}
                      {meta.authType !== 'none' && (
                        <button
                          type="button"
                          onClick={() => void testCredential(meta.id)}
                          className="text-[10px] text-accent hover:underline ml-1"
                          disabled={isTesting}
                        >
                          Test
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {Object.values(credentials).some((c) => c.errorMessage) && (
              <div className="mt-2 space-y-1">
                {Object.values(credentials)
                  .filter((c) => c.errorMessage)
                  .map((c) => (
                    <p key={c.provider} className="text-[11px] text-danger">
                      <ProviderBadge provider={c.provider} muted /> {c.errorMessage}
                    </p>
                  ))}
              </div>
            )}
          </div>

          {/* Fallback Routing */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Task Routing</h3>
            <div className="space-y-2">
              {AI_TASKS.filter((t) => t.id !== 'batch').map((task) => {
                const primary = DEFAULT_AI_ROUTES[task.id];
                const capable = getProvidersForCapabilities(task.requiredCapabilities);
                const fallbacks = capable.filter((p) => p !== primary);
                return (
                  <div
                    key={task.id}
                    className="p-2 rounded-lg border border-border-primary bg-bg-tertiary/30"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-text-primary">{task.label}</span>
                      <Badge variant="info" size="sm">
                        {task.requiredCapabilities.join(', ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {primary && <ProviderBadge provider={primary} />}
                      {fallbacks.length > 0 && (
                        <>
                          <span className="text-[10px] text-text-tertiary">→</span>
                          {fallbacks.slice(0, 3).map((fb) => (
                            <ProviderBadge key={fb} provider={fb} muted />
                          ))}
                          {fallbacks.length > 3 && (
                            <span className="text-[10px] text-text-tertiary">
                              +{fallbacks.length - 3}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-text-tertiary mt-2">
              Cloud providers have fallback chains; local providers route directly.
            </p>
          </div>

          {/* Cost Presets */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Cost Presets</h3>
              <span className="text-[10px] text-text-tertiary">per 1M tokens</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {AI_MIX_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setActivePreset(preset.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                      isActive
                        ? 'bg-accent/15 text-accent border-accent/30'
                        : 'border-border-primary text-text-tertiary hover:text-text-primary',
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="text-left py-1 px-2 text-text-tertiary font-medium">Provider</th>
                    <th className="text-left py-1 px-2 text-text-tertiary font-medium">Model</th>
                    <th className="text-right py-1 px-2 text-text-tertiary font-medium">
                      per 1M tok
                    </th>
                    <th className="text-left py-1 px-2 text-text-tertiary font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {AI_RATE_CARDS.map((rate) => {
                    const preset = AI_MIX_PRESETS.find((p) => p.id === activePreset);
                    const override = preset?.overrides[rate.provider];
                    const isOverride = override !== undefined;
                    return (
                      <tr
                        key={`${rate.provider}-${rate.model}`}
                        className={cn(
                          'border-b border-border-primary/50',
                          isOverride ? 'bg-accent/5' : '',
                        )}
                      >
                        <td className="py-1 px-2">
                          <ProviderBadge provider={rate.provider} muted />
                        </td>
                        <td
                          className={cn(
                            'py-1 px-2',
                            isOverride ? 'text-accent font-medium' : 'text-text-primary',
                          )}
                        >
                          {isOverride ? override?.model : rate.model}
                        </td>
                        <td
                          className={cn(
                            'py-1 px-2 text-right tabular-nums',
                            isOverride ? 'text-accent' : 'text-text-primary',
                          )}
                        >
                          {rate.per1Mtokens === 0 ? 'free' : `$${rate.per1Mtokens}`}
                        </td>
                        <td className="py-1 px-2 text-text-tertiary">
                          {rate.source}
                          {rate.verified ? (
                            <CheckCircle size={10} className="inline ml-1 text-success" />
                          ) : (
                            <AlertTriangle size={10} className="inline ml-1 text-warning" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidecar Control */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">On-Device Engine</h3>
              <div className="flex gap-1.5">
                {sidecarControl?.reachable ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleStopSidecar}
                    disabled={sidecarBusy}
                  >
                    <Square size={12} />
                    {sidecarBusy ? 'Stopping…' : 'Stop'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleStartSidecar}
                    disabled={sidecarBusy || !sidecarControl?.feature_enabled}
                  >
                    <Play size={12} />
                    {sidecarBusy ? 'Starting…' : 'Start'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>
                  <RefreshCw size={12} className={cn(refreshing && 'animate-spin')} />
                </Button>
              </div>
            </div>

            {sidecarControl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {!sidecarControl.feature_enabled ? (
                    <Badge variant="danger" size="sm">
                      not built in
                    </Badge>
                  ) : !sidecarControl.registered ? (
                    <Badge variant="danger" size="sm">
                      not registered
                    </Badge>
                  ) : sidecarControl.reachable ? (
                    <Badge variant="success" size="sm">
                      running
                    </Badge>
                  ) : sidecarControl.running ? (
                    <Badge variant="warning" size="sm">
                      running, not answering
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      stopped
                    </Badge>
                  )}
                  {sidecarControl.version && (
                    <span className="text-[11px] text-text-tertiary">
                      v{sidecarControl.version}
                    </span>
                  )}
                </div>

                {sidecarMetrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <MetricCard label="Embeds" value={sidecarMetrics.embed_count} />
                    <MetricCard label="Indexed" value={sidecarMetrics.index_count} />
                    <MetricCard label="Queries" value={sidecarMetrics.query_count} />
                    <MetricCard label="RSS" value={`${sidecarMetrics.rss_mb} MB`} />
                  </div>
                )}

                {sidecarModels.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-text-tertiary mb-1">Loaded models:</p>
                    <div className="flex flex-wrap gap-1">
                      {sidecarModels.map((m) => (
                        <Badge key={m} variant="info" size="sm">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Models Tab (LM Studio-style picker) ─────────── */}
      {activeTab === 'models' && <ModelPicker />}

      {/* ── HuggingFace Tab ────────────────────────────── */}
      {activeTab === 'hf' && <HfModelBrowser />}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2 rounded-lg border border-border-primary bg-bg-tertiary/30">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="text-sm font-semibold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}
