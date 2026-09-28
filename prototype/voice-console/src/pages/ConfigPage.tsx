import { useState } from 'react';
import { Play, Lock } from 'lucide-react';
import { useConfigStore, useKnowledgeStore, useUiStore, useReachable, useOpsStore } from '../store';
import { COST_ROWS, DAILY_MINUTES } from '../data';
import {
  Panel, PanelHead, Pill, Button, DegradedBanner, Note, Labeled, Select, Radio, Checkbox,
  DataTable, AiBanner, type Column,
} from '../components/ui';
import type { CostRow } from '../types';

export function ConfigPage() {
  const c = useConfigStore();
  const notify = useUiStore((s) => s.notify);
  const [testing, setTesting] = useState(false);

  return (
    <Panel>
      <PanelHead title="Config" sub="changes are per-tenant" right={<Pill tone="off">no prompt editor — by decision</Pill>} />

      <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
        <h2 style={H2}>Voice</h2>
        <Labeled label="Language pair">
          <Pill tone="ok">FR ✓</Pill><Pill tone="ok">EN ✓</Pill>
          <Pill tone="off" title="Voice is FR/EN only. The UI ships 5 locales; that is separate.">AR — permanently off</Pill>
        </Labeled>
        <Labeled label="TTS voice (FR)">
          <Select ariaLabel="French TTS voice" value={c.voiceFr} onChange={(v) => c.set('voiceFr', v)}
            options={[{ v: 'siwis-medium', l: 'siwis-medium' }, { v: 'marie', l: 'marie' }]} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>1 024 cached phrases · cache invalidated on change</span>
        </Labeled>
        <Labeled label="TTS voice (EN)">
          <Select ariaLabel="English TTS voice" value={c.voiceEn} onChange={(v) => c.set('voiceEn', v)}
            options={[{ v: 'matilda', l: 'matilda' }, { v: 'rachel', l: 'rachel' }]} />
        </Labeled>
        <Labeled label="Disclosure line">
          <Checkbox checked={c.disclosureEnabled} onChange={() => c.set('disclosureEnabled', !c.disclosureEnabled)}
            label="Spoken on 100% of calls" />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>« Cet appel est pris en charge par un assistant IA… »</span>
        </Labeled>
        <div style={{ padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 200 }} />
          <Button primary onClick={() => { setTesting(true); setTimeout(() => { setTesting(false); notify('Preview played (FR + EN, 6s) — no audio is ever stored'); }, 900); }}>
            <Play size={13} /> {testing ? 'Playing…' : 'Test greeting + disclosure (6s)'}
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>plays the real voice — catches a broken voice id before you save</span>
        </div>
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
        <h2 style={H2}>Availability</h2>
        <Labeled label="Business hours">
          <input value={c.hours} onChange={(e) => c.set('hours', e.target.value)} aria-label="Business hours"
            style={{ font: 'inherit', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)', padding: '6px 10px', width: 200 }} />
          <Select ariaLabel="Time zone" value={c.tz} onChange={(v) => c.set('tz', v)} options={[{ v: 'Europe/Paris', l: 'Europe/Paris' }]} />
        </Labeled>
        <Labeled label="Transfer target" hint="required whenever the agent answers in-hours">
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>{c.transferTarget}</span>
          <Pill tone="ok">required</Pill>
        </Labeled>
        <Labeled label="After hours">
          <span style={{ display: 'inline-flex', gap: 14 }}>
            <Radio name="ah" checked={c.afterHours === 'take_message'} label="take message" onChange={() => c.set('afterHours', 'take_message')} />
            <Radio name="ah" checked={c.afterHours === 'transfer'} label="transfer" onChange={() => c.set('afterHours', 'transfer')} />
            <Radio name="ah" checked={c.afterHours === 'announce_only'} label="announce only" onChange={() => c.set('afterHours', 'announce_only')} />
          </span>
        </Labeled>
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
        <h2 style={H2}>Tier</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TierCard title="Budget · self-hosted" price="—" state="unavailable — latency unmeasured, Gate 4" disabled />
          <TierCard title="Standard · cloud" price="€0.19/min" state="signed model" active={c.tier === 'standard'}
            onClick={() => c.set('tier', 'standard')} />
          <TierCard title="Premium · ElevenLabs" price="€0.28/min" state="best quality, higher cost" active={c.tier === 'premium'}
            onClick={() => c.set('tier', 'premium')} />
        </div>
        <DegradedBanner tone="warning" title="Budget tier unavailable"
          body="The self-hosted tier is disabled because its end-of-turn latency has not been measured yet. It is shown with the reason rather than hidden — a missing option becomes a support ticket." />
      </div>

      <div style={{ padding: 16, background: 'var(--bg-tertiary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Lock size={14} color="var(--text-tertiary)" style={{ flex: 'none', marginTop: 2 }} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <strong>Behaviour is read-only here.</strong> Prompts, the tool set and the assistant's
          "never" list are <em>not</em> editable in the console — see <code>dev/AGENT-PROMPTS.md</code>.
          If you want different wording, that is a change request, not a setting.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)', position: 'sticky', bottom: 0 }}>
        {c.dirty && <span style={{ alignSelf: 'center', marginInlineEnd: 'auto', fontSize: 12, color: 'var(--warning)' }}>Unsaved changes — leaving now discards them (Esc)</span>}
        <Button onClick={() => { c.discard(); notify('Changes discarded'); }}>Discard</Button>
        <Button primary disabled={!c.dirty} onClick={() => { c.save(); notify('Saved · tier change applies to the next call, never a live one'); }}>
          Save changes
        </Button>
      </div>
    </Panel>
  );
}

const H2: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', margin: '0 0 8px', fontWeight: 600 };

function TierCard({ title, price, state, active, disabled, onClick }: {
  title: string; price: string; state: string; active?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="focus-ring"
      style={{
        textAlign: 'start', minWidth: 220, flex: '1 1 220px', cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-primary)'}`,
        background: active ? 'var(--accent-subtle)' : 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)', padding: 12, opacity: disabled ? 0.6 : 1, font: 'inherit',
      }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{active ? '● ' : '○ '}{title}</div>
      <div style={{ fontSize: 15, fontWeight: 600, margin: '4px 0', color: 'var(--text-primary)' }}>{price}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{state}</div>
    </button>
  );
}

/* ── Knowledge ────────────────────────────────────────────────────────────── */

export function KnowledgePage() {
  const k = useKnowledgeStore();
  const notify = useUiStore((s) => s.notify);

  return (
    <>
      <Panel>
        <PanelHead title="Knowledge" sub="what the agent is allowed to see" right={<Pill tone="off">publish is our operation — client undecided</Pill>} />
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
          <h2 style={H2}>Scope</h2>
          {([['services', 'Services & pricing', '142 chunks'], ['hours', 'Opening hours', '18 chunks'], ['rules', 'Booking rules', '31 chunks']] as const).map(([k2, l, n]) => (
            <Labeled key={k2} label="">
              <Checkbox checked={!!k.scope[k2]} onChange={() => k.toggle(k2)} label={l} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{n}</span>
            </Labeled>
          ))}
          <Labeled label="">
            <Checkbox checked={false} disabled label="Email" />
            <Pill tone="off">never enabled in v1</Pill>
          </Labeled>
          <Labeled label="">
            <Checkbox checked={false} disabled label="Contacts" />
            <Pill tone="off">needs an explicit decision</Pill>
          </Labeled>
        </div>
        <div style={{ padding: 16 }}>
          <h2 style={H2}>Index</h2>
          <Labeled label="Chunks"><span style={{ fontVariantNumeric: 'tabular-nums' }}>287 / 500</span></Labeled>
          <Labeled label="Embedding">
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>bge-m3 · 1024-d · self-hosted</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>ⓘ deliberately separate from the desktop's 384-d local index</span>
          </Labeled>
          <Labeled label="Ingest">
            <span>last 2 h ago</span><span style={{ color: 'var(--text-tertiary)' }}>·</span><span>next 22:00</span>
            <Button size="sm" onClick={() => { k.fail(); }}>Re-index now</Button>
          </Labeled>
        </div>

        <AiBanner
          title="4 digest answers cited no chunk"
          body="The agent may not know enough about refunds. Sample question: “remboursement sous 30 jours”. This is an inference from answer/retrieval pairs, not a recorded fact."
          actions={<><button className="focus-ring" style={{ background: 'none', border: 0, color: 'var(--ai)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>See the 4 answers →</button></>}
        />

        {k.ingest === 'failed' && (
          <div style={{ padding: '0 16px 12px' }}>
            <DegradedBanner title="Ingest stopped at 61% — the index is mixed"
              body="Services and hours are on the new index; booking rules are still on the old one. Answers may cite either. The previous complete index can be rolled back to."
              action={<span style={{ display: 'flex', gap: 8 }}><Button primary size="sm" onClick={() => { k.reset(); notify('Retry queued'); }}>Retry ingest</Button><Button size="sm" onClick={() => { k.reset(); notify('Rolled back to 14:20'); }}>Roll back to 14:20</Button></span>} />
          </div>
        )}

        <Note>Publishing re-indexes the agent's knowledge. It takes about 90 seconds and the agent keeps serving the previous index until it completes.</Note>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)' }}>
          <Button primary disabled={k.publishing} onClick={() => { k.publish(); setTimeout(() => { k.reset(); notify('Published · re-index queued (~90s)'); }, 1200); }}>
            {k.publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </Panel>
    </>
  );
}

/* ── Cost ─────────────────────────────────────────────────────────────────── */

export function CostPage() {
  const [group, setGroup] = useState<'call_type' | 'day'>('call_type');
  const totalMin = COST_ROWS.reduce((a, r) => a + (r.minutes ?? 0), 0);
  const totalActual = COST_ROWS.reduce((a, r) => a + r.actualEur, 0);
  const totalModel = COST_ROWS.reduce((a, r) => a + r.modelEur, 0);
  const perMin = totalActual / totalMin;
  const modelPerMin = totalModel / totalMin;
  const delta = ((perMin - modelPerMin) / modelPerMin) * 100;
  const max = Math.max(...DAILY_MINUTES);

  const columns: Column<CostRow>[] = [
    { key: 'l', header: 'Call type', render: (r) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span> },
    { key: 'c', header: 'Calls', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.calls}</span> },
    { key: 'm', header: 'Minutes', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.minutes ?? '—'}</span> },
    { key: 'a', header: 'Actual', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>€{r.actualEur.toFixed(2)}</span> },
    {
      key: 'v', header: 'vs model', align: 'end', render: (r) => {
        const d = r.modelEur === 0 ? 0 : ((r.actualEur - r.modelEur) / r.modelEur) * 100;
        return r.overModel
          ? <Pill tone="flag">⚑ +{d.toFixed(0)}%</Pill>
          : <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{d > 0 ? '+' : ''}{d.toFixed(0)}%</span>;
      },
    },
  ];

  return (
    <Panel>
      <PanelHead title="Cost" right={<Pill tone="flag">all figures UNVERIFIED</Pill>} />
      <Note>
        <strong>Vendor rates are not yet confirmed.</strong> These are the signed-model figures from
        <code> client/COST-MODEL.md</code>, whose §6 checklist is still open. Do not quote this screen to anyone.
      </Note>
      <div style={{ padding: 16, display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><div style={H2}>Volume</div><div style={BIG}>{totalMin.toFixed(0)} min · 128 calls</div></div>
        <div><div style={H2}>Signed model</div><div style={BIG}>€{modelPerMin.toFixed(2)}/min</div></div>
        <div>
          <div style={H2}>Actual</div>
          <div style={{ ...BIG, color: 'var(--warning)' }}>€{perMin.toFixed(2)}/min</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>⚠ {delta >= 0 ? '+' : ''}{delta.toFixed(0)}% · within the ±20% band</div>
        </div>
      </div>
      <div style={{ padding: '0 16px 8px' }}>
        <div role="img" aria-label="Sparkline: daily minutes over 24 days" style={{ fontSize: 30, letterSpacing: 2, color: 'var(--accent)' }}>
          {DAILY_MINUTES.map((m) => '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor((m / max) * 8))]).join('')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>minutes per day, 24 days · group the table by day for exact figures</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-primary)' }}>
        <strong style={{ fontSize: 13 }}>By {group.replace('_', ' ')}</strong>
        <Button size="sm" onClick={() => setGroup(group === 'call_type' ? 'day' : 'call_type')} primary={group === 'call_type'}>call type</Button>
        <Button size="sm" onClick={() => setGroup(group === 'day' ? 'call_type' : 'day')} primary={group === 'day'}>day</Button>
        <span style={{ flex: 1 }} />
        <Pill tone="flag">⚑ 4 over model</Pill>
      </div>
      <DataTable rows={COST_ROWS} columns={columns} rowKey={(r) => r.key} />
      <div style={{ padding: 16 }}>
        <Note>
          ⓘ <strong>Why WhatsApp text is €0.00.</strong> Those are user-initiated service
          conversations inside the 24-hour window, which Meta does not charge for. It is a policy
          consequence, not missing data — inbound-only v1 means Meta cost ≈ 0.
        </Note>
        <AiBanner
          title="4 of the over-model calls are after-hours"
          body="At the current tier that is expected: off-hours minutes are billed at the lower rate, so a higher per-minute figure there is not a regression. Re-check at 3,000 min/month, where the tier changes."
        />
      </div>
    </Panel>
  );
}

const BIG: React.CSSProperties = { fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums' };

/* ── Topology ─────────────────────────────────────────────────────────────── */

export function TopologyPage() {
  const reachable = useReachable();
  const setReachable = useOpsStore((s) => s.setReachable);

  return (
    <>
      <Panel>
        <PanelHead title="Topology & capabilities"
          sub="where each job runs, and what this device can do"
          right={<Pill tone={reachable ? 'ok' : 'p1'}>{reachable ? 'agent-core reachable' : 'agent-core OFFLINE'}</Pill>} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16, alignItems: 'stretch' }}>
          <Node title="This desktop" tag="Tauri v2 · React 19 · SMEMaster" rows={[
            { ok: true, t: 'Console — digest, call log, live, config, cost' },
            { ok: true, t: 'Local RAG — candle + LanceDB, offline (384-d)' },
            { ok: true, t: 'Provider keys — self-hosted tier only', key: true },
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

        <div style={{ padding: 16, borderTop: '1px solid var(--border-primary)' }}>
          <h2 style={H2}>Tier — decides where the keys live</h2>
          <DataTable
            rows={[
              { id: 'a', tier: 'Standard (cloud)', runs: 'agent-core, cloud vendors', keys: 'the VPS', state: '● active' },
              { id: 'b', tier: 'Self-hosted (local)', runs: 'this desktop, offline', keys: 'this desktop', state: '⛠ disabled — RTF unmeasured' },
              { id: 'c', tier: 'Premium', runs: 'agent-core, ElevenLabs', keys: 'the VPS', state: '○ available' },
            ]}
            rowKey={(r) => r.id}
            columns={[
              { key: 't', header: 'Tier', render: (r: { tier: string }) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.tier}</span> },
              { key: 'r', header: 'Speech runs', render: (r: { runs: string }) => r.runs },
              { key: 'k', header: 'Keys live on', render: (r: { keys: string }) => <strong>{r.keys}</strong> },
              { key: 's', header: 'State', render: (r: { state: string }) => r.state.includes('active') ? <Pill tone="ok">{r.state}</Pill> : <Pill tone="flag">{r.state}</Pill> },
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
          action={<span style={{ display: 'flex', gap: 8 }}><Button primary size="sm" onClick={() => setReachable(true)}>Retry connection</Button><Pill tone="p1">P1 — calls are unanswered</Pill></span>}
        />
      )}
    </>
  );
}

function Node({ title, tag, rows }: {
  title: string; tag: string;
  rows: { ok: boolean; warn?: boolean; t: string; key?: boolean }[];
}) {
  return (
    <div style={{
      flex: '1 1 320px', minWidth: 'min(100%,320px)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)', background: 'var(--bg-primary)', padding: 12,
    }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{title}</h3>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{tag}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {rows.map((r, i) => (
          <div key={r.t.slice(0, 24) + i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: r.warn ? 'var(--warning)' : 'var(--text-secondary)' }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999, flex: 'none',
              background: r.key ? 'var(--ai)' : r.warn ? 'var(--warning)' : r.ok ? 'var(--success)' : 'var(--text-tertiary)',
            }} />
            <span>{r.t}{r.key && <strong> · keys here</strong>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
