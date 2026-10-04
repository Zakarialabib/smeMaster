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
 * @module
 */

import { useState, useCallback } from 'react';
import { Activity, Settings, Bot } from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { BTN_BASE, BTN_GLASS_PRIMARY } from '@shared/styles/ui-tokens';
import { OpsDigest } from '../components/OpsDigest';
import { AgentCard, AgentBadge } from '../components/States';
import { useUnacknowledgedP1, useReachable } from '../stores';
import { setSetting } from '@features/settings/db/settings';

// ── Types ────────────────────────────────────────────────────────────────────

type ConsoleTab = 'ops' | 'automations' | 'config';

const TABS: { id: ConsoleTab; label: string; icon: typeof Activity }[] = [
  { id: 'ops', label: 'Ops', icon: Activity },
  { id: 'automations', label: 'Automations', icon: Bot },
  { id: 'config', label: 'Config', icon: Settings },
];

// ── Automations tab ──────────────────────────────────────────────────────────

interface AutomationRule {
  id: string;
  name: string;
  channel: 'email' | 'social';
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun: string | null;
  runCount: number;
}

const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto-triage',
    name: 'Email Triage',
    channel: 'email',
    trigger: 'New email received',
    action: 'Categorize + summarize + flag urgent',
    enabled: true,
    lastRun: null,
    runCount: 0,
  },
  {
    id: 'auto-draft',
    name: 'Smart Draft Replies',
    channel: 'email',
    trigger: 'Email from known contact',
    action: 'Generate draft reply with context',
    enabled: true,
    lastRun: null,
    runCount: 0,
  },
  {
    id: 'auto-followup',
    name: 'Follow-up Reminders',
    channel: 'email',
    trigger: 'No reply after 48h',
    action: 'Create task + suggest follow-up',
    enabled: false,
    lastRun: null,
    runCount: 0,
  },
  {
    id: 'auto-social',
    name: 'Social Media Monitor',
    channel: 'social',
    trigger: 'Brand mention detected',
    action: 'Summarize + suggest response',
    enabled: false,
    lastRun: null,
    runCount: 0,
  },
];

function AutomationsTab() {
  const [rules, setRules] = useState<AutomationRule[]>(DEFAULT_AUTOMATIONS);
  const [saving, setSaving] = useState(false);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting('agent_automation_rules', JSON.stringify(rules));
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, [rules]);

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            {enabledCount} of {rules.length} automations active
          </p>
        </div>
        <button
          type="button"
          className={cn(BTN_BASE, BTN_GLASS_PRIMARY)}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <AgentCard
            key={rule.id}
            title={rule.name}
            action={
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-xs text-text-secondary">{rule.enabled ? 'On' : 'Off'}</span>
              </label>
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
                  Last run: {new Date(rule.lastRun).toLocaleString()}
                </p>
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
  const [tier, setTier] = useState<'standard' | 'selfhosted' | 'premium'>('standard');
  const [autoDraft, setAutoDraft] = useState(true);
  const [autoCategorize, setAutoCategorize] = useState(true);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [smartReplies, setSmartReplies] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting('agent_tier', tier);
      await setSetting('ai_auto_draft_enabled', String(autoDraft));
      await setSetting('ai_auto_categorize', String(autoCategorize));
      await setSetting('ai_auto_summarize', String(autoSummarize));
      await setSetting('ai_smart_replies_enabled', String(smartReplies));
    } finally {
      setSaving(false);
    }
  }, [tier, autoDraft, autoCategorize, autoSummarize, smartReplies]);

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

      <AgentCard title="Email automations">
        <div className="space-y-3">
          {[
            { label: 'Auto-draft replies', value: autoDraft, set: setAutoDraft },
            { label: 'Auto-categorize threads', value: autoCategorize, set: setAutoCategorize },
            { label: 'Auto-summarize threads', value: autoSummarize, set: setAutoSummarize },
            { label: 'Smart reply suggestions', value: smartReplies, set: setSmartReplies },
          ].map((opt) => (
            <label key={opt.label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={opt.value}
                onChange={(e) => opt.set(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-sm text-text-primary">{opt.label}</span>
            </label>
          ))}
        </div>
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
