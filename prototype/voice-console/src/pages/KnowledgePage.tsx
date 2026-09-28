import { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { useKnowledgeStore, useUiStore } from '../store';
import {
  DegradedBanner,
  Panel, PanelHead, Pill, Button, Note, Labeled, Checkbox, AiBanner, SectionTitle,
} from '../components/ui';
import type { KnowledgeTier, KnowledgeScopeItem } from '../types';

/* ── Knowledge ──────────────────────────────────────────────────────────
   §3.2 four-tier framework: T0 public / T1 semi-public / T2 internal (local node) / T3 confidential (never)
   §5 innovation #6: 10-question scope wizard
   §5 innovation #20: scope is versioned — every change = new version
*/

const TIER_STYLE: Record<KnowledgeTier, { label: string; pillTone: 'ok' | 'ai' | 'flag' | 'p1'; bg: string; badge: string; description: string }> = {
  T0: { label: 'T0 · Public', pillTone: 'ok', bg: 'var(--success-light)', badge: '#059669', description: 'Hours, address, brands, services. Lives on our server. Default on.' },
  T1: { label: 'T1 · Semi-public', pillTone: 'ai', bg: 'var(--ai-subtle)', badge: 'var(--ai)', description: 'Price ranges, booking rules, staff first names. Encrypted to us. Default on.' },
  T2: { label: 'T2 · Internal', pillTone: 'flag', bg: 'var(--warning-light)', badge: 'var(--warning)', description: 'Client list, job history, vehicle records. Client premises ONLY via local node. Opt-in.' },
  T3: { label: 'T3 · Confidential', pillTone: 'p1', bg: '#ffe4e6', badge: 'var(--danger)', description: 'Payments, HR, legal/medical. NEVER reaches our server. Hard off. Escalates.' },
};

export function KnowledgePage() {
  const k = useKnowledgeStore();
  const notify = useUiStore((s) => s.notify);
  const [view, setView] = useState<'matrix' | 'wizard' | 'versions'>('matrix');

  return (
    <>
      <Panel>
        <PanelHead
          title="Knowledge"
          sub="what the agent is allowed to see — 4 tiers, client-owned guardrail"
          right={
            <span style={{ display: 'flex', gap: 4 }}>
              {(['matrix', 'wizard', 'versions'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className="focus-ring"
                  style={{
                    font: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 10px',
                    borderRadius: 'var(--radius)', border: 0,
                    background: view === v ? 'var(--accent-subtle)' : 'transparent',
                    color: view === v ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: view === v ? 600 : 400,
                  }}>
                  {v === 'matrix' ? 'Scope matrix' : v === 'wizard' ? '🧙 Scope wizard' : '🗂 Version history'}
                </button>
              ))}
            </span>
          }
        />

        {view === 'matrix' && <ScopeMatrix />}
        {view === 'wizard' && <ScopeWizard />}
        {view === 'versions' && <ScopeVersions />}

        <AiBanner
          title="4 digest answers cited no chunk — refunds policy missing"
          body="The agent may not know enough about refunds. Sample question: « remboursement sous 30 jours ». This is an inference from answer/retrieval pairs, not a recorded fact."
          actions={<><button className="focus-ring" style={{ background: 'none', border: 0, color: 'var(--ai)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>See the 4 answers →</button></>}
        />

        {k.ingest === 'failed' && (
          <div style={{ padding: '0 16px 12px' }}>
            <DegradedBanner title="Ingest stopped at 61% — the index is mixed"
              body="Services and hours are on the new index; booking rules are still on the old one. Answers may cite either. The previous complete index can be rolled back to."
              action={<span style={{ display: 'flex', gap: 8 }}><Button primary size="sm" onClick={() => { k.reset(); notify('Retry ingest queued'); }}>Retry ingest</Button><Button size="sm" onClick={() => { k.reset(); notify('Rolled back to 14:20'); }}>Roll back to 14:20</Button></span>} />
          </div>
        )}

        <Note>Publishing re-indexes the agent's knowledge. It takes about 90 seconds and the agent keeps serving the previous index until it completes.</Note>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)' }}>
          <Button primary disabled={k.publishing} onClick={() => { k.publish(); setTimeout(() => { k.reset(); notify('Published · re-index queued (~90s) · new scope version created'); }, 1200); }}>
            {k.publishing ? 'Publishing…' : 'Publish & create scope version'}
          </Button>
        </div>
      </Panel>
    </>
  );
}

/* ─── SCOPE MATRIX (default view) ────────────────────────────────────────── */

function ScopeMatrix() {
  const k = useKnowledgeStore();
  const tiers: KnowledgeTier[] = ['T0', 'T1', 'T2', 'T3'];
  return (
    <>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {tiers.map((t) => (
          <div key={t} style={{
            flex: '1 1 220px', minWidth: 220, padding: 12, borderRadius: 'var(--radius-lg)',
            background: TIER_STYLE[t].bg, border: `1px solid ${TIER_STYLE[t].badge}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: TIER_STYLE[t].badge }} />
              <strong style={{ color: TIER_STYLE[t].badge }}>{TIER_STYLE[t].label}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{TIER_STYLE[t].description}</div>
          </div>
        ))}
      </div>

      {tiers.map((tier) => {
        const items = k.scope.filter((s) => s.tier === tier);
        if (items.length === 0) return null;
        return (
          <div key={tier} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-secondary)' }}>
            <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: TIER_STYLE[tier].badge }} />
              <SectionTitle>{TIER_STYLE[tier].label}</SectionTitle>
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                · {items.filter((i) => i.enabled).length}/{items.length} enabled
                {tier === 'T2' && ' · 📍 client premises node required'}
                {tier === 'T3' && ' · ⛔ NEVER enabled by design'}
              </span>
            </div>
            {items.map((it) => <ScopeRow key={it.id} it={it} />)}
          </div>
        );
      })}

      <div style={{ padding: 16 }}>
        <h2 style={H2}>Index status</h2>
        <Labeled label="Chunks total"><span style={{ fontVariantNumeric: 'tabular-nums' }}>{k.scope.reduce((a, s) => a + (s.chunkCount ?? 0), 0)} chunks indexed</span></Labeled>
        <Labeled label="Embedding model">
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5 }}>bge-m3 · 1024-d · self-hosted</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>ⓘ deliberately separate from the desktop's 384-d local English-only index</span>
        </Labeled>
        <Labeled label="Ingest">
          <span>last 2 h ago</span><span style={{ color: 'var(--text-tertiary)' }}>·</span><span>next 22:00</span>
          <Button size="sm" onClick={() => { k.fail(); }}>Re-index now</Button>
        </Labeled>
      </div>
    </>
  );
}

function ScopeRow({ it }: { it: KnowledgeScopeItem }) {
  const k = useKnowledgeStore();
  const isT3 = it.tier === 'T3';
  const isT2 = it.tier === 'T2';
  return (
    <div style={{
      padding: '10px 16px 10px 40px', display: 'flex', gap: 12, alignItems: 'flex-start',
      borderTop: '1px solid var(--border-secondary)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox
            checked={it.enabled}
            disabled={isT3 || (isT2 && !it.enabled)}
            label={<strong style={{ color: isT3 ? 'var(--danger)' : 'var(--text-primary)' }}>{it.label}</strong>}
            onChange={() => k.toggle(it.id)}
          />
          <Pill tone={TIER_STYLE[it.tier].pillTone}>{TIER_STYLE[it.tier].label.split(' · ')[1]}</Pill>
          {it.chunkCount ? <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{it.chunkCount} chunks</span> : null}
          {isT2 && !it.enabled && <Pill tone="flag">📍 needs local node</Pill>}
          {isT3 && <Pill tone="p1">⛔ confidential — NEVER</Pill>}
        </div>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{it.description}</p>
        {it.examples.length > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Ex. {it.examples.slice(0, 3).map((e, i) => <span key={i}>« {e} »{i < it.examples.length - 1 ? ' · ' : ''}</span>)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── SCOPE WIZARD (innovation #6) ─────────────────────────────────────────
   Plain-language interview that produces the guardrail. 12 questions = 12 items.
   Resolves decision #5 (agent knowledge scope) from the brainstorm doc. */

function ScopeWizard() {
  const k = useKnowledgeStore();
  const notify = useUiStore((s) => s.notify);
  const questions = k.scope.filter((s) => s.wizardQuestion);
  const [answered, setAnswered] = useState<Record<string, boolean | null>>({});

  const onAns = (id: string, yes: boolean) => {
    const it = k.scope.find((s) => s.id === id);
    if (!it || it.tier === 'T3') return;
    setAnswered({ ...answered, [id]: yes });
    if (yes) {
      k.toggle(id);
      if (!it.enabled) k.toggle(id);
    } else {
      if (it.enabled) k.toggle(id);
    }
  };

  const done = Object.keys(answered).length;
  const total = questions.length;
  const t3Items = k.scope.filter((s) => s.tier === 'T3');

  return (
    <div style={{ padding: 16 }}>
      <AiBanner
        title="The wizard turns the guardrail into 12 plain-language questions"
        body="§4 decision #5 blocker: the client no longer has to decide « what content is allowed to reach our server ». They answer 12 yes/no questions. Every T3 item is forced to NO with an explanation. The 4-tier framework runs behind the UX."
      />
      <div style={{ margin: '12px 0 16px', padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            <span>Progress · answered {done} of {total} + {t3Items.length} auto-confidential (T3)</span>
            <span style={{ fontWeight: 600, color: done === total ? 'var(--success)' : 'var(--accent)' }}>{Math.round(((done + t3Items.length) / (total + t3Items.length)) * 100)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border-primary)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${((done + t3Items.length) / (total + t3Items.length)) * 100}%`, height: '100%', background: done === total ? 'var(--success)' : 'var(--accent)', transition: 'width .2s' }} />
          </div>
        </div>
        <Button size="sm" onClick={() => { setAnswered({}); notify('Wizard reset'); }}>Reset answers</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <WizardQ key={q.id} n={i + 1} it={q} ans={answered[q.id] ?? null} onAns={(v) => onAns(q.id, v)} />
        ))}
      </div>

      <div style={{ marginTop: 20, padding: 16, borderRadius: 'var(--radius-lg)', background: '#ffe4e6', border: '1px solid rgba(225,29,72,.25)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <ShieldCheck size={16} color="var(--danger)" />
          <strong style={{ color: 'var(--danger)' }}>⛔ Confidential (T3) — automatically locked OFF</strong>
        </div>
        <Note icon={false}>
          The following are <strong>never</strong> reachable by design. If the agent is asked, it refuses and transfers. These are not negotiable questions — they are listed so the client can see the full boundary.
        </Note>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          {t3Items.map((it) => (
            <div key={it.id} style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <XCircle size={15} color="var(--danger)" style={{ flex: 'none', marginTop: 1 }} />
              <div style={{ fontSize: 12.5 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{it.label}</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{it.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WizardQ({ n, it, ans, onAns }: { n: number; it: KnowledgeScopeItem; ans: boolean | null; onAns: (v: boolean) => void }) {
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-lg)',
      background: ans === null ? 'var(--bg-primary)' : (ans ? 'var(--success-light)' : 'var(--bg-tertiary)'),
      border: `1px solid ${ans === null ? 'var(--border-primary)' : ans ? 'rgba(5,150,105,.25)' : 'var(--border-primary)'}`,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ flex: 'none', width: 28, height: 28, borderRadius: 999, background: 'var(--bg-tertiary)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <HelpCircle size={14} color="var(--accent)" />
          <span style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>{it.wizardQuestion}</span>
          <Pill tone={TIER_STYLE[it.tier].pillTone}>{TIER_STYLE[it.tier].label}</Pill>
          {it.requiresLocalNode && <Pill tone="flag">📍 client-local node</Pill>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{it.description} · {it.examples[0] ?? ''}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button primary={ans === true} size="sm" onClick={() => onAns(true)}>
            <CheckCircle2 size={13} /> Yes, allow
          </Button>
          <Button primary={ans === false} size="sm" onClick={() => onAns(false)}>
            <XCircle size={13} /> No, keep off
          </Button>
          {ans !== null && (
            <span style={{ alignSelf: 'center', fontSize: 12, color: ans ? 'var(--success)' : 'var(--text-tertiary)', fontWeight: 600 }}>
              {ans ? '✅ On' : '❌ Off'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── VERSION HISTORY (innovation #20, §4 decision #5) ────────────────────
   Every scope change = new version with timestamp + approver.
   If the agent says something wrong, we know exactly which scope version. */

function ScopeVersions() {
  const k = useKnowledgeStore();
  const currentScope = Object.fromEntries(k.scope.map((s) => [s.id, s.enabled]));
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Note>
        <strong>§5 innovation #20:</strong> scope is versioned. Every change is a new version with a timestamp, an approver, and a snapshot of the enabled items. If the agent says something wrong, you replay the call against the exact scope version that was live. <em>The wizard and the matrix always write a new version on Publish.</em>
      </Note>
      {[
        { v: 'UNPUBLISHED · DRAFT', at: 'now', by: 'current editor', cs: currentScope, draft: true },
        ...k.versions.map((v) => ({ v: `v${v.version}`, at: v.at, by: v.by, cs: v.snapshot, note: v.changeSummary })),
      ].map((row, i) => {
        const isDraft = 'draft' in row && !!row.draft;
        return (
          <div key={row.v + i} style={{
            padding: 14, borderRadius: 'var(--radius-lg)',
            background: isDraft ? 'var(--warning-light)' : 'var(--bg-primary)',
            border: `1px solid ${isDraft ? 'rgba(217,119,6,.3)' : 'var(--border-primary)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <strong style={{ color: isDraft ? 'var(--warning)' : 'var(--text-primary)' }}>
                {isDraft ? '🚧 ' : '🗂 '}{row.v}
              </strong>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {row.at} · by {row.by}
              </span>
              {row.v === 'v3' && <Pill tone="ok">● live</Pill>}
              {isDraft && <Pill tone="flag">draft · not yet published</Pill>}
            </div>
            {'note' in row && row.note && !isDraft && (
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {row.note}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
              {Object.entries(row.cs).map(([k2, on]) => {
                const meta = k.scope.find((s) => s.id === k2);
                return (
                  <div key={k2} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    background: on ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                    fontSize: 12,
                  }}>
                    {on ? <CheckCircle2 size={12} color="var(--success)" /> : <XCircle size={12} color="var(--text-tertiary)" />}
                    <span style={{ color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {meta?.label ?? k2}
                    </span>
                    {meta && <Pill tone={TIER_STYLE[meta.tier].pillTone}>{meta.tier}</Pill>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const H2: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', margin: '0 0 8px', fontWeight: 600 };
