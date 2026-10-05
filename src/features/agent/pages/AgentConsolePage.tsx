/**
 * Agent Console — the operator surface for agentic AI automation.
 *
 * Focus: AI agents that automate email and social channels.
 * The voice call system is dropped — too many hard dependencies
 * (SIP, telephony, realtime audio). Instead, agentic AI handles
 * email triage, drafting, sending, and social media management.
 *
 * Layout: top-nav sections (Ops · Automations · Config) with an AI
 * callout per section, following the unified design system.
 *
 * All data flows through Tauri commands → local SQLite. No HTTP,
 * no Python, no auth token.
 *
 * @module
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity, Settings, Bot, Play } from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { BTN_BASE, BTN_GLASS_PRIMARY } from '@shared/styles/ui-tokens';
import { OpsDigest } from '../components/OpsDigest';
import { AgentCard, AgentBadge } from '../components/States';
import { useUnacknowledgedP1, useReachable, useAutomationStore, useConfigStore } from '../stores';

// ── Types ────────────────────────────────────────────────────────────────────

type ConsoleTab = 'ops' | 'automations' | 'config';

const TABS: { id: ConsoleTab; label: string; icon: typeof Activity }[] = [
  { id: 'ops', label: 'Ops', icon: Activity },
  { id: 'automations', label: 'Automations', icon: Bot },
  { id: 'config', label: 'Config', icon: Settings },
];

// ── Automations tab ──────────────────────────────────────────────────────────

function AutomationsTab() {
  const { rules, loading, toggle, run, refresh } = useAutomationStore();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRun = useCallback(
    async (id: string) => {
      setRunningId(id);
      setRunResult(null);
      try {
        const result = await run(id);
        setRunResult(result);
      } catch {
        setRunResult('Failed to run automation');
      } finally {
        setRunningId(null);
      }
    },
    [run],
  );

  const enabledCount = rules.filter((r) => r.enabled).length;

  if (loading && rules.length === 0) {
    return <div className="text-sm text-text-secondary">Loading automations…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {enabledCount} of {rules.length} automations active
        </p>
        <button
          type="button"
          className={cn(BTN_BASE, BTN_GLASS_PRIMARY)}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <AgentCard
            key={rule.id}
            title={rule.name}
            action={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(BTN_BASE, 'px-2 py-1 text-xs')}
                  onClick={() => void handleRun(rule.id)}
                  disabled={runningId === rule.id || !rule.enabled}
                >
                  {runningId === rule.id ? 'Running…' : <Play size={12} />}
                </button>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => void toggle(rule.id)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="text-xs text-text-secondary">{rule.enabled ? 'On' : 'Off'}</span>
                </label>
              </div>
            }
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AgentBadge tone={rule.channel === 'email' ? 'accent' : 'ai'}>
                  {rule.channel}
                </AgentBadge>
                <span className="text-xs text-text-tertiary">{rule.trigger}</span>
              </div>
              <p className="text-sm text-text-secondary">{rule.action}</p>
              {rule.lastRun && (
                <p className="text-xs text-text-tertiary">
                  Last run: {new Date(rule.lastRun).toLocaleString()} · {rule.runCount} runs
                </p>
              )}
              {runResult && rule.id === rules.find((r) => r.id === rule.id)?.id && (
                <p className="text-xs text-text-tertiary mt-1">{runResult}</p>
              )}
            </div>
          </AgentCard>
        ))}
      </div>
    </div>
  );
}

// ── Config tab ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const { tier, set, save, dirty, saving } = useConfigStore();

  const handleSave = useCallback(async () => {
    await save();
  }, [save]);

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
                onChange={() => set('tier', t)}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-sm text-text-primary capitalize">{t}</span>
            </label>
          ))}
        </div>
      </AgentCard>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={cn(BTN_BASE, 'bg-accent text-white hover:bg-accent-hover')}
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
        >
          {saving ? 'Saving…' : 'Save configuration'}
        </button>
        {dirty && !saving && <span className="text-xs text-text-tertiary">Unsaved changes</span>}
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
          <p className="text-sm text-text-secondary">AI automation for email and social channels</p>
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
        {activeTab === 'automations' && <AutomationsTab />}
        {activeTab === 'config' && <ConfigTab />}
      </div>
    </div>
  );
}
