/**
 * AI Router Panel — unified observability and control for all AI providers.
 *
 * Shows:
 * - Provider capability matrix (which provider supports what)
 * - Active provider status and connection test
 * - Sidecar control (start/stop/refresh) with metrics
 * - Model list from sidecar
 * - Usage metrics (embed/index/query counts)
 * - Error display
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
  RefreshCw,
  Play,
  Square,
} from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import {
  PROVIDER_CAPABILITIES,
  PROVIDER_META,
  CAPABILITY_INFO,
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

export function AiRouterPanel() {
  const [activeProvider, setActiveProvider] = useState<AiProvider>('claude');
  const [sidecarMetrics, setSidecarMetrics] = useState<SidecarMetrics | null>(null);
  const [sidecarModels, setSidecarModels] = useState<string[]>([]);
  const [sidecarControl, setSidecarControl] = useState<SidecarControlStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sidecarBusy, setSidecarBusy] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>('chat');

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
      {/* ── Provider Capability Matrix ─────────────────────────────────── */}
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

      {/* ── Active Provider ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Active Provider</h3>
          <Badge variant={taskProviders.includes(activeProvider) ? 'success' : 'warning'} size="sm">
            {taskProviders.includes(activeProvider) ? 'Can handle' : 'Cannot handle'} {selectedTask}
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
          <label className="text-xs text-text-tertiary block mb-1">Select task</label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-48 glass-select text-text-primary text-sm px-3 py-1.5 rounded-md"
          >
            <option value="chat">Chat / Text</option>
            <option value="transcribe">Transcribe Audio</option>
            <option value="speak">Speak Text</option>
            <option value="embed">Embed Documents</option>
          </select>
        </div>
      </div>

      {/* ── Sidecar Control ───────────────────────────────────────────── */}
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
                <span className="text-[11px] text-text-tertiary">v{sidecarControl.version}</span>
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
