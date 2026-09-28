import { useState } from 'react';
import { ChevronDown, ArrowRight, ExternalLink, ShieldCheck, TrendingUp } from 'lucide-react';
import {
  useOpsStore, useReachable, useUiStore, useCallListStore,
} from '../store';
import {
  Panel, PanelHead, Pill, Button, DegradedBanner, ProvisionalTag, AckBadge, Note, SectionTitle,
  DataTable, type Column,
} from '../components/ui';
import type { OpsAlert, PilotScorecard, ConsentReceipt } from '../types';
import { CONSENT_RECEIPTS, PILOT_SCORECARD } from '../data';

function fmtSince(iso: string) {
  return iso.slice(11, 16);
}

function AlertRow({ a, grouped }: { a: OpsAlert; grouped?: boolean }) {
  const openAlert = useUiStore((s) => s.openAlert);
  const ack = useOpsStore((s) => s.acknowledge);
  const tone = a.severity === 'P1' ? 'p1' : a.severity === 'P2' ? 'flag' : 'off';
  return (
    <div
      role="button" tabIndex={0} className="focus-ring"
      onClick={() => openAlert(a.id)} onKeyDown={(e) => { if (e.key === 'Enter') openAlert(a.id); }}
      style={{
        display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer',
        padding: '12px 16px', borderBottom: '1px solid var(--border-secondary)',
        borderInlineStart: a.severity === 'P1' ? '3px solid var(--danger)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone={tone}>{a.severity}</Pill>
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.oneLiner}</span>
        <span style={{ flex: 1 }} />
        <AckBadge at={a.acknowledgedAt} by={a.acknowledgedBy} />
        {grouped && <Pill tone="off">× {a.evidence.count}</Pill>}
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtSince(a.evidence.lastAt)}</span>
        <ArrowRight size={14} color="var(--text-tertiary)" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInlineStart: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <strong>Do:</strong> {a.decision}
        </span>
        <span style={{ flex: 1 }} />
        {!a.acknowledgedAt && (
          <Button size="sm" onClick={() => ack(a.id)}>Acknowledge (x)</Button>
        )}
      </div>
    </div>
  );
}

export function OpsPage() {
  const reachable = useReachable();
  const lastSeen = useOpsStore((s) => s.lastSeenAt);
  const callCount = useOpsStore((s) => s.callCount);
  const containedPct = useOpsStore((s) => s.containedPct);
  const p1 = useOpsStore((s) => s.p1);
  const p2Grouped = useOpsStore((s) => s.p2Grouped);
  const p3Count = useOpsStore((s) => s.p3Count);
  const go = useUiStore((s) => s.go);
  const [showP3, setShowP3] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);

  return (
    <>
      {!reachable && (
        <DegradedBanner
          title={`We cannot reach the agent — last seen ${lastSeen?.slice(11, 16) ?? '—'}`}
          body="The digest below is stale data, not today's calls. Do not read the absence of P1 alerts as an absence of problems. This is a P1: inbound calls are currently going unanswered."
          action={<Button primary onClick={() => go('topology')}>Open topology</Button>}
        />
      )}

      <Panel>
        <PanelHead
          title="Ops digest"
          sub={<>since 08:00 · {callCount} calls · <strong>{containedPct}% contained</strong></>}
          right={
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Button size="sm" onClick={() => setShowThresholds((v) => !v)}>
                {showThresholds ? 'Hide' : 'Show'} threshold provenance
              </Button>
            </span>
          }
        />

        {showThresholds && (
          <div style={{ padding: '0 16px' }}>
            <Note>
              Every threshold below is a <strong>placeholder pending pilot data</strong>. They are
              shown so you can see the provenance, not so you treat a guess as a measurement
              (<code>WIREFRAMES.md</code> G3).
            </Note>
          </div>
        )}

        <div>
          <SectionLabel>Needs you now — P1</SectionLabel>
          {p1.filter((a) => !a.acknowledgedAt).map((a) => <AlertRow key={a.id} a={a} />)}
          {p1.every((a) => a.acknowledgedAt) && (
            <div style={{ padding: '16px', fontSize: 13, color: 'var(--text-tertiary)' }}>
              No unacknowledged P1. <span style={{ color: 'var(--success)' }}>✔ quiet</span>
            </div>
          )}
        </div>

        <div>
          <SectionLabel>Grouped by rule, not by time</SectionLabel>
          {Object.entries(p2Grouped).map(([group, list]) => (
            <div key={group}>
              {list.map((a) => <AlertRow key={a.id} a={a} grouped />)}
            </div>
          ))}
        </div>

        <div>
          <button
            onClick={() => setShowP3((v) => !v)} aria-expanded={showP3} className="focus-ring"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'start',
              padding: '12px 16px', background: 'none', border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13,
            }}
          >
            <ChevronDown size={14} style={{ transform: showP3 ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            {p3Count} more (P3) — surfaces in the morning, literally
          </button>
          {showP3 && (
            <div style={{ padding: '0 16px 12px 40px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              09:15 WhatsApp text · contained &nbsp;·&nbsp; 08:40 WhatsApp text · contained
            </div>
          )}
        </div>
      </Panel>

      <PilotScorecardPanel />

      <ProviderHealthPanel />

      <ConsentReceiptAudit />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 16px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-primary)',
    }}>{children}</div>
  );
}

function PilotScorecardPanel() {
  const sc: PilotScorecard = PILOT_SCORECARD();
  const goNoGoTone = sc.goNoGo === 'GO' ? 'ok' : sc.goNoGo === 'NO-GO' ? 'p1' : 'flag';
  const goNoGoLabel = sc.goNoGo === 'GO' ? '✔ GO' : sc.goNoGo === 'NO-GO' ? '✘ NO-GO' : '👁 WATCH';

  return (
    <Panel>
      <PanelHead
        title={
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
            <TrendingUp size={16} color="var(--accent)" />
            Pilot scorecard — Week {sc.week}
          </span>
        }
        sub="§5 #8 · go / no-go gate before week 3 rollout"
        right={<Pill tone={goNoGoTone}>{goNoGoLabel}</Pill>}
      />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          borderInlineStart: '3px solid var(--accent)',
          paddingInlineStart: 14,
          fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          {sc.narrative}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {sc.bars.map((b) => {
            const pct = Math.min(100, Math.round((b.value / b.target) * 100));
            const passes = b.ownedByPersona === 'P1' && b.label.includes('no-show')
              ? b.value <= b.target
              : b.value >= b.target;
            return (
              <div key={b.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <Pill tone="off" style={{ fontSize: 10, padding: '1px 6px' }}>{b.ownedByPersona}</Pill>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{b.label}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: passes ? 'var(--success)' : 'var(--warning)' }}>{b.value}</strong>
                    <span style={{ color: 'var(--text-tertiary)' }}> / {b.target}</span>
                  </span>
                  {b.provisional && <ProvisionalTag />}
                </div>
                <div style={{
                  height: 6, background: 'var(--bg-secondary)', borderRadius: 999, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: passes ? 'hsl(var(--success))' : 'hsl(var(--warning))',
                    transition: 'width .3s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        <Note>
          Bars owned by <strong>P1</strong> = Patron (Marc) cares about it. <strong>P2</strong> = Caller
          experience. <strong>P4</strong> = Staff (Julie) burden. <strong>P5</strong> = Operator (us) margin.{' '}
          <strong>P6</strong> = Regulator (CNIL). Provisional bars use heuristic tagging — they harden once
          we have 200+ scored calls.
        </Note>
      </div>
    </Panel>
  );
}

function ConsentReceiptAudit() {
  const go = useUiStore((s) => s.go);
  const setDrill = useCallListStore((s) => s.setDrill);
  const receipts: ConsentReceipt[] = CONSENT_RECEIPTS;
  const issued = receipts.length + 120; // SNAPSHOT.consentReceiptsIssued = 124 fixture

  const optionCopy: Record<ConsentReceipt['option'], string> = {
    A: 'A · announce, no recording',
    B: 'B · opt-out recording',
    C: 'C · opt-in recording',
  };
  const optionTone: Record<ConsentReceipt['option'], 'ok' | 'flag' | 'p1'> = {
    A: 'ok', B: 'flag', C: 'p1',
  };

  const columns: Column<ConsentReceipt>[] = [
    {
      key: 'at', header: 'At (UTC)', render: (r) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
          {r.at.slice(5, 10)} {r.at.slice(11, 16)}
        </span>
      ),
    },
    { key: 'caller', header: 'Caller', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.callerMasked}</span> },
    {
      key: 'opt', header: 'Consent', render: (r) => <Pill tone={optionTone[r.option]}>{optionCopy[r.option]}</Pill>,
    },
    {
      key: 'txt', header: 'Disclosure played (CNIL audit)', width: '40%',
      render: (r) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 12.5, fontStyle: 'italic' }}>
          {r.disclosureText.length > 120 ? r.disclosureText.slice(0, 120) + '…' : r.disclosureText}
        </span>
      ),
    },
    {
      key: 'ok', header: 'Accepted', render: (r) => r.accepted
        ? <Pill tone="ok">✔ receipt issued</Pill>
        : <Pill tone="p1">✘ declined</Pill>,
    },
    {
      key: 'call', header: 'Call', render: (r) => (
        <button
          onClick={() => { setDrill({ label: `Consent receipt ${r.id}`, ids: [r.callId] }); go('calls'); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', fontSize: 12,
            background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', padding: 0,
          }}
          className="focus-ring"
        >
          {r.callId} <ExternalLink size={12} />
        </button>
      ),
    },
  ];

  return (
    <Panel>
      <PanelHead
        title={
          <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
            <ShieldCheck size={16} color="hsl(var(--success))" />
            Consent receipt audit trail
          </span>
        }
        sub={`§5 #7 · ${issued} receipts issued today · automatic CNIL-compliant proof of disclosure`}
        right={<ProvisionalTag />}
      />
      <DataTable rows={receipts} columns={columns} rowKey={(r) => r.id} />
      <div style={{ padding: 16 }}>
        <Note>
          <strong>Innovation #7</strong> — every call produces a timestamped receipt of <em>exactly</em> the
          disclosure sentence that was synthesized, the caller ANI (masked), and the option chosen. CNIL
          asks for proof that disclosure happened — this is it. No call audio is needed for the audit.
        </Note>
      </div>
    </Panel>
  );
}

function ProviderHealthPanel() {
  const rows = useOpsStore((s) => s.providerHealth);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { key: 'p', header: 'Provider', render: (r) => <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.provider}</span> },
    { key: 'r', header: 'Role', render: (r) => <Pill tone="off">{r.role}</Pill> },
    {
      key: 's', header: 'State', render: (r) => (
        <Pill tone={r.state === 'ok' ? 'ok' : r.state === 'degraded' ? 'flag' : 'p1'}>
          {r.state === 'ok' ? 'healthy' : r.state === 'degraded' ? 'degraded' : 'down'}
        </Pill>
      ),
    },
    { key: 'e', header: 'Error rate', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{(r.errorRate * 100).toFixed(1)}%</span> },
    { key: 'l', header: 'p95', align: 'end', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.latencyP95Ms ? `${r.latencyP95Ms}ms` : '—'}</span> },
    {
      key: 'f', header: 'Fallback', render: (r) => r.fallbackActive
        ? <Pill tone="flag">chain took over</Pill>
        : <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>not engaged</span>,
    },
  ];
  return (
    <Panel>
      <PanelHead title="Provider health" sub="never a silent failover" right={<ProvisionalTag />} />
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.provider} />
      <div style={{ padding: 16 }}>
        <Note>
          <strong>Telnyx is degraded</strong> — inbound errors are up but the media stream is still
          up, so calls are answering. If the chain is ever <em>exhausted</em>, this becomes a P1 with
          blast radius, not a silent retry loop.
        </Note>
      </div>
    </Panel>
  );
}

export function AlertDetailPage() {
  const alertId = useUiStore((s) => s.alertId);
  const go = useUiStore((s) => s.go);
  const setDrill = useCallListStore((s) => s.setDrill);
  const p1 = useOpsStore((s) => s.p1);
  const p2Grouped = useOpsStore((s) => s.p2Grouped);
  const all = [...p1, ...Object.values(p2Grouped).flat()];
  const a = all.find((x) => x.id === alertId) ?? all[0];

  /** The affected calls. Real payloads carry these ids; the fixture maps by rule. */
  const affectedIds = a.rule === 'transfer_failed' ? ['c_01', 'c_02', 'c_05', 'c_08'] : ['c_01', 'c_05'];
  const openAffected = () => {
    setDrill({ label: `${a.rule.replace(/_/g, ' ')} — ${affectedIds.length} calls`, ids: affectedIds });
    go('calls');
  };

  return (
    <Panel>
      <PanelHead
        title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Button size="sm" onClick={() => go('ops')}>◀ Ops</Button>
          <Pill tone={a.severity === 'P1' ? 'p1' : 'flag'}>{a.severity}</Pill>
          {a.rule.replace(/_/g, ' ')}
        </span>}
        right={<span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{a.evidence.lastAt}</span>}
      />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ borderInlineStart: '3px solid var(--ai)', paddingInlineStart: 14 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ai)', fontWeight: 600 }}>
            ⟡ Do this
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--text-primary)' }}>{a.decision}</p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{a.oneLiner}</p>
        </div>

        <div>
          <SectionTitle>Evidence</SectionTitle>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {a.evidence.count} occurrences · first {a.evidence.firstAt} · last {a.evidence.lastAt} ·
            blast radius: {a.evidence.blastRadius}
          </div>
          <div style={{ marginTop: 10 }}>
            <DataTable
              rows={[
                { id: '1', caller: '+33 6 •• •• 41 22', waited: '4:10', msg: '"je voudrais parler à quelqu’un"' },
                { id: '2', caller: '+33 7 •• •• 09 88', waited: '2:33', msg: '"rappelez-moi après 15h"' },
                { id: '3', caller: '+33 6 •• •• 33 90', waited: '1:08', msg: '"il y a quelqu’un ?"' },
              ]}
              rowKey={(r) => r.id}
              columns={[
                { key: 'c', header: 'Caller', render: (r) => <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{r.caller}</span> },
                { key: 'w', header: 'Waited', render: (r) => r.waited },
                { key: 'm', header: 'Message captured', render: (r) => <span style={{ color: 'var(--text-secondary)' }}>{r.msg} →</span> },
              ]}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button primary onClick={openAffected}>Open the {affectedIds.length} calls</Button>
          {!a.acknowledgedAt
            ? <Button onClick={() => useOpsStore.getState().acknowledge(a.id)}>Acknowledge (x)</Button>
            : <AckBadge at={a.acknowledgedAt} by={a.acknowledgedBy} />}
          <span style={{ flex: 1 }} />
          <ProvisionalTag />
        </div>

        <Note>
          The assistant never retries a transfer silently. A failed transfer always falls through to
          message-taking, so a caller is never left waiting for a human who is not coming.
        </Note>
      </div>
    </Panel>
  );
}
