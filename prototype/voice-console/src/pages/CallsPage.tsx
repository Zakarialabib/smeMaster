import { Phone, MessageCircle, Flag } from 'lucide-react';
import { useCallListStore, useFilteredCalls, useUiStore, useLiveCallStore, useReachable } from '../store';
import { Panel, PanelHead, Pill, Button, DegradedBanner, DataTable, type Column } from '../components/ui';
import type { CallListItem } from '../types';

const OUTCOME_TONE = {
  contained: 'ok', transferred: 'tr', voicemail: 'vm', abandoned: 'off',
} as const;
const OUTCOME_LABEL = {
  contained: 'Contained', transferred: '→ Transferred', voicemail: 'Voicemail → WhatsApp', abandoned: 'Abandoned',
} as const;

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function CallsPage() {
  const range = useCallListStore((s) => s.range);
  const outcome = useCallListStore((s) => s.outcome);
  const flaggedOnly = useCallListStore((s) => s.flaggedOnly);
  const setRange = useCallListStore((s) => s.setRange);
  const setOutcome = useCallListStore((s) => s.setOutcome);
  const toggleFlagged = useCallListStore((s) => s.toggleFlagged);
  const select = useCallListStore((s) => s.select);
  const selectedId = useCallListStore((s) => s.selectedId);
  const rows = useFilteredCalls();
  const go = useUiStore((s) => s.go);
  const callId = useLiveCallStore((s) => s.callId);

  const columns: Column<CallListItem>[] = [
    {
      key: 'caller', header: 'Caller', render: (r) => (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: 'var(--text-primary)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {r.id === callId && <span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--danger)', display: 'inline-block' }} />}
          {r.callerMasked}
        </span>
      ),
    },
    { key: 'dur', header: 'Duration', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDur(r.durationSec)}</span> },
    {
      key: 'ch', header: 'Channel', render: (r) => (
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 12.5 }}>
          {r.channel === 'voice' ? <Phone size={12} /> : <MessageCircle size={12} />}
          {r.channel === 'voice' ? 'Voice' : 'WhatsApp'}
        </span>
      ),
    },
    { key: 'out', header: 'Outcome', render: (r) => <Pill tone={OUTCOME_TONE[r.outcome]}>{OUTCOME_LABEL[r.outcome]}</Pill> },
    { key: 'flag', header: 'Flag', render: (r) => r.flagged ? <Pill tone="flag"><Flag size={11} /> {r.flagged}</Pill> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
    { key: 'cost', header: 'Cost', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.costEur === 0 ? <span style={{ color: 'var(--text-tertiary)' }}>€0.00 ⓘ</span> : `€${(r.costEur ?? 0).toFixed(2)}`}</span> },
    { key: 'when', header: 'When', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.startedAt.slice(11, 16)}</span> },
  ];

  return (
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
              <input type="checkbox" checked={flaggedOnly} onChange={toggleFlagged} /> Flagged only
            </label>
          </span>
        }
      />

      <div style={{ padding: '0 16px' }}>
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
        onRowClick={(id) => { select(id); go(id === 'c_01' ? 'live' : 'ops'); }}
        caption="Masked numbers on purpose — the full number belongs to the call detail." />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>
        <span>Page 1 of 12 · 128 calls</span>
        <span style={{ display: 'flex', gap: 8 }}><Button size="sm" disabled>Previous</Button><Button size="sm">Next</Button></span>
      </div>
    </Panel>
  );
}

/* ── Live monitor ─────────────────────────────────────────────────────────── */

const STATE_LABEL: Record<string, { l: string; tone: 'ok' | 'tr' | 'p1' | 'off' }> = {
  connecting: { l: 'CONNECTING', tone: 'tr' }, greeting: { l: 'GREETING', tone: 'tr' },
  listening: { l: 'LISTENING', tone: 'ok' }, thinking: { l: 'THINKING', tone: 'tr' },
  speaking: { l: 'SPEAKING', tone: 'tr' }, closing: { l: 'CLOSING', tone: 'off' },
  wrapup: { l: 'WRAP-UP', tone: 'off' }, idle: { l: 'IDLE', tone: 'off' },
};

export function LivePage() {
  const wsStatus = useLiveCallStore((s) => s.wsStatus);
  const elapsed = useLiveCallStore((s) => s.elapsedSec);
  const setWs = useLiveCallStore((s) => s.setWs);
  const reachable = useReachable();
  const state = 'speaking' as const;
  const sl = STATE_LABEL[state];
  const turns = [
    { idx: 0, role: 'agent' as const, text: 'Cet appel est pris en charge par un assistant IA. Dites « agent » à tout moment pour être transféré à un humain.', g: 1402 },
    { idx: 1, role: 'caller' as const, text: 'Bonjour, je voudrais prendre un rendez-vous pour un contrôle technique.', g: null },
    { idx: 2, role: 'agent' as const, text: 'Bien sûr. Je vous propose jeudi à 14 h 30. Vous préférez le matin ?', g: 1562 },
    { idx: 3, role: 'caller' as const, text: 'Non non, plutôt le matin si possible.', g: null },
    { idx: 4, role: 'agent' as const, text: 'Parfait, je vous note vendredi matin à 9 h. Je vous envoie une confirmation ?', g: 1524 },
  ];

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

      <Panel>
        <PanelHead
          title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <Pill tone={sl.tone}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', display: 'inline-block' }} />{sl.l}</Pill>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱ {fmtDur(elapsed)}</span>
            <Pill tone="off">Voice</Pill>
          </span>}
          sub={<>+33 6 •• •• 41 22</>}
          right={<Pill tone={wsStatus === 'connected' ? 'ok' : 'flag'}>ws: {wsStatus}</Pill>}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 0 }}>
          <div aria-live="polite" aria-atomic="false" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, opacity: wsStatus === 'connected' ? 1 : 0.6 }}>
            {turns.map((t) => (
              <div key={t.idx} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: t.role === 'agent' ? 'flex-end' : 'flex-start' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {t.role === 'agent' ? 'Agent' : 'Caller'}
                </span>
                <div style={{
                  maxWidth: '78%', padding: '8px 12px', borderRadius: 'var(--radius)',
                  background: t.role === 'agent' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: 13.5,
                  border: `1px solid ${t.role === 'agent' ? 'rgba(11,87,208,.2)' : 'var(--border-primary)'}`,
                }}>
                  {t.text}
                  {t.idx === 4 && <span style={{ color: 'var(--text-tertiary)' }}> ▍</span>}
                </div>
                {t.g && <span style={{ fontSize: 11, color: 'var(--success)' }}>turn_gap {t.g}ms ✔</span>}
              </div>
            ))}
          </div>

          <aside style={{ borderInlineStart: '1px solid var(--border-primary)', padding: 16, background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8 }}>
              Stage marks — current turn
            </div>
            {[['VAD', 181], ['STT final', 338], ['LLM first token', 251], ['TTS first byte', 142]].map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{v}ms</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-secondary)', fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>turn_gap</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--success)', fontWeight: 600 }}>1.52s ✔</span>
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
