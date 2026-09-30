import { useEffect, useMemo, useState } from 'react';
import {
  Play, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ChevronRight,
  FlaskConical, Eye, MessageSquare, User, RotateCcw, Zap,
} from 'lucide-react';
import { useScenarioStore, useUiStore } from '../store';
import { GUARDRAIL_SCENARIOS, GUARDRAILS } from '../data';
import {
  Panel, PanelHead, Pill, Button, Note, AiBanner, SectionTitle, DataTable,
  SectionLabel, EmptyState, ProgressBar, Card,
  type Column, type PillTone,
} from '../components/ui';
import type {
  CallOutcome, GuardrailScenario, GuardrailId, ScenarioResult, Turn,
} from '../types';
import { runScenario, runAll } from '../scenarios/runner';

/* ══════════════════════════════════════════════════════════════════════════
   Constants — persona meta, tone maps
   ══════════════════════════════════════════════════════════════════════════ */

type PersonaId = GuardrailScenario['testsFearOf'];

const PERSONA_PILL: Record<PersonaId, PillTone> = {
  P1: 'ai', P2: 'flag', P3: 'ok', P4: 'tr', P5: 'vm', P6: 'p1',
};

const PERSONA_LABEL: Record<PersonaId, string> = {
  P1: 'Marc', P2: 'Sophie', P3: 'Camille', P4: 'Julie', P5: 'Operator', P6: 'CNIL',
};

const PERSONA_DESC: Record<PersonaId, string> = {
  P1: 'Marc — SME owner. Fears: wrong promise, liability, embarrassment.',
  P2: 'Sophie — Caller. Fears: trapped in a bot, waiting, no one listening.',
  P3: 'Camille — AI agent. She discloses AI in sentence 0.',
  P4: 'Julie — Staff. Fears: blind transfers with no context.',
  P5: 'Operator (us). Fears: silent fails, margin, uptime.',
  P6: 'Regulator CNIL GDPR. Fears: recording without consent, data leak.',
};

const OUTCOME_TONE: Record<CallOutcome, PillTone> = {
  contained: 'ok',
  transferred: 'tr',
  voicemail: 'vm',
  abandoned: 'off',
};

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  contained: 'contained',
  transferred: 'transferred',
  voicemail: 'voicemail',
  abandoned: 'abandoned',
};

/* ══════════════════════════════════════════════════════════════════════════
   Filter state — local to the page, not in the store
   ══════════════════════════════════════════════════════════════════════════ */

type StatusFilter = 'all' | 'passed' | 'failed' | 'unrun';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'passed', label: 'Passed' },
  { id: 'failed', label: 'Failed' },
  { id: 'unrun', label: 'Not run' },
];

/* ══════════════════════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════════════════════ */

export function ScenariosPage() {
  const s = useScenarioStore();
  const notify = useUiStore((st) => st.notify);

  const [progressPct, setProgressPct] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [personaFilter, setPersonaFilter] = useState<PersonaId | 'all'>('all');
  const [runningAll, setRunningAll] = useState(false);

  const selected = GUARDRAIL_SCENARIOS.find((g) => g.id === s.selectedScenarioId) ?? null;
  const result = selected ? s.results[selected.id] : undefined;

  /* Filtered library. Cheap enough to compute every render — 8 scenarios. */
  const visibleScenarios = useMemo(() => {
    return GUARDRAIL_SCENARIOS.filter((sc) => {
      if (personaFilter !== 'all' && sc.testsFearOf !== personaFilter) return false;
      if (statusFilter === 'all') return true;
      const r = s.results[sc.id];
      if (statusFilter === 'unrun') return !r;
      if (statusFilter === 'passed') return !!r?.passed;
      if (statusFilter === 'failed') return !!r && !r.passed;
      return true;
    });
  }, [personaFilter, statusFilter, s.results]);

  const passCount = Object.values(s.results).filter((r) => r.passed).length;
  const failCount = Object.values(s.results).filter((r) => !r.passed).length;

  /* ── Actions ─────────────────────────────────────────────────────── */

  const runSelected = async () => {
    if (!selected) return;
    s.setPlaying(true, 0);
    const sim = runScenario(selected);
    const total = sim.transcript.length;
    for (let i = 0; i <= total; i++) {
      await new Promise((r) => setTimeout(r, 650));
      s.setPlaying(true, i);
      setProgressPct(Math.round((i / Math.max(1, total)) * 100));
    }
    s.run(selected.id, sim);
    s.setPlaying(false, 0);
    setProgressPct(100);
    notify(sim.passed
      ? `✔ ${selected.title} — PASSED`
      : `⚠ ${selected.title} — FAILED · inspect the log`);
  };

  const runAllNow = () => {
    setRunningAll(true);
    const results = runAll(GUARDRAIL_SCENARIOS);
    GUARDRAIL_SCENARIOS.forEach((sc, i) => {
      setTimeout(() => {
        s.run(sc.id, results[sc.id]);
        if (i === GUARDRAIL_SCENARIOS.length - 1) {
          setRunningAll(false);
          const failed = Object.values(results).filter((r) => !r.passed);
          if (failed.length > 0) {
            s.select(failed[0].scenarioId);
            notify(`${failed.length} scenario${failed.length === 1 ? '' : 's'} failed — jumped to the first`);
          } else {
            notify(`All ${GUARDRAIL_SCENARIOS.length} scenarios passed`);
          }
        }
      }, i * 350);
    });
  };

  useEffect(() => {
    if (!s.playing) setProgressPct(result ? 100 : 0);
  }, [s.playing, result]);

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <>
      <Panel>
        <PanelHead
          title={
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <FlaskConical size={15} /> Guardrail scenarios
            </span>
          }
          sub="every persona fear, automated"
          right={
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Pill tone="ai">{GUARDRAIL_SCENARIOS.length} scenarios</Pill>
              <Pill tone="ok">{passCount} passed</Pill>
              <Pill tone={failCount > 0 ? 'p1' : 'off'}>{failCount} failed</Pill>
            </span>
          }
        />

        <div style={{ padding: '0 16px' }}>
          <AiBanner
            title="Every scenario is a persona fear, automated"
            body="The brainstorm §4+§5 listed 11 guardrails and 6 persona fears. This surface runs those fears end-to-end against the real turn loop. A green row = the fear is mitigated. A red row = the guardrail has a bug. Before the agent ever goes live, this entire panel is green."
            actions={
              <button
                className="focus-ring"
                onClick={runAllNow}
                disabled={runningAll}
                style={{
                  background: 'none', border: 0, cursor: runningAll ? 'wait' : 'pointer',
                  color: 'var(--ai)', fontWeight: 600, fontSize: 12,
                  opacity: runningAll ? 0.6 : 1,
                }}
              >
                {runningAll ? 'Running all…' : '▶ Run all ' + GUARDRAIL_SCENARIOS.length}
              </button>
            }
          />
        </div>

        {/* Failure banner — only shows when something is red. */}
        {failCount > 0 && (
          <div style={{
            margin: '0 16px 12px', padding: 12, borderRadius: 'var(--radius-lg)',
            background: '#fff1f2', border: '1px solid rgba(225,29,72,.25)',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <AlertTriangle size={16} color="var(--danger)" style={{ flex: 'none', marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: 2 }}>
                {failCount} scenario{failCount === 1 ? '' : 's'} failing — do NOT ship with this
              </strong>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                A red row means a guardrail did not fire when the persona's fear said it should.
                Inspect the log before the next release.
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <button
                  className="focus-ring"
                  onClick={() => setStatusFilter('failed')}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}
                >
                  Show the {failCount} failure{failCount === 1 ? '' : 's'} →
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 2fr', gap: 0 }}>
          {/* ── Library column ────────────────────────────────────── */}
          <div style={{ borderInlineEnd: '1px solid var(--border-primary)' }}>
            <SectionLabel>Scenario library · {visibleScenarios.length} shown</SectionLabel>

            {/* Filter row */}
            <div style={{
              padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap',
              background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)',
            }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {STATUS_FILTERS.map(({ id, label }) => {
                  const on = statusFilter === id;
                  return (
                    <button key={id} onClick={() => setStatusFilter(id)} className="focus-ring"
                      style={{
                        font: 'inherit', fontSize: 11.5, cursor: 'pointer', padding: '3px 8px',
                        border: 0, borderRadius: 'var(--radius-sm)',
                        background: on ? 'var(--accent-subtle)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: on ? 600 : 400,
                      }}>{label}</button>
                  );
                })}
              </div>
              <span style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 3 }}>
                <button
                  onClick={() => setPersonaFilter('all')} className="focus-ring"
                  title="All personas"
                  style={{
                    font: 'inherit', fontSize: 11, cursor: 'pointer',
                    padding: '3px 7px', border: 0, borderRadius: 'var(--radius-sm)',
                    background: personaFilter === 'all' ? 'var(--accent-subtle)' : 'transparent',
                    color: personaFilter === 'all' ? 'var(--accent)' : 'var(--text-tertiary)',
                    fontWeight: personaFilter === 'all' ? 600 : 400,
                  }}>All</button>
                {(Object.keys(PERSONA_LABEL) as PersonaId[]).map((p) => {
                  const on = personaFilter === p;
                  return (
                    <button key={p} onClick={() => setPersonaFilter(p)} className="focus-ring"
                      title={PERSONA_DESC[p]}
                      style={{
                        font: 'inherit', fontSize: 11, cursor: 'pointer',
                        padding: '3px 7px', border: 0, borderRadius: 'var(--radius-sm)',
                        background: on ? 'var(--accent-subtle)' : 'transparent',
                        color: on ? 'var(--accent)' : 'var(--text-tertiary)',
                        fontWeight: on ? 600 : 400,
                      }}>{p}</button>
                  );
                })}
              </div>
            </div>

            {visibleScenarios.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No scenarios match the filter"
                body="Try clearing the status or persona filter."
                action={
                  <Button size="sm" onClick={() => { setStatusFilter('all'); setPersonaFilter('all'); }}>
                    <RotateCcw size={12} /> Reset filters
                  </Button>
                }
              />
            ) : (
              visibleScenarios.map((sc) => (
                <ScenarioRow
                  key={sc.id}
                  scenario={sc}
                  result={s.results[sc.id]}
                  selected={s.selectedScenarioId === sc.id}
                  onSelect={() => s.select(sc.id)}
                />
              ))
            )}
          </div>

          {/* ── Detail column ─────────────────────────────────────── */}
          <div style={{ minWidth: 0 }}>
            {!selected ? (
              <EmptyState
                icon="🧪"
                title="Pick a scenario"
                body="Each row on the left encodes one persona fear from the brainstorm doc. Click to inspect the setup, hit Run, and watch the guardrails fire in real time."
              />
            ) : (
              <ScenarioDetail
                sc={selected}
                result={result}
                playing={s.playing}
                playingTurn={s.playingTurn}
                progressPct={progressPct}
                onRun={runSelected}
              />
            )}
          </div>
        </div>
      </Panel>

      <GuardrailCatalogPanel />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Scenario row — one library entry
   ══════════════════════════════════════════════════════════════════════════ */

function ScenarioRow({
  scenario, result, selected, onSelect,
}: {
  scenario: GuardrailScenario;
  result: ScenarioResult | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="focus-ring"
      style={{
        width: '100%', textAlign: 'start', font: 'inherit', cursor: 'pointer',
        padding: '12px 16px',
        border: 0, borderBottom: '1px solid var(--border-secondary)',
        background: selected ? 'var(--accent-subtle)' : 'transparent',
        borderInlineStart: selected ? '3px solid var(--accent)' : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <Pill tone={PERSONA_PILL[scenario.testsFearOf]}>
          {scenario.testsFearOf} · {PERSONA_LABEL[scenario.testsFearOf]}
        </Pill>
        <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>{scenario.title}</strong>
        {result && (result.passed
          ? <Pill tone="ok" style={{ fontSize: 10.5 }}>✔ pass</Pill>
          : <Pill tone="p1" style={{ fontSize: 10.5 }}>✗ fail</Pill>)}
      </div>

      <div style={{
        fontSize: 12, color: 'var(--text-secondary)',
        lineHeight: 1.45, marginBottom: 6,
      }}>
        {scenario.setup.slice(0, 118)}
        {scenario.setup.length > 118 && '…'}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {scenario.mustFire.slice(0, 3).map((g) => (
          <Pill key={g} tone="flag" style={{ fontSize: 10.5 }}>
            must: {g.replace(/_/g, ' ').toLowerCase()}
          </Pill>
        ))}
        <Pill tone={OUTCOME_TONE[scenario.expectedOutcome]} style={{ fontSize: 10.5 }}>
          → {OUTCOME_LABEL[scenario.expectedOutcome]}
        </Pill>
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Scenario detail — header + transcript + verdict + why-it-matters
   ══════════════════════════════════════════════════════════════════════════ */

function ScenarioDetail({
  sc, result, playing, playingTurn, progressPct, onRun,
}: {
  sc: GuardrailScenario;
  result: ScenarioResult | undefined;
  playing: boolean;
  playingTurn: number;
  progressPct: number;
  onRun: () => void;
}) {
  const visibleTranscript = playing
    ? sc.callerTurns.length + playingTurn
    : (result?.transcript.length ?? 0);

  const shownTurns = (result?.transcript ?? []).slice(
    0,
    playing ? Math.max(1, visibleTranscript) : undefined,
  );

  return (
    <>
      <ScenarioHeader
        sc={sc}
        result={result}
        playing={playing}
        playingTurn={playingTurn}
        progressPct={progressPct}
        onRun={onRun}
      />

      <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
        <SectionTitle style={{ marginBottom: 8 }}>Transcript</SectionTitle>

        {!playing && !result && (
          <div style={{
            padding: 14, borderRadius: 'var(--radius)', background: 'var(--bg-secondary)',
            fontSize: 12, color: 'var(--text-tertiary)',
          }}>
            Press Run to simulate the caller turns against the agent's guardrail loop.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {shownTurns.map((t) => <TranscriptLine key={t.idx} turn={t} />)}
        </div>
      </div>

      {result && <ScenarioVerdict sc={sc} result={result} />}

      <div style={{ padding: 16 }}>
        <SectionTitle style={{ marginBottom: 8 }}>Why this matters — the brainstorm source</SectionTitle>
        <Note icon={false}>{sc.whyItMatters}</Note>
      </div>
    </>
  );
}

function ScenarioHeader({
  sc, result, playing, playingTurn, progressPct, onRun,
}: {
  sc: GuardrailScenario;
  result: ScenarioResult | undefined;
  playing: boolean;
  playingTurn: number;
  progressPct: number;
  onRun: () => void;
}) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Pill tone={PERSONA_PILL[sc.testsFearOf]} style={{ fontSize: 12 }}>
          {sc.testsFearOf} · {PERSONA_DESC[sc.testsFearOf].split('—')[1].trim()}
        </Pill>
        {result && (result.passed
          ? <Pill tone="ok"><CheckCircle2 size={12} /> PASSED</Pill>
          : <Pill tone="p1"><XCircle size={12} /> FAILED</Pill>)}
      </div>

      <h3 style={{ margin: '4px 0', fontSize: 15, color: 'var(--text-primary)' }}>
        {sc.title}
      </h3>
      <p style={{
        margin: '4px 0 12px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55,
      }}>
        {sc.setup}
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button primary onClick={onRun} disabled={playing}>
          <Play size={13} /> {playing
            ? `Playing turn ${playingTurn}…`
            : result ? 'Re-run scenario' : '▶ Run scenario'}
        </Button>
        {(playing || result) && (
          <div style={{ flex: '1 1 180px', minWidth: 180 }}>
            <ProgressBar
              value={progressPct}
              tone={result?.passed === false ? 'p1' : 'ok'}
              height={6}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TranscriptLine({ turn }: { turn: Turn }) {
  const isAgent = turn.role === 'agent';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {isAgent
        ? <ShieldCheck size={15} color="var(--accent)" style={{ marginTop: 4, flex: 'none' }} />
        : <User size={15} color="var(--text-secondary)" style={{ marginTop: 4, flex: 'none' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2,
        }}>
          {isAgent ? 'Agent' : 'Caller'} turn {turn.idx}
        </div>
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--radius)',
          color: 'var(--text-primary)', fontSize: 13,
          background: isAgent ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
          border: `1px solid ${isAgent ? 'rgba(11,87,208,.18)' : 'var(--border-primary)'}`,
        }}>
          {turn.text}
        </div>
        {turn.guardrailFired && (
          <div style={{ marginTop: 4, display: 'inline-flex', gap: 4 }}>
            <Pill tone="p1">🔥 {turn.guardrailFired.replace(/_/g, ' ').toLowerCase()}</Pill>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioVerdict({ sc, result }: { sc: GuardrailScenario; result: ScenarioResult }) {
  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border-secondary)' }}>
      <SectionTitle style={{ marginBottom: 10 }}>Pass / Fail</SectionTitle>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 8, marginBottom: 12,
      }}>
        <ResultCard
          title="Must fire"
          items={sc.mustFire.map((g) => ({ id: g, ok: result.fired.includes(g) }))}
          tone="flag"
        />
        {sc.mustNotFire && sc.mustNotFire.length > 0 && (
          <ResultCard
            title="Must NOT fire"
            items={sc.mustNotFire.map((g) => ({ id: g, ok: !result.fired.includes(g) }))}
            tone="ok"
          />
        )}
        <OutcomeCard expected={sc.expectedOutcome} actual={result.outcome} />
      </div>

      <div style={{
        marginTop: 6, padding: 12, borderRadius: 'var(--radius-lg)',
        background: result.passed ? 'var(--success-light)' : '#fff1f2',
        border: `1px solid ${result.passed ? 'rgba(5,150,105,.2)' : 'rgba(225,29,72,.22)'}`,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          {result.passed
            ? <CheckCircle2 size={15} color="var(--success)" />
            : <AlertTriangle size={15} color="var(--danger)" />}
          <strong style={{ color: result.passed ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
            {result.passed ? 'Fear mitigated' : 'Scenario failure — do NOT ship with this'}
          </strong>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {result.explanation}
        </div>
      </div>
    </div>
  );
}

function OutcomeCard({ expected, actual }: { expected: CallOutcome; actual: CallOutcome }) {
  const match = expected === actual;
  return (
    <Card style={{ padding: 12 }}>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
        color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600,
      }}>
        Outcome
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>expected:</span>
        <Pill tone={OUTCOME_TONE[expected]}>{OUTCOME_LABEL[expected]}</Pill>
        <ChevronRight size={13} color="var(--text-tertiary)" />
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>actual:</span>
        <Pill tone={OUTCOME_TONE[actual]}>{OUTCOME_LABEL[actual]}</Pill>
        {match
          ? <Pill tone="ok">✔ match</Pill>
          : <Pill tone="p1">✗ mismatch</Pill>}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Result card — one column of the pass/fail grid
   ══════════════════════════════════════════════════════════════════════════ */

function ResultCard({
  title, items, tone,
}: {
  title: string;
  items: { id: GuardrailId; ok: boolean }[];
  tone: PillTone;
}) {
  return (
    <Card style={{ padding: 12 }}>
      <div style={{
        fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
        color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map(({ id, ok }) => {
          const meta = GUARDRAILS.find((g) => g.id === id);
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {ok
                ? <CheckCircle2 size={13} color="var(--success)" />
                : <XCircle size={13} color="var(--danger)" />}
              <Pill tone={tone} style={{ fontSize: 10.5 }}>
                {id.replace(/_/g, ' ').toLowerCase()}
              </Pill>
              <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                {ok ? '✓ fired' : '✗ missed'} · {meta?.summary.slice(0, 58) ?? ''}
              </span>
            </div>
          );
        })}
        {items.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>none</span>
        )}
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Guardrail catalog — the reference table below the simulator
   ══════════════════════════════════════════════════════════════════════════ */

function GuardrailCatalogPanel() {
  const columns: Column<(typeof GUARDRAILS)[number]>[] = [
    {
      key: 'id',
      header: 'Guardrail',
      render: (r) => (
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 12.5 }}>
              {r.id.replace(/_/g, ' ')}
            </strong>
            <Pill tone={guardrailTierTone(r.tier)}>{r.tier}</Pill>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {r.summary}
          </div>
        </div>
      ),
    },
    {
      key: 'r',
      header: 'Escalates to',
      render: (r) => <Pill tone={escalationTone(r.escalatesTo)}>{r.escalatesTo}</Pill>,
    },
    {
      key: 'p',
      header: 'Persona rule',
      render: (r) => (
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>
          {r.personaRule.slice(0, 140)}
          {r.personaRule.length > 140 ? '…' : ''}
        </span>
      ),
    },
  ];

  return (
    <Panel>
      <PanelHead
        title={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <Eye size={15} /> Guardrail catalog
        </span>}
        sub={`${GUARDRAILS.length} guardrails the agent obeys on every single turn. The scenarios above exercise each one.`}
        right={<Pill tone="off">refusal copy hidden in console — editable only as a change request</Pill>}
      />
      <DataTable rows={GUARDRAILS} columns={columns} rowKey={(r) => r.id} />
      <div style={{ padding: 16 }}>
        <Note>
          <MessageSquare size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
          <strong>Why refusal copy is not editable here.</strong> The exact French refusal copy (e.g.
          <em> "Je ne peux pas vous donner de prix exact…"</em>) is written with lawyers and shipped
          per-release. A console toggle that lets an operator soften it produces a CNIL problem on the
          next audited call. Change request = new release.
        </Note>
      </div>
    </Panel>
  );
}

function guardrailTierTone(tier: string): PillTone {
  if (tier === 'consent') return 'ok';
  if (tier === 'escalation') return 'flag';
  if (tier === 'capability') return 'ai';
  if (tier === 'T3') return 'p1';
  if (tier === 'T2') return 'tr';
  return 'tr';
}

function escalationTone(to: string): PillTone {
  if (to === 'transfer') return 'tr';
  if (to === 'refuse_only') return 'off';
  if (to === 'message') return 'vm';
  return 'ai';
}

/* Silence unused-import warnings when the file is analyzed in isolation. */
void Zap;