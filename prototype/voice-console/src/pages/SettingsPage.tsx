import { useState } from 'react';
import {
  HardDrive, KeyRound, ShieldCheck, Download, Trash2, Check,
  Plus, RefreshCw, AlertTriangle,
} from 'lucide-react';
import {
  useUiStore, useConfigStore, useKnowledgeStore,
  useCredentialsStore, useRoutingStore,
  useBrokenCredentialCount,
} from '../store';
import {
  Panel, PanelHead, Pill, Button, Note, DataTable, DegradedBanner, AiBanner,
  Tabs, Input, IconButton, KeyValueRow, SectionLabel,
  type Column, type TabItem, type PillTone,
} from '../components/ui';
import { ProviderBadge } from '../components/ProviderBadge';
import { PROVIDER_META, ALL_PROVIDERS } from '../providers/providerMeta';
import type {
  AiProvider, AiCapabilitySlot, TaskRoute, ProviderCredential,
} from '../types';

/**
 * Settings — the AI provider layer's control room.
 *
 *   1. BYOK       — the client enters their own keys. We never pay for tokens.
 *   2. Catalog    — every provider we can route to, with capability + test state.
 *   3. Routing    — which provider handles which slot (voice.stt, email.compose, ...).
 *
 * Layout primitives (Tabs, Input, IconButton, KeyValueRow, SectionLabel) come
 * from src/components/ui.tsx. This file holds only domain content.
 */

type Tab = 'providers' | 'keys' | 'local' | 'about';

const TABS: TabItem<Tab>[] = [
  { id: 'providers', label: 'Providers' },
  { id: 'keys',      label: 'Keys (BYOK)' },
  { id: 'local',     label: 'Local hardware' },
  { id: 'about',     label: 'About' },
];

const CAPABILITY_LABELS: Record<AiCapabilitySlot, string> = {
  'voice.stt':           'Voice STT',
  'voice.llm':           'Voice LLM',
  'voice.tts':           'Voice TTS',
  'voice.realtime':      'Voice realtime',
  'email.classify':      'Email classify',
  'email.compose':       'Email compose',
  'email.summarize':     'Email summarize',
  'rag.embedQuery':      'RAG embed (query)',
  'rag.embedDocument':   'RAG embed (doc)',
};

export function SettingsPage() {
  const tier = useConfigStore((s) => s.tier);
  const notify = useUiStore((s) => s.notify);
  const k = useKnowledgeStore();
  const [tab, setTab] = useState<Tab>('providers');
  const brokenCount = useBrokenCredentialCount();

  return (
    <Panel>
      <PanelHead
        title="Settings"
        sub="providers, task routing, and where the keys live"
        right={
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {brokenCount > 0 && (
              <Pill tone="p1">
                <AlertTriangle size={11} /> {brokenCount} credential{brokenCount > 1 ? 's' : ''} failing
              </Pill>
            )}
            <Tabs ariaLabel="Settings tabs" value={tab} onChange={setTab} tabs={TABS} />
          </span>
        }
      />

      {tab === 'providers' && <ProvidersTab />}
      {tab === 'keys' && <KeysTab />}
      {tab === 'local' && <LocalTab tier={tier} notify={notify} />}
      {tab === 'about' && (
        <AboutTab
          scopeEnabled={k.scope.filter((x) => x.enabled).length}
          scopeOff={k.scope.filter((x) => !x.enabled).length}
        />
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PROVIDERS TAB — catalog + routing table
   ══════════════════════════════════════════════════════════════════════════ */

function ProvidersTab() {
  const notify = useUiStore((s) => s.notify);
  const credentials = useCredentialsStore((s) => s.credentials);
  const test = useCredentialsStore((s) => s.test);
  const routes = useRoutingStore((s) => s.routes);
  const reset = useRoutingStore((s) => s.reset);

  const catalogColumns: Column<ProviderCredential>[] = [
    {
      key: 'p', header: 'Provider',
      render: (c) => <ProviderBadge provider={c.provider} showLabel />,
    },
    {
      key: 'cap', header: 'Capabilities',
      render: (c) => {
        const caps = PROVIDER_META[c.provider].capabilities;
        return (
          <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {caps.slice(0, 4).map((cap) => (
              <Pill key={cap} tone="off" style={{ fontSize: 10.5 }}>
                {CAPABILITY_LABELS[cap]}
              </Pill>
            ))}
            {caps.length > 4 && (
              <Pill tone="off" style={{ fontSize: 10.5 }}>+{caps.length - 4}</Pill>
            )}
          </span>
        );
      },
    },
    { key: 's', header: 'State', render: (c) => <CredentialStatePill credential={c} /> },
    {
      key: 'w', header: 'Last tested',
      render: (c) => (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {c.lastTestedAt ? c.lastTestedAt.slice(11, 16) : '—'}
        </span>
      ),
    },
    {
      key: 'a', header: '', align: 'end',
      render: (c) => (
        <Button
          size="sm"
          disabled={!c.configured}
          onClick={() => { void test(c.provider); notify(`Testing ${PROVIDER_META[c.provider].label}…`); }}
        >
          <RefreshCw size={11} /> Test
        </Button>
      ),
    },
  ];

  return (
    <>
      <div style={{ padding: 16 }}>
        <AiBanner
          title="Multi-provider strategy: OpenAI + Gemini primary, Mistral + BytePlus + OpenRouter extended"
          body="The task router picks a provider per slot. If the primary fails — 429, timeout, error — the fallback chain takes over and the Live page shows a coloured badge on that stage. The user's own subscription pays for every token; we never proxy their spend through our account."
          actions={
            <button
              className="focus-ring"
              onClick={() => notify('Route changes are prototype-only — the real app persists to settings')}
              style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--ai)', fontWeight: 600, fontSize: 12 }}
            >
              How routing works →
            </button>
          }
        />
      </div>

      <SectionLabel>Provider catalog</SectionLabel>
      <DataTable rows={credentials} columns={catalogColumns} rowKey={(c) => c.provider} />

      <div style={{ padding: 16 }}>
        <Note>
          <strong>Testing a credential</strong> calls <code>provider.testConnection()</code> through the
          four seams. In this prototype it is a fake 800ms async; in the real app it makes one cheap
          round-trip per provider (a 5-token completion for chat, an embed of "ping" for embeddings).
          A failing test flips the pill to <Pill tone="p1" style={{ fontSize: 11 }}>auth_failed</Pill> and
          the top-of-page badge counts it.
        </Note>
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <h2 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', margin: 0, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            Task routing
          </h2>
          <span style={{ flex: 1 }} />
          <Button size="sm" onClick={() => { reset(); notify('Routes reset to defaults'); }}>
            Reset to defaults
          </Button>
        </div>
        <Note style={{ marginBottom: 10 }}>
          One row per capability slot. The <strong>primary</strong> wins; the <strong>fallback chain</strong> is
          ordered — first match advances on failure. Rows marked <Pill tone="flag" style={{ fontSize: 11 }}>pinned</Pill> cannot
          be swapped without re-embedding the whole corpus (different models produce different vector spaces).
        </Note>
        <RoutingTable routes={routes} />
      </div>
    </>
  );
}

function RoutingTable({ routes }: { routes: TaskRoute[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {routes.map((r) => (
        <div
          key={r.task}
          style={{
            display: 'grid', gridTemplateColumns: '180px 1fr 2fr', gap: 12, alignItems: 'center',
            padding: '10px 12px', borderRadius: 'var(--radius)',
            background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>
              {CAPABILITY_LABELS[r.task]}
            </span>
            {r.pinned && <Pill tone="flag" style={{ fontSize: 10 }}>pinned</Pill>}
          </div>
          <div>
            <ProviderBadge provider={r.primary.provider} model={r.primary.model} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {r.fallback.length === 0
              ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>no fallback (pinned)</span>
              : r.fallback.map((f) => (
                  <ProviderBadge key={`${f.provider}-${f.model}`} provider={f.provider} model={f.model} muted />
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CredentialStatePill({ credential }: { credential: ProviderCredential }) {
  const map: Record<ProviderCredential['state'], { tone: PillTone; label: string }> = {
    ok:            { tone: 'ok',   label: '● ok' },
    untested:      { tone: 'flag', label: '○ untested' },
    auth_failed:   { tone: 'p1',   label: '✘ auth failed' },
    rate_limited:  { tone: 'flag', label: '⏱ rate limited' },
    unconfigured:  { tone: 'off',  label: '— unconfigured' },
  };
  const { tone, label } = map[credential.state];
  return <Pill tone={tone} title={credential.errorMessage}>{label}</Pill>;
}

/* ══════════════════════════════════════════════════════════════════════════
   KEYS TAB — BYOK, one row per provider
   ══════════════════════════════════════════════════════════════════════════ */

function KeysTab() {
  const credentials = useCredentialsStore((s) => s.credentials);
  const setCred = useCredentialsStore((s) => s.set);
  const test = useCredentialsStore((s) => s.test);
  const notify = useUiStore((s) => s.notify);

  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [draft, setDraft] = useState('');

  const commit = async (provider: AiProvider) => {
    if (!draft.trim()) return;
    setCred(provider, draft);
    setEditing(null);
    setDraft('');
    notify(`Key stored for ${PROVIDER_META[provider].label} — testing…`);
    await test(provider);
    notify(`${PROVIDER_META[provider].label} test: ok`);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Note>
        <strong>Bring-your-own-key.</strong> The client enters their own API key per provider. The console
        stores a <em>reference</em> to the key — the key value itself lives in the machine running the
        agent, never in this UI's state. The prototype marks the provider as <em>configured</em> and
        discards the entered value; the real app puts it in the Tauri keychain (desktop tier) or the
        agent-core secret store (cloud tier).
      </Note>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ALL_PROVIDERS.map((provider) => {
          const c = credentials.find((x) => x.provider === provider)!;
          const meta = PROVIDER_META[provider];
          const isEditing = editing === provider;

          return (
            <div
              key={provider}
              style={{
                display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 12, alignItems: 'center',
                padding: '12px 14px', borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-primary)',
                border: `1px solid ${c.state === 'auth_failed' ? 'rgba(225,29,72,.3)' : 'var(--border-primary)'}`,
              }}
            >
              <div>
                <ProviderBadge provider={provider} showLabel />
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {meta.baseUrlHost}
                </div>
              </div>

              <div>
                {isEditing ? (
                  <Input
                    type="password"
                    autoFocus
                    monospace
                    placeholder={`Paste ${meta.label} API key…`}
                    value={draft}
                    onChange={setDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commit(provider);
                      if (e.key === 'Escape') { setEditing(null); setDraft(''); }
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyRound size={12} color={c.configured ? 'var(--ai)' : 'var(--text-tertiary)'} />
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {c.configured ? '••••••••••••' : <em style={{ color: 'var(--text-tertiary)' }}>no key on file</em>}
                    </span>
                    <CredentialStatePill credential={c} />
                    {c.errorMessage && (
                      <span style={{ fontSize: 11.5, color: 'var(--danger)' }}>{c.errorMessage}</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {isEditing ? (
                  <>
                    <Button primary size="sm" onClick={() => void commit(provider)} disabled={!draft.trim()}>
                      <Check size={12} /> Save & test
                    </Button>
                    <Button size="sm" onClick={() => { setEditing(null); setDraft(''); }}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => { setEditing(provider); setDraft(''); }}>
                      {c.configured
                        ? <><RefreshCw size={12} /> Replace</>
                        : <><Plus size={12} /> Add key</>}
                    </Button>
                    {c.configured && (
                      <IconButton
                        icon={<Check size={13} />}
                        title="Test connection"
                        tone="accent"
                        onClick={() => void test(provider)}
                      />
                    )}
                    {c.configured && (
                      <IconButton
                        icon={<Trash2 size={13} />}
                        title="Revoke key"
                        tone="danger"
                        onClick={() => notify(`${meta.label} key would be revoked — prototype is a no-op`)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Note>
        <strong>Where each key lives, per tier.</strong> Cloud tier (Standard / Premium) puts every
        credential on the agent-core VPS. Desktop tier (self-hosted) keeps the local-provider
        credentials (Ollama, LM Studio) on this machine. A provider whose key lives on the wrong
        machine will show <Pill tone="p1" style={{ fontSize: 11 }}>auth_failed</Pill> at test time — the
        seam is doing the right thing, the deployment is wrong.
      </Note>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LOCAL TAB
   ══════════════════════════════════════════════════════════════════════════ */

const LOCAL_TIER = [
  { id: 'stt', task: 'Speech to text', engine: 'sherpa-onnx zipformer (FR/EN)', rtf: 'not measured', state: 'blocked' as const, size: '~70 MB' },
  { id: 'tts', task: 'Text to speech', engine: 'sherpa-onnx Piper / Kokoro', rtf: 'not measured', state: 'blocked' as const, size: '~60 MB' },
  { id: 'vad', task: 'Voice activity', engine: 'sherpa-onnx Silero VAD', rtf: 'not measured', state: 'blocked' as const, size: '~2 MB' },
  { id: 'llm', task: 'LLM', engine: 'mistral.rs / Qwen2.5-14B', rtf: 'n/a', state: 'unavailable' as const, size: '~9 GB' },
];

const CAPS = [
  { id: '1', cap: 'Speech to text', value: 'available', via: 'sherpa-onnx 1.11 (Apache-2.0)', state: 'ok' as const },
  { id: '2', cap: 'Text to speech', value: 'available', via: 'sherpa-onnx 1.11 (Apache-2.0)', state: 'ok' as const },
  { id: '3', cap: 'Voice activity detection', value: 'available', via: 'sherpa-onnx Silero VAD', state: 'ok' as const },
  { id: '4', cap: 'Execution providers', value: 'cpu', via: 'no GPU detected on this host', state: 'warn' as const },
  { id: '5', cap: 'Microphone capture', value: 'not granted', via: 'not requested — the console never records audio', state: 'off' as const },
  { id: '6', cap: 'Local embedding models', value: '1 installed', via: 'bge-small-en-v1.5, 384-d, ENGLISH-ONLY', state: 'warn' as const },
];

function LocalTab({ tier, notify }: { tier: string; notify: (m: string) => void }) {
  return (
    <>
      <div style={{ padding: 16 }}>
        <SectionLabel>This device's capabilities</SectionLabel>
        <DataTable
          rows={CAPS}
          rowKey={(r) => r.id}
          columns={[
            { key: 'c', header: 'Capability', render: (r: typeof CAPS[number]) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.cap}</span> },
            { key: 'v', header: 'Value', render: (r: typeof CAPS[number]) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{r.value}</span> },
            { key: 'vi', header: 'Via', render: (r: typeof CAPS[number]) => <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.via}</span> },
            {
              key: 's', header: 'State', render: (r: typeof CAPS[number]) => r.state === 'ok'
                ? <Pill tone="ok">ok</Pill>
                : r.state === 'warn' ? <Pill tone="flag">check</Pill>
                : <Pill tone="off">n/a</Pill>,
            },
          ]}
        />
        <DegradedBanner tone="warning" title="The local embedding model is English-only"
          body="bge-small-en-v1.5 is hard-coded in six places. A French query against it retrieves nothing useful, silently — an English test passes. This is the blocking item in RAG-FORK.md." />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
        <SectionLabel>Local tier — models</SectionLabel>
        <DataTable
          rows={LOCAL_TIER}
          rowKey={(r) => r.id}
          columns={[
            { key: 't', header: 'Task', render: (r: typeof LOCAL_TIER[number]) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.task}</span> },
            { key: 'e', header: 'Engine', render: (r: typeof LOCAL_TIER[number]) => <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{r.engine}</span> },
            { key: 'z', header: 'Size', align: 'end', render: (r: typeof LOCAL_TIER[number]) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.size}</span> },
            { key: 'r', header: 'RTF', align: 'end', render: (r: typeof LOCAL_TIER[number]) => <Pill tone="flag">{r.rtf}</Pill> },
            {
              key: 's', header: 'State', render: (r: typeof LOCAL_TIER[number]) => r.state === 'blocked'
                ? <Pill tone="flag">⛠ blocked</Pill>
                : <Pill tone="off">⛠ unavailable</Pill>,
            },
            {
              key: 'a', header: '', align: 'end', render: (r: typeof LOCAL_TIER[number]) => (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <Button size="sm" disabled={r.state !== 'blocked'} onClick={() => notify(`Downloading ${r.engine}…`)}>
                    <Download size={12} /> Get
                  </Button>
                  <IconButton icon={<Trash2 size={13} />} disabled title="Remove model" />
                </span>
              ),
            },
          ]}
        />
        <DegradedBanner
          title={`Local tier is unavailable — RTF not measured (tier is ${tier})`}
          body="The budget tier is gated on measured real-time factor. An engine at RTF 1.4 cannot serve a live call however good its WER, so it stays disabled with the reason shown rather than hidden."
        />
        <AiBanner
          title="This device can close 3 of 4 gaps; one needs hardware"
          body="STT, TTS and VAD are all satisfiable on CPU today. The LLM would need roughly 9 GB of disk and a GPU to stay under RTF 1 — that is an upgrade conversation, not a settings change."
        />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ABOUT TAB
   ══════════════════════════════════════════════════════════════════════════ */

function AboutTab({ scopeEnabled, scopeOff }: { scopeEnabled: number; scopeOff: number }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <KeyValueRow k="Prototype"      v="high-fidelity React prototype — not product code" />
      <KeyValueRow k="Stack"          v="React 19 · Zustand 5 · Vite 7 · lucide-react" />
      <KeyValueRow k="Design tokens"  v="copied verbatim from src/styles/globals.css (@theme)" />
      <KeyValueRow k="Token classes"  v="src/shared/styles/ui-tokens.ts (FOCUS_RING, BTN_PRIMARY, CARD_BASE)" />
      <KeyValueRow k="Nav source"     v="navConfig.ts — NAV_GROUPS, INSIGHT_WIDGETS" />
      <KeyValueRow k="Payload shapes" v="docs/voice/design/BACKEND.md §13" />
      <KeyValueRow k="Stores & WS"    v="docs/voice/design/FRONTEND.md §12" />
      <KeyValueRow k="Alert matrix"   v="docs/voice/dev/OPS-ASSISTANT.md §3" />
      <KeyValueRow k="Forbidden"      v="no audio UI · no barge-in control · no provider SDK in the console · no tenantId from the client · no prompt editor" />
      <Note>
        <strong>Voice is FR/EN only.</strong> The app ships 5 UI locales (en/fr/ar/ja/it) and
        that is a separate fact from what the agent speaks. The `ar` interface never offers
        Arabic voice.
      </Note>
      <AiBanner
        title="Knowledge scope: 4-tier client-owned guardrail"
        body={`Currently ${scopeEnabled} scopes on, ${scopeOff} off. T3 (confidential: payments/HR/legal) forced off by design. T2 internal requires client-local node.`}
      />
    </div>
  );
}