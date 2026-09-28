import { useState } from 'react';
import { Phone, MessageCircle, Flag, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, Frown, Meh, Smile, Zap, Volume2, CircleUserRound } from 'lucide-react';
import { useCallListStore, useFilteredCalls, useUiStore, useLiveCallStore, useReachable } from '../store';
import { CALLS, LIVE_TURNS, WHATSAPP_SUMMARIES, CALLS as CALLS_FIXTURE } from '../data';
import { Panel, PanelHead, Pill, Button, DegradedBanner, DataTable, type Column, Note, SectionTitle } from '../components/ui';
import type { CallListItem, CallerEmotion, Turn, DegradedMode } from '../types';

const OUTCOME_TONE = {
  contained: 'ok', transferred: 'tr', voicemail: 'vm', abandoned: 'off',
} as const;
const OUTCOME_LABEL = {
  contained: 'Contained', transferred: '→ Transferred', voicemail: 'Voicemail → WhatsApp', abandoned: 'Abandoned',
} as const;

const EMOTION_ICON: Record<CallerEmotion, typeof Meh> = {
  neutral: Meh, stressed: Frown, angry: AlertTriangle, confused: Meh, happy: Smile,
};
const EMOTION_TONE: Record<CallerEmotion, 'ok' | 'flag' | 'p1' | 'tr' | 'ai'> = {
  neutral: 'ok', stressed: 'tr', angry: 'p1', confused: 'flag', happy: 'ai',
};
const EMOTION_LABEL: Record<CallerEmotion, string> = {
  neutral: 'Neutral', stressed: 'Stressed', angry: 'Angry', confused: 'Confused', happy: 'Happy',
};

const DEGRADED_MODES: { v: DegradedMode; l: string; i: typeof Zap; d: string }[] = [
  { v: 'normal', l: 'Normal', i: Volume2, d: 'LLM · STT · TTS — all up' },
  { v: 'dtmf_only', l: 'DTMF only', i: Phone, d: 'LLM/STT down → press 1 for booking, 2 for transfer' },
  { v: 'alt_voice', l: 'Alt voice', i: CircleUserRound, d: 'TTS provider down → fallback voice (lower quality)' },
  { v: 'repeating', l: 'Repeating', i: AlertTriangle, d: 'STT down → agent repeats "please hold" + transfer' },
];

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   CALLS PAGE — extended with §5 #3 WhatsApp, #2 shadow, #16 spam, #20 provenance
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

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const whats = selected ? WHATSAPP_SUMMARIES.find((w) => w.callId === selected.id) : undefined;

  const columns: Column<CallListItem>[] = [
    {
      key: 'caller', header: 'Caller', render: (r) => (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', opacity: r.shadowMode ? 0.65 : 1 }}>
          {r.id === callId && <span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--danger)', display: 'inline-block' }} />}
          {r.callerMasked}
          {r.shadowMode && <Pill tone="off" style={{ fontSize: 11 }}>👻 shadow</Pill>}
          {!!r.spamScore && r.spamScore > 0.7 && <Pill tone="p1" style={{ fontSize: 11 }}>🛡 SPAM {Math.round(r.spamScore * 100)}%</Pill>}
        </span>
      ),
    },
    { key: 'dur', header: 'Duration', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDur(r.durationSec)}</span> },
    {
      key: 'ch', header: 'Channel', render: (r) => (
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5 }}>
          {r.channel === 'voice' ? <Phone size={12} /> : <MessageCircle size={12} />}
          {r.channel === 'voice' ? 'Voice' : 'WhatsApp'}
          {r.scopeVersion && <Pill tone="ai" style={{ fontSize: 11 }}>v{r.scopeVersion}</Pill>}
        </span>
      ),
    },
    {
      key: 'emo', header: 'Mood', render: (r) => {
        if (!r.callerEmotion) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        const E = EMOTION_ICON[r.callerEmotion];
        return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Pill tone={EMOTION_TONE[r.callerEmotion]} style={{ fontSize: 11 }}><E size={11} /> {EMOTION_LABEL[r.callerEmotion]}</Pill></span>;
      },
    },
    { key: 'out', header: 'Outcome', render: (r) => <span style={{ opacity: r.shadowMode ? 0.65 : 1 }}><Pill tone={OUTCOME_TONE[r.outcome]}>{r.summarySent && r.outcome !== 'abandoned' ? OUTCOME_LABEL[r.outcome] + ' · ✉' : OUTCOME_LABEL[r.outcome]}</Pill></span> },
    {
      key: 'flag', header: 'Flag', render: (r) => (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {r.flagged ? <Pill tone="flag"><Flag size={11} /> {r.flagged}</Pill> : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
        </span>
      ),
    },
    {
      key: 'act', header: '', align: 'end', render: (_r) => (
        <button className="focus-ring" onClick={(e) => { e.stopPropagation(); go('live'); }}
          style={{ font: 'inherit', border: 0, cursor: 'pointer', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 500, padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
          Why said that? →
        </button>
      ),
    },
    { key: 'cost', header: 'Cost', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.costEur === 0 ? <span style={{ color: 'var(--text-tertiary)' }}>€0.00 ⓘ</span> : `€${(r.costEur ?? 0).toFixed(2)}`}</span> },
    { key: 'when', header: 'When', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.startedAt.slice(11, 16)}</span> },
  ];

  return (
    <>
      <Panel>
        <PanelHead
          title="Calls"
          right={
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select aria-label="Range" value={range} onChange={(e) => setRange(e.target.value as never)}
                className="focus-ring"
                style={{ font: 'inherit', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)', padding: '6px 10px' }}>
                <option value="7d">7 days</option><option value="30d">30 days</option><option value="all">All</option>
              </select>
              <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as never)}
                className="focus-ring"
                style={{ font: 'inherit', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)', padding: '6px 10px' }}>
                <option value="all">All outcomes</option><option value="contained">Contained</option>
                <option value="transferred">Transferred</option><option value="voicemail">Voicemail</option><option value="abandoned">Abandoned</option>
              </select>
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
                <input type="checkbox" checked={flaggedOnly} onChange={toggleFlagged} /> Flagged
              </label>
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
                <input type="checkbox" checked={spamOnly} onChange={toggleSpam} /> §5 #16 · Spam only
              </label>
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
                <input type="checkbox" checked={shadowOnly} onChange={toggleShadow} /> §5 #2 · Shadow only
              </label>
            </span>
          }
        />

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

        <div style={{ padding: drill ? '0 16px' : undefined }}>
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start', margin: '12px 0', padding: 12,
            borderRadius: 'var(--radius-lg)', background: 'var(--ai-subtle)', border: '1px solid rgba(147,51,234,.28)',
          }}>
            <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, background: 'var(--ai)', color: '#fff', display: 'grid', placeItems: 'center' }}>⟡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', color: 'var(--ai)', marginBottom: 2 }}>3 calls flagged: containment down 40% on pricing questions</strong>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                Compared with the previous 30 days. All three end after the agent quotes a price — a
                knowledge gap, not a latency problem.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <button className="focus-ring" onClick={() => { setOutcome('contained'); toggleFlagged(); }}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--ai)', fontWeight: 600, fontSize: 12 }}>Review the 3 calls →</button>
                <button className="focus-ring" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12 }}>Dismiss</button>
              </div>
            </div>
          </div>
        </div>

        <DataTable rows={rows} columns={columns} selectedId={selectedId}
          onRowClick={(id) => { select(id); }}
          caption="Masked numbers on purpose — the full number belongs to the call detail. Click any row for the WhatsApp side panel." />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
          <span>Page 1 of 12 · {CALLS_FIXTURE.length} calls fixture</span>
          <span style={{ display: 'flex', gap: 8 }}><Button size="sm" disabled>Previous</Button><Button size="sm">Next</Button></span>
        </div>
      </Panel>

      {/* ─── §5 #3 WhatsApp summary side panel ─────────────────────────── */}
      {selected && (
        <Panel>
          <PanelHead
            title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <MessageCircle size={15} color="#25D366" /> WhatsApp follow-up · {selected.id}
            </span>}
            sub={whats ? `sent ${whats.sentAt.slice(0, 10)} ${whats.sentAt.slice(11, 16)} · to ${whats.to}` : 'No WhatsApp summary sent for this call'}
            right={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {whats ? <Pill tone="ok">● delivered</Pill> : <Pill tone="off">not configured</Pill>}
              <Pill tone="ai">§5 #3</Pill>
            </span>}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
            <div>
              <SectionTitle style={{ marginBottom: 4 }}>Summary</SectionTitle>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                {whats ? (<>
                  <div><strong>Who:</strong> {whats.who}</div>
                  <div><strong>What:</strong> {whats.what}</div>
                  <div><strong>Next action:</strong> {whats.nextAction}</div>
                  {whats.bookingRef && <div>📎 Ref: <strong>{whats.bookingRef}</strong></div>}
                </>) : <div style={{ color: 'var(--text-tertiary)' }}>This call did not produce a WhatsApp follow-up. Shadow mode calls and spam do not.</div>}
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
            {selected.id === callId && (
              <div>
                <SectionTitle style={{ marginBottom: 4 }}>§5 #20 · Provenance live</SectionTitle>
                <Button size="sm" onClick={() => go('live')}>Open live monitor →</Button>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>Click any agent turn for scope provenance, retrieval hits, and guardrails checked.</div>
              </div>
            )}
          </div>
          {whats && (
            <div style={{ padding: 16 }}>
              <SectionTitle style={{ marginBottom: 8 }}>WhatsApp message (exact copy)</SectionTitle>
              <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(180deg,#dcf8c6 0%,#e8f5d9 100%)', border: '1px solid #25D36633', color: '#111', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {whats.messageText}
              </div>
              <Note style={{ marginTop: 10 }}>
                WhatsApp voice API does not exist (Meta limitation). The voice agent answers the call; a <em>follow-up WhatsApp
                text</em> is sent after via the official BSP. This is the channel split from the brainstorm §0 cascading insight.
              </Note>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LIVE MONITOR — §5 #4 Julie brief, #11 emotion, #13 degraded, #20 provenance
   ══════════════════════════════════════════════════════════════════════════ */

const STATE_LABEL: Record<string, { l: string; tone: 'ok' | 'tr' | 'p1' | 'off' }> = {
  connecting: { l: 'CONNECTING', tone: 'tr' }, greeting: { l: 'GREETING', tone: 'tr' },
  listening: { l: 'LISTENING', tone: 'ok' }, thinking: { l: 'THINKING', tone: 'tr' },
  speaking: { l: 'SPEAKING', tone: 'tr' }, closing: { l: 'CLOSING', tone: 'off' },
  wrapup: { l: 'WRAP-UP', tone: 'off' }, idle: { l: 'IDLE', tone: 'off' },
};

export function LivePage() {
  const wsStatus = useLiveCallStore((s) => s.wsStatus);
  const elapsed = useLiveCallStore((s) => s.elapsedSec);
  const degradedMode = useLiveCallStore((s) => s.degradedMode);
  const setDegraded = useLiveCallStore((s) => s.setDegraded);
  const setWs = useLiveCallStore((s) => s.setWs);
  const reachable = useReachable();
  const state = 'speaking' as const;
  const sl = STATE_LABEL[state];
  const turns: Turn[] = LIVE_TURNS;
  const [expanded, setExpanded] = useState<number | null>(null);
  const liveCall = CALLS.find((c) => c.state !== 'wrapup') ?? CALLS[0];

  return (
    <>
      {wsStatus !== 'connected' && (
        <DegradedBanner
          tone="warning"
          title={
            wsStatus === 'stale' ? 'Connection lost 14:51 — showing data from 14:32'
            : wsStatus === 'reconnecting' ? 'Reconnecting (3/5)'
            : wsStatus === 'offline' ? 'We cannot reach the agent — last seen 14:51'
            : 'Connecting…'
          }
          body="The transcript below is dimmed because it is no longer live. It is real data, just old — a frozen transcript with no marker would look like a caller who stopped talking."
          action={<Button size="sm" onClick={() => setWs('connected', 0)}>Simulate reconnect</Button>}
        />
      )}

      {/* §5 #13 Graceful degradation state banner */}
      {degradedMode !== 'normal' && (
        <DegradedBanner
          tone="danger"
          title={`Graceful degradation · ${degradedMode}`}
          body="A provider seam has failed. The agent is NOT dead — it fell back per §5 #13. Callers never hear a dead line. Toggle the mode in the right sidebar to test each path."
        />
      )}

      <Panel>
        <PanelHead
          title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <Pill tone={sl.tone}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', display: 'inline-block' }} />{sl.l}</Pill>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱ {fmtDur(elapsed)}</span>
            <Pill tone="ok"><ShieldCheck size={11} /> DISCLOSURE_FIRED · sentence 0</Pill>
            <Pill tone="ai">scope v{liveCall.scopeVersion ?? 3}</Pill>
            <Pill tone="off">Voice</Pill>
          </span>}
          sub={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            +33 6 •• •• 41 22
            {liveCall.callerEmotion && <span>· mood:&nbsp;<Pill tone={EMOTION_TONE[liveCall.callerEmotion]} style={{ fontSize: 11 }}>
              {(() => { const E = EMOTION_ICON[liveCall.callerEmotion]; return <><E size={11} /> {EMOTION_LABEL[liveCall.callerEmotion]}</>; })()}
            </Pill></span>}
          </span>}
          right={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Pill tone={wsStatus === 'connected' ? 'ok' : 'flag'}>ws: {wsStatus}</Pill><Pill tone="ai">§5 #20 provenance</Pill></span>}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0 }}>
          <div aria-live="polite" aria-atomic="false" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, opacity: wsStatus === 'connected' ? 1 : 0.6 }}>
            {turns.map((t) => {
              const isAgent = t.role === 'agent';
              const emo = t.emotionTag;
              const open = expanded === t.idx;
              return (
                <div key={t.idx} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: isAgent ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {isAgent ? 'Agent' : 'Caller'} turn {t.idx}
                    </span>
                    {emo && <Pill tone={EMOTION_TONE[emo]} style={{ fontSize: 10.5 }}>{(() => { const E = EMOTION_ICON[emo]; return <><E size={10.5} /> {EMOTION_LABEL[emo]}</>; })()}</Pill>}
                    {t.guardrailFired && <Pill tone="p1" style={{ fontSize: 10.5 }}>🔥 {t.guardrailFired}</Pill>}
                  </div>
                  <div style={{
                    maxWidth: '80%', padding: '8px 12px', borderRadius: 'var(--radius)',
                    background: isAgent ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                    color: 'var(--text-primary)', fontSize: 13.5,
                    border: `1px solid ${isAgent ? 'rgba(11,87,208,.2)' : 'var(--border-primary)'}`,
                  }}>
                    {t.text}
                    {t.idx === 4 && <span style={{ color: 'var(--text-tertiary)' }}> ▍</span>}
                  </div>
                  {t.provenance && (
                    <button className="focus-ring" onClick={() => setExpanded(open ? null : t.idx)}
                      style={{
                        font: 'inherit', fontSize: 11.5, cursor: 'pointer', padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)',
                        background: 'var(--bg-secondary)', color: 'var(--ai)', fontWeight: 500,
                        display: 'inline-flex', gap: 4, alignItems: 'center',
                      }}>
                      {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      §5 #20 · Why did the agent say that?
                    </button>
                  )}
                  {t.provenance && open && (
                    <div style={{ alignSelf: 'stretch', marginTop: 4, padding: 12, borderRadius: 'var(--radius)', background: 'var(--ai-subtle)', border: '1px solid rgba(147,51,234,.25)', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Pill tone="ai">scope v{t.provenance.scopeVersion}</Pill>
                        {t.provenance.guardrailsChecked.length > 0 && <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                          {t.provenance.guardrailsChecked.map((g) => <Pill key={g} tone="ok" style={{ fontSize: 10.5 }}>checked · {g.replace(/_/g, ' ').toLowerCase()}</Pill>)}
                        </div>}
                      </div>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>Prompt snippet (LLM)</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, background: 'var(--bg-primary)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{t.provenance.promptSnippet}</div>
                      {t.provenance.chunks.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600 }}>Retrieval hits · {t.provenance.chunks.length} chunks</div>
                          {t.provenance.chunks.map((c) => (
                            <div key={c.id} style={{ padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: 4, display: 'flex', gap: 8 }}>
                              <Pill tone={c.tier === 'T0' ? 'ok' : c.tier === 'T1' ? 'ai' : c.tier === 'T2' ? 'flag' : 'p1'} style={{ fontSize: 10.5, flex: 'none' }}>{c.tier} · {(c.score * 100).toFixed(0)}%</Pill>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>« {c.snippet} »</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  {t.stages && (
                    <span style={{ fontSize: 11, color: t.stages.turnGapMs && t.stages.turnGapMs < 2000 ? 'var(--success)' : 'var(--warning)' }}>
                      turn_gap {t.stages.turnGapMs ?? '—'}ms {t.stages.turnGapMs && t.stages.turnGapMs < 2000 ? '✔' : '⚠'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <aside style={{ borderInlineStart: '1px solid var(--border-primary)', padding: 16, background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>
              Stage marks — current turn
            </div>
            {[
              ['VAD', turns[4]?.stages?.vadMs ?? 181],
              ['STT final', turns[4]?.stages?.sttMs ?? 338],
              ['LLM first token', turns[4]?.stages?.llmMs ?? 251],
              ['TTS first byte', turns[4]?.stages?.ttsMs ?? 142],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{v}ms</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-secondary)', fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>turn_gap</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--success)', fontWeight: 600 }}>{turns[4]?.stages?.turnGapMs ?? 1524}ms ✔</span>
            </div>

            {/* §5 #11 emotion ladder indicator */}
            <div style={{ marginTop: 14, padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>§5 #11 · Emotion ladder</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 6 }}>
                {(['happy', 'neutral', 'confused', 'stressed', 'angry'] as CallerEmotion[]).map((e, _i) => {
                  const active = liveCall.callerEmotion === e;
                  const Icon = EMOTION_ICON[e];
                  return (
                    <div key={e} title={EMOTION_LABEL[e]} style={{
                      height: 20, borderRadius: 3,
                      background: active ? (e === 'angry' ? 'var(--danger)' : e === 'stressed' ? 'var(--warning)' : e === 'happy' ? 'var(--ai)' : 'var(--accent)') : 'var(--border-primary)',
                      display: 'grid', placeItems: 'center', color: active ? '#fff' : 'transparent',
                    }}>
                      <Icon size={11} />
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                2 angry turns = skip the ladder. Current: <strong>{EMOTION_LABEL[liveCall.callerEmotion ?? 'neutral']}</strong>
              </div>
            </div>

            {/* §5 #4 Warm-transfer brief */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>§5 #4 · Warm-transfer brief</div>
              {liveCall.transferBrief ? (
                <div style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--success-light)', border: '1px solid rgba(5,150,105,.2)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>📞 {liveCall.transferBrief.who}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>💬 {liveCall.transferBrief.what}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>🎯 Next: {liveCall.transferBrief.nextAction}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {liveCall.transferBrief.alreadySaid.map((s, i) => <span key={i} style={{ padding: '1px 6px', background: 'var(--bg-primary)', borderRadius: 999 }}>«{s.slice(0, 24)}»</span>)}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  No transfer requested yet. When the agent escalates, P4 Julie rings with this filled in before the call reaches her.
                </div>
              )}
            </div>

            {/* §5 #13 Graceful degradation selector */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>§5 #13 · Degradation mode</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                {DEGRADED_MODES.map(({ v, l, i: I, d }) => {
                  const on = degradedMode === v;
                  return (
                    <button key={v} onClick={() => setDegraded(v)} className="focus-ring"
                      title={d}
                      style={{
                        font: 'inherit', fontSize: 11.5, cursor: 'pointer', padding: '6px 8px',
                        border: `1px solid ${on ? (v === 'normal' ? 'var(--success)' : 'var(--danger)') : 'var(--border-primary)'}`,
                        background: on ? (v === 'normal' ? 'var(--success-light)' : '#ffe4e6') : 'var(--bg-primary)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                        display: 'flex', gap: 4, alignItems: 'center',
                      }}>
                      <I size={12} color={on ? (v === 'normal' ? 'var(--success)' : 'var(--danger)') : 'var(--text-tertiary)'} />
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 12, padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Read-only in v1.</strong> Watching a live call is fine; acting mid-call is not a
              capability, and a control that appears to allow it is a support ticket.
            </div>
            <div style={{ marginTop: 10 }}>
              <Button size="sm" onClick={() => setWs(wsStatus === 'connected' ? 'stale' : 'connected', 3)}>
                {wsStatus === 'connected' ? 'Break the socket' : 'Reconnect'}
              </Button>
            </div>
          </aside>
        </div>
      </Panel>

      {!reachable && (
        <DegradedBanner
          title="Calls are not being answered right now"
          body="The agent is unreachable, so inbound calls are going to the carrier's failover rather than to voicemail. This is a P1."
        />
      )}
    </>
  );
}
