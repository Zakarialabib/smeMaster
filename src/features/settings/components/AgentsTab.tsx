/**
 * AgentsTab — Agent roster & per-agent configuration in Settings.
 *
 * Backed by the Rust `agents` module via invokeCommand wrappers
 * (src/shared/services/db/invoke/agents.ts). This gives the Settings
 * surface a live view of the `agents` table — create, edit, delete,
 * and scope-check agents from the desktop UI.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  checkAgentScope,
  seedBuiltinAgents,
} from '@/shared/services/db/invoke/agents';

import { Button } from '@shared/components/ui/Button';
import { TextField } from '@shared/components/ui/TextField';
import { Badge } from '@shared/components/ui/Badge';
import { Toggle } from '@shared/components/ui/Toggle';
import { StyledSelect } from '@shared/components/ui/StyledSelect';
import { Modal } from '@shared/components/ui/Modal';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  Download,
  RefreshCw,
} from 'lucide-react';
import { t } from 'i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Agent {
  id: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  scope: Record<string, any>;
  tools: string[];
  channels: string[];
  budget: {
    hourlyTokens?: number;
    monthlyTokens?: number;
    maxConcurrent?: number;
    cooldownMs?: number;
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDERS = ['claude', 'openai', 'gemini', 'ollama', 'custom'];
const CHANNELS = ['voice', 'chat', 'email', 'cron', 'webhook'];
const TOOLS = ['search', 'send', 'draft', 'label', 'filter', 'archive'];

function scopeLabel(scope: Record<string, any>): string {
  if (!scope) return '—';
  const parts: string[] = [];
  if (scope.mailbox) parts.push(`mailbox:${scope.mailbox}`);
  if (scope.folder) parts.push(`folder:${scope.folder}`);
  if (scope.labels?.length) parts.push(`labels:${scope.labels.join(',')}`);
  if (scope.allowList?.length) parts.push(`allow:${scope.allowList.join(',')}`);
  if (scope.denyList?.length) parts.push(`deny:${scope.denyList.join(',')}`);
  return parts.join(' · ') || 'global';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scopeResult, setScopeResult] = useState<{ ok: boolean; reason?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listAgents();
      setAgents(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (values: Partial<Agent>) => {
    setSaving(true);
    try {
      const created = await createAgent({
        name: values.name ?? '',
        description: values.description,
        provider: values.provider ?? 'claude',
        model: values.model ?? '',
        scope: values.scope ?? {},
        tools: values.tools ?? [],
        channels: values.channels ?? [],
        budget: values.budget ?? {},
      });
      setAgents((prev) => [...prev, created]);
      setShowCreate(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: Partial<Agent>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await updateAgent(editing.id, {
        name: values.name,
        description: values.description,
        provider: values.provider,
        model: values.model,
        scope: values.scope,
        tools: values.tools,
        channels: values.channels,
        budget: values.budget,
        active: values.active,
      });
      setAgents((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
      setEditing(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm(t('settings.agents.confirmDelete'))) return;
    try {
      await deleteAgent(agentId);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to delete agent');
    }
  };

  const handleScopeCheck = async (agentId: string) => {
    try {
      const result = await checkAgentScope(agentId, { action: 'read', resource: 'inbox' });
      setScopeResult(result);
    } catch (e: any) {
      setScopeResult({ ok: false, reason: e?.message });
    }
  };

  const handleSeed = async () => {
    try {
      const seeded = await seedBuiltinAgents();
      setAgents((prev) => [...prev, ...seeded]);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to seed agents');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {t('settings.agents.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-destructive">
        {error}
        <Button variant="ghost" size="sm" onClick={load} className="ml-2">
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t('settings.agents.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleSeed}>
            <Download className="mr-1 h-3 w-3" />
            {t('settings.agents.seed')}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-3 w-3" />
            {t('settings.agents.add')}
          </Button>
        </div>
      </div>

      {/* Scope check result */}
      {scopeResult && (
        <div
          className={`rounded-md border p-3 text-sm ${
            scopeResult.ok
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {scopeResult.ok ? (
            <CheckCircle2 className="mr-1 inline h-4 w-4" />
          ) : (
            <XCircle className="mr-1 inline h-4 w-4" />
          )}
          {scopeResult.ok
            ? t('settings.agents.scopeOk')
            : `${t('settings.agents.scopeDenied')}: ${scopeResult.reason}`}
        </div>
      )}

      {/* Agent list */}
      <div className="space-y-2">
        {agents.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('settings.agents.empty')}
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between rounded-md border p-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant="default">{agent.provider}</Badge>
                  {agent.active ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{agent.model}</span>
                  <span className="mx-2">·</span>
                  <span>{scopeLabel(agent.scope)}</span>
                  <span className="mx-2">·</span>
                  <span>{agent.channels.join(', ')}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(agent)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleScopeCheck(agent.id)}>
                  <Shield className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <AgentModal onSave={handleCreate} onCancel={() => setShowCreate(false)} saving={saving} />
      )}

      {/* Edit Modal */}
      {editing && (
        <AgentModal
          initial={editing}
          onSave={handleUpdate}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentModal — shared create/edit form
// ---------------------------------------------------------------------------

function AgentModal({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Agent | null;
  onSave: (values: Partial<Agent>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [provider, setProvider] = useState(initial?.provider ?? 'claude');
  const [model, setModel] = useState(initial?.model ?? '');
  const [scopeMailbox, setScopeMailbox] = useState(initial?.scope?.mailbox ?? '');
  const [tools, setTools] = useState<string[]>(initial?.tools ?? []);
  const [channels, setChannels] = useState<string[]>(initial?.channels ?? ['chat']);
  const [active, setActive] = useState(initial?.active ?? true);

  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const handleSave = () => {
    onSave({
      name,
      description,
      provider,
      model,
      scope: scopeMailbox ? { mailbox: scopeMailbox } : {},
      tools,
      channels,
      active,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={initial ? t('settings.agents.edit') : t('settings.agents.add')}
    >
      <div className="space-y-4 p-4">
        <h3 className="text-lg font-semibold">
          {initial ? t('settings.agents.edit') : t('settings.agents.add')}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('common.name')}</label>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.agents.namePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('settings.agents.description')}
            </label>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('settings.agents.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t('settings.agents.provider')}
              </label>
              <StyledSelect value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('settings.agents.model')}</label>
              <TextField
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('settings.agents.modelPlaceholder')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">{t('settings.agents.mailbox')}</label>
            <TextField
              value={scopeMailbox}
              onChange={(e) => setScopeMailbox(e.target.value)}
              placeholder={t('settings.agents.mailboxPlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">{t('settings.agents.tools')}</label>
            <div className="flex flex-wrap gap-2">
              {TOOLS.map((tool) => (
                <Button
                  key={tool}
                  variant={tools.includes(tool) ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setTools((prev) => toggleItem(prev, tool))}
                >
                  {tool}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('settings.agents.channels')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <Button
                  key={ch}
                  variant={channels.includes(ch) ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setChannels((prev) => toggleItem(prev, ch))}
                >
                  {ch}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Toggle checked={active} onChange={setActive} />
            <label className="text-sm font-medium">{t('settings.agents.active')}</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name}>
            {saving ? t('settings.agents.saving') : t('settings.agents.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
