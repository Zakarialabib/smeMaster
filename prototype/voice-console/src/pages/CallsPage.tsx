import { useState } from 'react';
import { Phone, MessageCircle, Flag } from 'lucide-react';
import {
  useCallListStore, useFilteredCalls, useUiStore, useLiveCallStore,
} from '../store';
import { CALLS, WHATSAPP_SUMMARIES } from '../data';
import {
  Panel, PanelHead, Pill, Button, DataTable, Note, SectionTitle, AiBanner,
  Tabs, Card,
  type Column, type TabItem,
} from '../components/ui';
import { ProviderBadge } from '../components/ProviderBadge';
import type { CallListItem, CallerEmotion } from '../types';

/* ── Constants ─────────────────────────────────────────────────────────── */

const OUTCOME_TONE = {
  contained: 'ok', transferred: 'tr', voicemail: 'vm', abandoned: 'off',
} as const;

const OUTCOME_LABEL = {
  contained: 'Contained',
  transferred: '→ Transferred',
  voicemail: 'Voicemail → WhatsApp',
  abandoned: 'Abandoned',
} as const;

const EMOTION_TONE: Record<CallerEmotion, 'ok' | 'flag' | 'p1' | 'tr' | 'ai'> = {
  neutral: 'ok', stressed: 'tr', angry: 'p1', confused: 'flag', happy: 'ai',
};
const EMOTION_LABEL: Record<CallerEmotion, string> = {
  neutral: 'Neutral', stressed: 'Stressed', angry: 'Angry', confused: 'Confused', happy: 'Happy',
};

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ── Filter tabs ───────────────────────────────────────────────────────── */

type RangeTab = '7d' | '30d' | 'all';
type OutcomeTab = 'all' | CallListItem['outcome'];

const RANGE_TABS: TabItem<RangeTab>[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All' },
];

const OUTCOME_TABS: TabItem<OutcomeTab>[] = [
  { id: 'all', label: 'All' },
  { id: 'contained', label: 'Contained' },
  { id: 'transferred', label: 'Transferred' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'abandoned', label: 'Abandoned' },
];

/* ══════════════════════════════════════════════════════════════════════════
   CALLS PAGE — list + detail panel
   ══════════════════════════════════════════════════════════════════════════ */

export function CallsPage() {
  const range = useCallListStore((s) => s.range);
  const outcome = useCallListStore((s) => s.outcome);
  const flaggedOnly = useCallListStore((s) => s.flaggedOnly);
  const spamOnly = useCallListStore((s) => s.spamOnly);
  const shadowOnly = useCallListStore((s) => s.shadowOnly);
  const setRange = useCallListStore((s) => s.setRange);
  const setOutcome = useCallListStore((s) => s.setOutcome);
  const toggleFlagged = useCallListStore((s) => s.toggleFlagged);
  const toggleSpam = useCallListStore((s) => s.toggleSpam);
  const toggleShadow = useCallListStore((s) => s.toggleShadow);
  const select = useCallListStore((s) => s.select);
  const selectedId = useCallListStore((s) => s.selectedId);
  const rows = useFilteredCalls();
  const drill = useCallListStore((s) => s.drill);
  const clearDrill = useCallListStore((s) => s.clearDrill);
  const go = useUiStore((s) => s.go);
  const callId = useLiveCallStore((s) => s.callId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const whats = selected ? WHATSAPP_SUMMARIES.find((w) => w.callId === selected.id) : undefined;

  /* ── Columns ──────────────────────────────────────────────────────── */

  const columns: Column<CallListItem>[] = [
    {
      key: 'caller',
      header: 'Caller',
      render: (r) => (
        <span style={{
          display: 'inline-flex', gap: 8, alignItems: 'center',
          color: 'var(--text-primary)', fontWeight: 500,
          fontVariantNumeric: 'tabular-nums', opacity: r.shadowMode ? 0.65 : 1,
        }}>
          {r.id === callId && (
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: 'var(--danger)', display: 'inline-block',
            }} />
          )}
          {r.callerMasked}
          {r.shadowMode && <Pill tone="off" style={{ fontSize: 11 }}>👻 shadow</Pill>}
          {!!r.spamScore && r.spamScore > 0.7 && (
            <Pill tone="p1" style={{ fontSize: 11 }}>🛡 SPAM {Math.round(r.spamScore * 100)}%</Pill>
          )}
        </span>
      ),
    },
    {
      key: 'dur', header: 'Duration', align: 'end',
      render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDur(r.durationSec)}</span>,
    },
    {
      key: 'ch', header: 'Channel',
      render: (r) => (
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5 }}>
          {r.channel === 'voice' ? <Phone size={12} /> : <MessageCircle size={12} />}
          {r.channel === 'voice' ? 'Voice' : 'WhatsApp'}
          {r.scopeVersion && <Pill tone="ai" style={{ fontSize: 11 }}>v{r.scopeVersion}</Pill>}
        </span>
      ),
    },
    {
      key: 'emo', header: 'Mood',
      render: (r) => {
        if (!r.callerEmotion) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        return (
          <Pill tone={EMOTION_TONE[r.callerEmotion]} style={{ fontSize: 11 }}>
            {EMOTION_LABEL[r.callerEmotion]}
          </Pill>
        );
      },
    },
    {
      key: 'out', header: 'Outcome',
      render: (r) => (
        <span style={{ opacity: r.shadowMode ? 0.65 : 1 }}>
          <Pill tone={OUTCOME_TONE[r.outcome]}>
            {r.summarySent && r.outcome !== 'abandoned'
              ? OUTCOME_LABEL[r.outcome] + ' · ✉'
              : OUTCOME_LABEL[r.outcome]}
          </Pill>
        </span>
      ),
    },
    {
      /* NEW: the LLM that handled this call, compact. +N shows other stages. */
      key: 'prov',
      header: 'LLM',
      render: (r) => {
        const mix = r.providerMix;
        if (!mix || mix.stages.length === 0) {
          return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        }
        const llm = mix.stages.find((s) => s.slot === 'voice.llm') ?? mix.stages[0];
        const others = mix.stages.length - 1;
        const fellBack = mix.stages.some((s) => s.fellBack);
        return (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <ProviderBadge provider={llm.used.provider} model={llm.used.model} muted />
            {others > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{others}</span>
            )}
            {fellBack && (
              <span
                title="one or more stages fell back mid-call"
                style={{ fontSize: 11, color: 'var(--warning)' }}
              >⚠</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'flag', header: 'Flag',
      render: (r) => (
        r.flagged
          ? <Pill tone="flag"><Flag size={11} /> {r.flagged}</Pill>
          : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
      ),
    },
    {
      key: 'act', header: '', align: 'end',
      render: (_r) => (
        <button
          className="focus-ring"
          onClick={(e) => { e.stopPropagation(); go('live'); }}
          style={{
            font: 'inherit', border: 0, cursor: 'pointer', background: 'transparent',
            color: 'var(--accent)', fontSize: 12, fontWeight: 500,
            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
          }}
        >
          Why said that? →
        </button>
      ),
    },
    {
      key: 'cost', header: 'Cost', align: 'end',
      render: (r) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.costEur === 0
            ? <span style={{ color: 'var(--text-tertiary)' }}>€0.00 ⓘ</span>
            : `€${(r.costEur ?? 0).toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'when', header: 'When', align: 'end',
      render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.startedAt.slice(11, 16)}</span>,
    },
  ];

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <>
      <Panel>
        <PanelHead
          title="Calls"
          sub={<>{rows.length} shown · 1 row per call, click for detail</>}
          right={
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Tabs<RangeTab>
                ariaLabel="Date range"
                value={range}
                onChange={(r) => setRange(r)}
                tabs={RANGE_TABS}
                size="sm"
              />
              <div style={{ width: 1, height: 18, background: 'var(--border-primary)' }} />
              <Tabs<OutcomeTab>
                ariaLabel="Outcome"
                value={outcome as OutcomeTab}
                onChange={(o) => setOutcome(o)}
                tabs={OUTCOME_TABS}
                size="sm"
              />
            </div>
          }
        />

        {/* Filter row */}
        <div style={{
          display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
          padding: '10px 16px', background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            Filters
          </span>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={flaggedOnly} onChange={toggleFlagged} /> Flagged only
          </label>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={spamOnly} onChange={toggleSpam} /> §5 #16 · Spam
          </label>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
            <input type="checkbox" checked={shadowOnly} onChange={toggleShadow} /> §5 #2 · Shadow
          </label>
        </div>

        {/* Drill-down banner */}
        {drill && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, margin: 16, padding: '10px 14px',
            borderRadius: 'var(--radius-lg)', background: 'var(--accent-subtle)',
            border: '1px solid rgba(11,87,208,.25)',
          }}>
            <strong style={{ fontSize: 13, color: 'var(--accent-hover)' }}>Filtered from an alert:</strong>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{drill.label}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{rows.length} shown</span>
            <Button size="sm" onClick={clearDrill}>Clear</Button>
          </div>
        )}

        {/* AI insight banner */}
        <div style={{ padding: drill ? '0 16px' : '0 16px' }}>
          <AiBanner
            title="3 calls flagged: containment down 40% on pricing questions"
            body="Compared with the previous 30 days. All three end after the agent quotes a price — a knowledge gap, not a latency problem."
            actions={
              <>
                <button
                  className="focus-ring"
                  onClick={() => { setOutcome('contained'); toggleFlagged(); }}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ai)', fontWeight: 600, fontSize: 12 }}
                >
                  Review the 3 calls →
                </button>
                <button
                  className="focus-ring"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12 }}
                >
                  Dismiss
                </button>
              </>
            }
          />
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          selectedId={selectedId}
          onRowClick={(id) => { select(id); setExpandedId(id); }}
          caption="Masked numbers — the full number belongs to the detail panel. Click a row to open it."
        />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          <span>Page 1 of 12 · {CALLS.length} calls fixture</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" disabled>Previous</Button>
            <Button size="sm">Next</Button>
          </span>
        </div>
      </Panel>

      {selected && (
        <CallDetailPanel
          selected={selected}
          whats={whats}
          isLive={selected.id === callId}
          onOpenLive={() => go('live')}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CALL DETAIL PANEL
   ══════════════════════════════════════════════════════════════════════════ */

function CallDetailPanel({
  selected, whats, isLive, onOpenLive,
}: {
  selected: CallListItem;
  whats: (typeof WHATSAPP_SUMMARIES)[number] | undefined;
  isLive: boolean;
  onOpenLive: () => void;
}) {
  return (
    <Panel>
      <PanelHead
        title={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <MessageCircle size={15} color="#25D366" /> Call detail · {selected.id}
            {isLive && <Pill tone="ok">● live</Pill>}
          </span>
        }
        sub={whats
          ? `WhatsApp sent ${whats.sentAt.slice(0, 10)} ${whats.sentAt.slice(11, 16)} · to ${whats.to}`
          : 'No WhatsApp summary sent for this call'}
        right={
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {whats ? <Pill tone="ok">● delivered</Pill> : <Pill tone="off">not configured</Pill>}
            <Pill tone="ai">§5 #3</Pill>
          </span>
        }
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 12, padding: 16, borderBottom: '1px solid var(--border-secondary)',
      }}>
        <div>
          <SectionTitle style={{ marginBottom: 4 }}>Summary</SectionTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {whats ? (
              <>
                <div><strong>Who:</strong> {whats.who}</div>
                <div><strong>What:</strong> {whats.what}</div>
                <div><strong>Next action:</strong> {whats.nextAction}</div>
                {whats.bookingRef && <div>📎 Ref: <strong>{whats.bookingRef}</strong></div>}
              </>
            ) : (
              <div style={{ color: 'var(--text-tertiary)' }}>
                This call did not produce a WhatsApp follow-up. Shadow mode calls and spam do not.
              </div>
            )}
          </div>
        </div>

        {selected.transferBrief && (
          <div>
            <SectionTitle style={{ marginBottom: 4 }}>§5 #4 · Warm-transfer brief (Julie)</SectionTitle>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <div><strong>Who:</strong> {selected.transferBrief.who}</div>
              <div><strong>What:</strong> {selected.transferBrief.what}</div>
              <div><strong>Mood:</strong> {selected.transferBrief.mood}</div>
              <div><strong>Next action:</strong> {selected.transferBrief.nextAction}</div>
              <div>Scope v{selected.transferBrief.scopeVersion}</div>
            </div>
          </div>
        )}

        {isLive && (
          <div>
            <SectionTitle style={{ marginBottom: 4 }}>§5 #20 · Provenance live</SectionTitle>
            <Button size="sm" onClick={onOpenLive}>Open live monitor →</Button>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Click any agent turn for scope provenance, retrieval hits, and guardrails checked.
            </div>
          </div>
        )}
      </div>

      <ProviderMixPanel mix={selected.providerMix} />

      {whats && (
        <div style={{ padding: 16 }}>
          <SectionTitle style={{ marginBottom: 8 }}>WhatsApp message (exact copy)</SectionTitle>
          <div style={{
            padding: 16, borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(180deg,#dcf8c6 0%,#e8f5d9 100%)',
            border: '1px solid #25D36633', color: '#111', fontSize: 13.5,
            lineHeight: 1.55, whiteSpace: 'pre-wrap',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {whats.messageText}
          </div>
          <Note style={{ marginTop: 10 }}>
            WhatsApp voice API does not exist (Meta limitation). The voice agent answers the call; a
            <em> follow-up WhatsApp text</em> is sent after via the official BSP. This is the channel split
            from the brainstorm §0 cascading insight.
          </Note>
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PROVIDER MIX PANEL — the per-call stack
   ══════════════════════════════════════════════════════════════════════════ */

function ProviderMixPanel({ mix }: { mix: CallListItem['providerMix'] }) {
  if (!mix || mix.stages.length === 0) {
    return (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-secondary)' }}>
        <SectionTitle style={{ marginBottom: 4 }}>Provider mix</SectionTitle>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          No per-stage attribution recorded for this call. Live calls populate this as they run.
        </div>
      </div>
    );
  }

  const maxMs = Math.max(...mix.stages.map((s) => s.ms), 1);

  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <SectionTitle style={{ margin: 0 }}>Provider mix — this call</SectionTitle>
        <span style={{ flex: 1 }} />
        <Pill tone="ai">total €{mix.totalCostEur.toFixed(3)}</Pill>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mix.stages.map((s) => (
          <div key={s.slot} style={{
            display: 'grid',
            gridTemplateColumns: '150px 1fr 90px 90px',
            gap: 10, alignItems: 'center',
            padding: '6px 8px', borderRadius: 'var(--radius-sm)',
            background: s.fellBack ? 'var(--warning-light)' : 'var(--bg-primary)',
            border: `1px solid ${s.fellBack ? 'rgba(217,119,6,.3)' : 'var(--border-primary)'}`,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.slot.replace('voice.', '').toUpperCase()}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <ProviderBadge provider={s.used.provider} model={s.used.model} />
              {s.fellBack && (
                <Pill tone="flag" style={{ fontSize: 10 }} title={`fallback: ${s.fallbackReason ?? 'unknown'}`}>
                  ⚠ {s.fallbackReason ?? 'error'}
                </Pill>
              )}
            </div>
            <div>
              <div style={{ height: 5, background: 'var(--border-primary)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(s.ms / maxMs) * 100}%`,
                  background: s.fellBack ? 'var(--warning)' : 'var(--accent)',
                }} />
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', textAlign: 'end' }}>
              {s.ms}ms · €{s.costEur.toFixed(3)}
            </span>
          </div>
        ))}
      </div>

      <Note style={{ marginTop: 10, marginBottom: 0 }}>
        Per-stage attribution, not an aggregate. If the STT stage fell back mid-call, that row is tinted
        and shows the reason — a silent provider swap is invisible in aggregate cost, so it is shown here.
      </Note>
    </div>
  );
} 