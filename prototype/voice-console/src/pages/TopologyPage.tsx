import { useReachable, useOpsStore, useRoutingStore } from '../store';
import {
  Panel, PanelHead, Pill, Button, DegradedBanner, Note, SectionTitle, DataTable, Card,
  AiBanner,
} from '../components/ui';
import { ProviderBadge } from '../components/ProviderBadge';
import type { ProviderRef } from '../types';

/**
 * Topology — the "what runs where" screen.
 *
 * Two questions this page answers:
 *   1. Which machine holds the keys for which provider?
 *   2. What capability does the local machine have that the cloud one doesn't?
 *
 * The provider lists are DERIVED from the current task routing, not hard-coded.
 * Applying a preset on Config updates this page without a second edit.
 */

export function TopologyPage() {
  const reachable = useReachable();
  const setReachable = useOpsStore((s) => s.setReachable);
  const routes = useRoutingStore((s) => s.routes);

  /* Which providers each node talks to. Split by slot ownership: LLM and
     embeddings can run locally (self-hosted tier); voice and email are
     cloud-only in v1. */
  const desktopProviders = routes
    .filter((r) => ['voice.llm', 'rag.embedQuery', 'rag.embedDocument'].includes(r.task))
    .map((r) => r.primary);

  const vpsProviders = routes
    .filter((r) => ['voice.stt', 'voice.tts', 'voice.realtime', 'email.classify', 'email.compose', 'email.summarize'].includes(r.task))
    .map((r) => r.primary);

  return (
    <>
      <Panel>
        <PanelHead
          title="Topology & capabilities"
          sub="where each job runs, and what this device can do"
          right={<Pill tone={reachable ? 'ok' : 'p1'}>{reachable ? 'agent-core reachable' : 'agent-core OFFLINE'}</Pill>}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, alignItems: 'stretch' }}>
          <Node title="This desktop" tag="Tauri v2 · React 19 · SMEMaster" rows={[
            { ok: true,  t: 'Console — digest, call log, live, config, cost' },
            { ok: true,  t: 'Local RAG — candle + LanceDB, offline (384-d)' },
            { ok: true,  t: 'Provider keys — self-hosted tier only', key: true },
            { ok: false, t: 'ml-sidecar — local tier, disabled (RTF unmeasured)' },
            { ok: false, t: 'Answering calls if powered off' },
          ]} />

          <div style={{ alignSelf: 'center', color: 'var(--text-tertiary)', fontSize: 20, flex: '0 0 auto', padding: '0 4px' }} aria-hidden>⇄</div>

          <Node title="agent-core (EU VPS)" tag="Python · FastAPI · wss://…" rows={[
            { ok: true, t: 'Carrier media stream — inbound FR DID' },
            { ok: true, t: 'Turn loop — LLM · TTS · STT (cloud tier)' },
            { ok: true, t: 'WhatsApp — official BSP (prod) / Baileys (dev)' },
            { ok: true, t: 'Metering · ops snapshot · alerts' },
            { ok: true, t: 'Answers calls when the office is shut' },
            { ok: true, warn: true, t: 'Compromise exposes transcripts, not vendor accounts' },
          ]} />
        </div>

        {/* ── Provider connections per node ───────────────────────────── */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
          <SectionTitle style={{ marginBottom: 10 }}>Provider connections</SectionTitle>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            <div style={{
              padding: 12, borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>This desktop calls</strong>
                <Pill tone="ai">keys here</Pill>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {dedupeProviderRefs(desktopProviders).map((p) => (
                  <ProviderBadge key={`${p.provider}-${p.model}`} provider={p.provider} model={p.model} muted />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                Local tier only. Cloud tier keeps these on the VPS.
              </div>
            </div>

            <div style={{
              padding: 12, borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>agent-core calls</strong>
                <Pill tone="tr">keys on the VPS</Pill>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {dedupeProviderRefs(vpsProviders).map((p) => (
                  <ProviderBadge key={`${p.provider}-${p.model}`} provider={p.provider} model={p.model} muted />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                Derived from the current task routing. Applying a preset updates this list.
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
          <SectionTitle style={{ marginBottom: 8 }}>Tier — decides where the keys live</SectionTitle>

          <DataTable
            rows={[
              { id: 'a', tier: 'Standard (cloud)',    runs: 'agent-core, cloud vendors', keys: 'the VPS',       state: '● active' },
              { id: 'b', tier: 'Self-hosted (local)', runs: 'this desktop, offline',     keys: 'this desktop',  state: '⛠ disabled — RTF unmeasured' },
              { id: 'c', tier: 'Premium',             runs: 'agent-core, ElevenLabs',    keys: 'the VPS',       state: '○ available' },
            ]}
            rowKey={(r) => r.id}
            columns={[
              { key: 't', header: 'Tier',         render: (r: { tier: string })  => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.tier}</span> },
              { key: 'r', header: 'Speech runs',  render: (r: { runs: string })  => r.runs },
              { key: 'k', header: 'Keys live on', render: (r: { keys: string })  => <strong>{r.keys}</strong> },
              { key: 's', header: 'State',        render: (r: { state: string }) => r.state.includes('active') ? <Pill tone="ok">{r.state}</Pill> : <Pill tone="flag">{r.state}</Pill> },
            ]}
          />

          <Note>
            ⚠️ <strong>Only one tier is local at a time.</strong> Whichever provider the agent calls
            must have a key on the machine running it. Selecting a cloud tier moves the keys to the
            VPS; selecting self-hosted keeps them here. The console never implies both are local.
            <div style={{ marginTop: 8 }}>
              <Button size="sm" onClick={() => setReachable(!reachable)}>
                Simulate agent-core {reachable ? 'offline' : 'reachable'}
              </Button>
            </div>
          </Note>
        </div>

        <AiBanner
          title="Capability gaps this device cannot close"
          body="Inferred from a capability probe, not a config file: no local speech models installed, no GPU execution provider, and no microphone capture permission. It can run the console; it cannot run the local tier today."
        />
      </Panel>

      {!reachable && (
        <DegradedBanner
          title="We cannot reach the agent — last seen 14:51"
          body="The desktop and its local features keep working: the console renders, the local RAG searches, settings are still editable locally. What is not working is anything that needs the agent — including answering calls. If the agent is down, inbound calls go to the carrier's failover, not to voicemail."
          action={
            <span style={{ display: 'flex', gap: 8 }}>
              <Button primary size="sm" onClick={() => setReachable(true)}>Retry connection</Button>
              <Pill tone="p1">P1 — calls are unanswered</Pill>
            </span>
          }
        />
      )}
    </>
  );
}

/** Two slots can route to the same provider + model; badge them once. */
function dedupeProviderRefs(refs: ProviderRef[]): ProviderRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const k = `${r.provider}|${r.model}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function Node({ title, tag, rows }: {
  title: string;
  tag: string;
  rows: { ok: boolean; warn?: boolean; t: string; key?: boolean }[];
}) {
  return (
    <Card style={{ flex: '1 1 320px', minWidth: 'min(100%,320px)', padding: 12 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{title}</h3>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tag}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={r.t.slice(0, 24) + i} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
            color: r.warn ? 'var(--warning)' : 'var(--text-secondary)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999, flex: 'none',
              background: r.key ? 'var(--ai)'
                : r.warn    ? 'var(--warning)'
                : r.ok      ? 'var(--success)'
                : 'var(--text-tertiary)',
            }} />
            <span>{r.t}{r.key && <strong> · keys here</strong>}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}