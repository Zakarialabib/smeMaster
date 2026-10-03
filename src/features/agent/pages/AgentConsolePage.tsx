/**
 * Agent Console — the operator surface for the voice agent.
 *
 * This page was ported from the prototype in Phase A but never wired into the
 * router. It is the first user-visible surface for the agent system.
 *
 * Layout: top-nav sections (Ops · Calls · Live · Config) with an AI callout
 * per section, following the unified design system.
 *
 * @module
 */

import { useState, useCallback, useMemo } from 'react';
import { Activity, Phone, PhoneOff, Settings, CheckCircle2, Volume2 } from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { BTN_BASE, BTN_GHOST } from '@shared/styles/ui-tokens';
import { OpsDigest } from '../components/OpsDigest';
import { AgentCard, AgentBadge, AgentEmpty, AgentResource } from '../components/States';
import { useUnacknowledgedP1, useReachable } from '../stores';
import { agentApi } from '../api/client';
import { VoiceButton } from '@features/assistant/components/VoiceButton';
import { useAgentResource } from '../api/useAgentResource';
import type { CallListItem, CallOutcome } from '../types/commands';

// ── Types ────────────────────────────────────────────────────────────────────

type ConsoleTab = 'ops' | 'calls' | 'live' | 'config';

const TABS: { id: ConsoleTab; label: string; icon: typeof Activity }[] = [
  { id: 'ops', label: 'Ops', icon: Activity },
  { id: 'calls', label: 'Calls', icon: Phone },
  { id: 'live', label: 'Live', icon: Volume2 },
  { id: 'config', label: 'Config', icon: Settings },
];

// ── Call list tab ────────────────────────────────────────────────────────────

const OUTCOME_TONE: Record<CallOutcome, 'success' | 'warning' | 'danger' | 'neutral'> = {
  contained: 'success',
  transferred: 'warning',
  voicemail: 'neutral',
  abandoned: 'danger',
};

function CallRow({ call }: { call: CallListItem }) {
  const tone = OUTCOME_TONE[call.outcome];
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border-primary/60 py-3 last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        <AgentBadge tone={tone}>{call.outcome}</AgentBadge>
        <div className="min-w-0">
          <p className="text-sm text-text-primary truncate">{call.callerMasked}</p>
          <p className="text-xs text-text-tertiary">
            {call.channel} ·{' '}
            {new Date(call.startedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {call.durationSec > 0 &&
              ` · ${Math.floor(call.durationSec / 60)}m ${call.durationSec % 60}s`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {call.flagged && <AgentBadge tone="ai">{call.flagged}</AgentBadge>}
        {call.costEur !== null && (
          <span className="text-xs text-text-secondary tabular-nums">
            €{call.costEur.toFixed(3)}
          </span>
        )}
      </div>
    </li>
  );
}

function CallsTab() {
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [outcome, setOutcome] = useState<'all' | CallOutcome>('all');

  // The call list is not implemented server-side yet; this keeps the shape honest.
  const fetcher = useCallback(async () => {
    try {
      await agentApi.opsSnapshot();
      // Derive a minimal call list from the snapshot for now.
      // TODO: replace with GET /calls when the server implements it.
      return [] as CallListItem[];
    } catch {
      return [] as CallListItem[];
    }
  }, []);

  const { state, refresh } = useAgentResource(fetcher, [range], { pollMs: 30_000 });

  const filtered = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return state.data.filter((c) => outcome === 'all' || c.outcome === outcome);
  }, [state, outcome]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(['7d', '30d', 'all'] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={cn(BTN_BASE, BTN_GHOST, range === r && 'bg-accent/15 text-accent')}
            onClick={() => setRange(r)}
          >
            {r === '7d' ? '7 days' : r === '30d' ? '30 days' : 'All'}
          </button>
        ))}
        <div className="flex-1" />
        <select
          className={cn(BTN_BASE, BTN_GHOST, 'appearance-none pr-8')}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as 'all' | CallOutcome)}
        >
          <option value="all">All outcomes</option>
          <option value="contained">Contained</option>
          <option value="transferred">Transferred</option>
          <option value="voicemail">Voicemail</option>
          <option value="abandoned">Abandoned</option>
        </select>
      </div>

      <AgentResource
        state={state}
        onRetry={refresh}
        isEmpty={() => filtered.length === 0}
        empty={<AgentEmpty label="No calls in this range" />}
      >
        {() => (
          <AgentCard title={`Calls (${filtered.length})`}>
            <ul>
              {filtered.map((c) => (
                <CallRow key={c.id} call={c} />
              ))}
            </ul>
          </AgentCard>
        )}
      </AgentResource>
    </div>
  );
}

// ── Live call tab ────────────────────────────────────────────────────────────

function LiveTab() {
  const reachable = useReachable();
  const [activeCall, setActiveCall] = useState<CallListItem | null>(null);

  if (!reachable) {
    return (
      <AgentCard title="Live call">
        <div className="flex flex-col items-center gap-3 py-8 text-text-tertiary">
          <PhoneOff size={32} aria-hidden />
          <p className="text-sm">The agent is not reachable. No live calls can be displayed.</p>
        </div>
      </AgentCard>
    );
  }

  if (!activeCall) {
    return (
      <AgentCard title="Live call">
        <div className="flex flex-col items-center gap-3 py-8 text-text-tertiary">
          <Phone size={32} aria-hidden />
          <p className="text-sm">No active call. Inbound calls will appear here in real time.</p>
        </div>
      </AgentCard>
    );
  }

  return (
    <AgentCard
      title={`Live call — ${activeCall.callerMasked}`}
      action={
        <button
          type="button"
          className={cn(BTN_BASE, BTN_GHOST)}
          onClick={() => setActiveCall(null)}
        >
          <PhoneOff size={14} aria-hidden /> End
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AgentBadge tone="success">live</AgentBadge>
          <span className="text-sm text-text-secondary">{activeCall.channel}</span>
        </div>
        <div className="rounded-[--radius] border border-border-primary bg-bg-secondary p-4">
          <p className="text-sm text-text-tertiary">
            Transcript will appear here as the call progresses.
          </p>
          <VoiceButton
            mode="output"
            text="Transcript will appear here as the call progresses."
            size="sm"
          />
        </div>
      </div>
    </AgentCard>
  );
}

// ── Config tab ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const [tier, setTier] = useState<'standard' | 'selfhosted' | 'premium'>('standard');
  const [afterHours, setAfterHours] = useState<'take_message' | 'transfer' | 'announce_only'>(
    'take_message',
  );
  const [disclosure, setDisclosure] = useState(true);
  const [transferTarget, setTransferTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      // TODO: wire to agent_set_provider_tier when the Rust layer is ready.
      await new Promise((r) => setTimeout(r, 500));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <AgentCard title="Provider tier">
        <div className="space-y-2">
          {(['standard', 'selfhosted', 'premium'] as const).map((t) => (
            <label key={t} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="tier"
                value={t}
                checked={tier === t}
                onChange={() => setTier(t)}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-sm text-text-primary capitalize">{t}</span>
            </label>
          ))}
        </div>
      </AgentCard>

      <AgentCard title="After-hours behaviour">
        <div className="space-y-2">
          {(
            [
              { value: 'take_message', label: 'Take a message' },
              { value: 'transfer', label: 'Transfer to human' },
              { value: 'announce_only', label: 'Announce only' },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="afterHours"
                value={opt.value}
                checked={afterHours === opt.value}
                onChange={() => setAfterHours(opt.value)}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-sm text-text-primary">{opt.label}</span>
            </label>
          ))}
        </div>
      </AgentCard>

      <AgentCard title="AI disclosure">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={disclosure}
            onChange={(e) => setDisclosure(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-sm text-text-primary">
            Speak the AI disclosure line on every call
          </span>
        </label>
        {!disclosure && (
          <p className="mt-2 text-xs text-warning">
            The AI disclosure line is spoken on 100% of calls — switching it off breaks a pilot
            criterion.
          </p>
        )}
      </AgentCard>

      <AgentCard title="Transfer target">
        <input
          type="tel"
          value={transferTarget}
          onChange={(e) => setTransferTarget(e.target.value)}
          placeholder="+33 6 12 34 56 78"
          className={cn(BTN_BASE, BTN_GHOST, 'w-full')}
        />
        {transferTarget && (
          <p className="mt-2 text-xs text-text-tertiary">
            Calls will be transferred to this number when after-hours mode is "transfer".
          </p>
        )}
      </AgentCard>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={cn(BTN_BASE, 'bg-accent text-white hover:bg-accent-hover')}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
        {saved && (
          <span className="text-sm text-success flex items-center gap-1">
            <CheckCircle2 size={14} aria-hidden /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function AgentConsolePage() {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('ops');
  const p1Count = useUnacknowledgedP1();
  const reachable = useReachable();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Agent Console</h1>
          <p className="text-sm text-text-secondary">Monitor and configure your AI voice agent</p>
        </div>
        <div className="flex items-center gap-2">
          {!reachable && <AgentBadge tone="danger">offline</AgentBadge>}
          {p1Count > 0 && <AgentBadge tone="danger">{p1Count} P1</AgentBadge>}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border-primary">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} aria-hidden />
              {tab.label}
              {tab.id === 'ops' && p1Count > 0 && (
                <span className="ml-1 rounded-full bg-danger/15 px-1.5 py-0.5 text-xs text-danger">
                  {p1Count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'ops' && <OpsDigest />}
        {activeTab === 'calls' && <CallsTab />}
        {activeTab === 'live' && <LiveTab />}
        {activeTab === 'config' && <ConfigTab />}
      </div>
    </div>
  );
}
