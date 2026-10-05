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
  persona?: string | null;
  role: string;
  description?: string | null;
  instructions?: string | null;
  knowledge_tiers: string;
  knowledge_collections: string;
  tools: string;
  channels: string;
  model_policy: string;
  enabled: number;
  is_builtin: number;
  budget_minor: number;
  currency: string;
  voice_provider?: string | null;
  voice_base_url?: string | null;
  voice_tts_voice?: string | null;
  voice_stt_model?: string | null;
  voice_tts_enabled?: number | null;
  voice_stt_enabled?: number | null;
  voice_tts_speed?: number | null;
  voice_offline_tts_dir?: string | null;
  voice_offline_stt_dir?: string | null;
  created_at: number;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANNELS = ['desktop', 'voice', 'whatsapp', 'cron'];
const TOOLS = [
  'text',
  'streaming',
  'embedding',
  'stt',
  'tts',
  'vision',
  'structured_output',
  'tool_calling',
];
const TIERS = ['T0', 'T1', 'T2', 'T3'];

/** Rust stores tools/channels/tiers as JSON-array TEXT. Parse tolerantly. */
function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function scopeLabel(agent: Agent): string {
  const tiers = parseList(agent.knowledge_tiers);
  const channels = parseList(agent.channels);
  const parts: string[] = [];
  if (tiers.length) parts.push(tiers.join(','));
  if (channels.length) parts.push(channels.join(','));
  return parts.join(' · ') || '—';
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
  const [scopeResult, setScopeResult] = useState<{ granted: boolean; reason?: string } | null>(
    null,
  );

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

  const handleCreate = async (values: AgentFormValues) => {
    setSaving(true);
    try {
      const created = await createAgent({
        name: values.name,
        role: values.role,
        description: values.description || undefined,
        instructions: values.instructions || undefined,
        knowledgeTiers: values.knowledgeTiers,
        tools: values.tools,
        channels: values.channels,
      });
      setAgents((prev) => [...prev, created]);
      setShowCreate(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: AgentFormValues) => {
    if (!editing) return;
    setSaving(true);
    try {
      // Patch map uses snake_case column names — the Rust side validates
      // against a closed ALLOWED list and rejects unknown keys loudly.
      const updated = await updateAgent(editing.id, {
        name: values.name,
        role: values.role,
        description: values.description,
        instructions: values.instructions,
        knowledge_tiers: values.knowledgeTiers,
        tools: values.tools,
        channels: values.channels,
        enabled: values.enabled ? 1 : 0,
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

  /** Probe the agent's grant for the first tool it declares, or 'text'. */
  const handleScopeCheck = async (agent: Agent) => {
    try {
      const tools = parseList(agent.tools);
      const probe = tools[0] ?? 'text';
      const result = await checkAgentScope(agent.id, 'tool', probe);
      setScopeResult(result);
    } catch (e: any) {
      setScopeResult({ granted: false, reason: e?.message });
    }
  };

  const handleSeed = async () => {
    try {
      await seedBuiltinAgents();
      await load();
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
            scopeResult.granted
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {scopeResult.granted ? (
            <CheckCircle2 className="mr-1 inline h-4 w-4" />
          ) : (
            <XCircle className="mr-1 inline h-4 w-4" />
          )}
          {scopeResult.granted
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
                  {agent.persona && <Badge variant="default">{agent.persona}</Badge>}
                  {agent.is_builtin === 1 && <Badge variant="info">builtin</Badge>}
                  {agent.enabled === 1 ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <span>{agent.role}</span>
                  <span className="mx-2">·</span>
                  <span>{scopeLabel(agent)}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(agent)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleScopeCheck(agent)}>
                  <Shield className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(agent.id)}
                  disabled={agent.is_builtin === 1}
                >
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

/** Form state shared by create + edit. Mirrors the Rust request/patch fields. */
interface AgentFormValues {
  name: string;
  role: string;
  description: string;
  instructions: string;
  knowledgeTiers: string[];
  tools: string[];
  channels: string[];
  enabled: boolean;
}

function AgentModal({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Agent | null;
  onSave: (values: AgentFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [tiers, setTiers] = useState<string[]>(parseList(initial?.knowledge_tiers));
  const [tools, setTools] = useState<string[]>(parseList(initial?.tools));
  const [channels, setChannels] = useState<string[]>(parseList(initial?.channels));
  const [enabled, setEnabled] = useState((initial?.enabled ?? 1) === 1);

  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const handleSave = () => {
    onSave({
      name,
      role,
      description,
      instructions,
      knowledgeTiers: tiers,
      tools,
      channels,
      enabled,
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
            <label className="mb-1 block text-sm font-medium">{t('settings.agents.role')}</label>
            <TextField
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t('settings.agents.rolePlaceholder')}
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

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('settings.agents.instructions')}
            </label>
            <TextField
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t('settings.agents.instructionsPlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              {t('settings.agents.knowledgeTiers')}
            </label>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((tier) => (
                <Button
                  key={tier}
                  variant={tiers.includes(tier) ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setTiers((prev) => toggleItem(prev, tier))}
                >
                  {tier}
                </Button>
              ))}
            </div>
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
            <Toggle checked={enabled} onChange={setEnabled} />
            <label className="text-sm font-medium">{t('settings.agents.active')}</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name || !role}>
            {saving ? t('settings.agents.saving') : t('settings.agents.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
