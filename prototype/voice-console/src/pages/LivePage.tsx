import { useState } from 'react';
import {
    Phone, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle,
    Volume2, CircleUserRound, Workflow,
} from 'lucide-react';
import {
    useLiveCallStore, useReachable, useRouteFor,
} from '../store';
import { CALLS, LIVE_TURNS } from '../data';
import {
    Panel, PanelHead, Pill, Button, DegradedBanner, Note, SectionTitle,
} from '../components/ui';
import { ProviderBadge } from '../components/ProviderBadge';
import type {
    CallerEmotion, Turn, DegradedMode, AiCapabilitySlot, AiProvider,
} from '../types';

/* ── Constants ─────────────────────────────────────────────────────────── */

const EMOTION_TONE: Record<CallerEmotion, 'ok' | 'flag' | 'p1' | 'tr' | 'ai'> = {
    neutral: 'ok', stressed: 'tr', angry: 'p1', confused: 'flag', happy: 'ai',
};
const EMOTION_LABEL: Record<CallerEmotion, string> = {
    neutral: 'Neutral', stressed: 'Stressed', angry: 'Angry', confused: 'Confused', happy: 'Happy',
};
const EMOTION_ICON: Record<CallerEmotion, typeof Phone> = {
    neutral: Phone, stressed: AlertTriangle, angry: AlertTriangle, confused: Phone, happy: Phone,
};

const DEGRADED_MODES: { v: DegradedMode; l: string; i: typeof Volume2; d: string }[] = [
    { v: 'normal', l: 'Normal', i: Volume2, d: 'LLM · STT · TTS — all up' },
    { v: 'dtmf_only', l: 'DTMF only', i: Phone, d: 'LLM/STT down → press 1 for booking, 2 for transfer' },
    { v: 'alt_voice', l: 'Alt voice', i: CircleUserRound, d: 'TTS provider down → fallback voice (lower quality)' },
    { v: 'repeating', l: 'Repeating', i: AlertTriangle, d: 'STT down → agent repeats "please hold" + transfer' },
];

/** The three slots that have both a stage mark and a provider route. */
const LIVE_SLOTS: { slot: AiCapabilitySlot; label: string; stageKey: 'sttMs' | 'llmMs' | 'ttsMs' }[] = [
    { slot: 'voice.stt', label: 'STT final', stageKey: 'sttMs' },
    { slot: 'voice.llm', label: 'LLM first token', stageKey: 'llmMs' },
    { slot: 'voice.tts', label: 'TTS first byte', stageKey: 'ttsMs' },
];

const STATE_LABEL: Record<string, { l: string; tone: 'ok' | 'tr' | 'p1' | 'off' }> = {
    connecting: { l: 'CONNECTING', tone: 'tr' },
    greeting: { l: 'GREETING', tone: 'tr' },
    listening: { l: 'LISTENING', tone: 'ok' },
    thinking: { l: 'THINKING', tone: 'tr' },
    speaking: { l: 'SPEAKING', tone: 'tr' },
    closing: { l: 'CLOSING', tone: 'off' },
    wrapup: { l: 'WRAP-UP', tone: 'off' },
    idle: { l: 'IDLE', tone: 'off' },
};

function fmtDur(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   LIVE MONITOR
   ══════════════════════════════════════════════════════════════════════════ */

export function LivePage() {
    const wsStatus = useLiveCallStore((s) => s.wsStatus);
    const elapsed = useLiveCallStore((s) => s.elapsedSec);
    const degradedMode = useLiveCallStore((s) => s.degradedMode);
    const setDegraded = useLiveCallStore((s) => s.setDegraded);
    const setWs = useLiveCallStore((s) => s.setWs);
    const reachable = useReachable();

    const [expanded, setExpanded] = useState<number | null>(null);

    const sl = STATE_LABEL.speaking; // fixture-locked state
    const turns: Turn[] = LIVE_TURNS;
    const liveCall = CALLS.find((c) => c.state !== 'wrapup') ?? CALLS[0];

    /* Routing — read at render time, so a preset applied on Config shows here
       without a reload. Built once per render; the underlying selectors are
       already memoized by zustand. */
    const sttRoute = useRouteFor('voice.stt');
    const llmRoute = useRouteFor('voice.llm');
    const ttsRoute = useRouteFor('voice.tts');

    const routeBySlot: Partial<Record<AiCapabilitySlot, { provider: AiProvider; model: string }>> = {
        'voice.stt': sttRoute?.primary,
        'voice.llm': llmRoute?.primary,
        'voice.tts': ttsRoute?.primary,
    };

    const fallbackBySlot: Partial<Record<AiCapabilitySlot, { provider: AiProvider; model: string }[]>> = {
        'voice.stt': sttRoute?.fallback,
        'voice.llm': llmRoute?.fallback,
        'voice.tts': ttsRoute?.fallback,
    };

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

            {degradedMode !== 'normal' && (
                <DegradedBanner
                    tone="danger"
                    title={`Graceful degradation · ${degradedMode}`}
                    body="A provider seam has failed. The agent is NOT dead — it fell back per §5 #13. Callers never hear a dead line. Toggle the mode in the right sidebar to test each path."
                />
            )}

            <Panel>
                <PanelHead
                    title={
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                            <Pill tone={sl.tone}>
                                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', display: 'inline-block' }} />
                                {sl.l}
                            </Pill>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>⏱ {fmtDur(elapsed)}</span>
                            <Pill tone="ok"><ShieldCheck size={11} /> DISCLOSURE_FIRED · sentence 0</Pill>
                            <Pill tone="ai">scope v{liveCall.scopeVersion ?? 3}</Pill>
                            <Pill tone="off">Voice</Pill>
                        </span>
                    }
                    sub={
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            +33 6 •• •• 41 22
                            {liveCall.callerEmotion && (
                                <span>
                                    · mood:&nbsp;
                                    <Pill tone={EMOTION_TONE[liveCall.callerEmotion]} style={{ fontSize: 11 }}>
                                        {EMOTION_LABEL[liveCall.callerEmotion]}
                                    </Pill>
                                </span>
                            )}
                        </span>
                    }
                    right={
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Pill tone={wsStatus === 'connected' ? 'ok' : 'flag'}>ws: {wsStatus}</Pill>
                            <Pill tone="ai">§5 #20 provenance</Pill>
                        </span>
                    }
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0 }}>
                    {/* ── Transcript column ─────────────────────────────────── */}
                    <div
                        aria-live="polite"
                        aria-atomic="false"
                        style={{
                            padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                            opacity: wsStatus === 'connected' ? 1 : 0.6,
                        }}
                    >
                        {turns.map((t) => (
                            <TranscriptTurn
                                key={t.idx}
                                turn={t}
                                expanded={expanded === t.idx}
                                onToggle={() => setExpanded(expanded === t.idx ? null : t.idx)}
                            />
                        ))}
                    </div>

                    {/* ── Sidebar ───────────────────────────────────────────── */}
                    <aside style={{
                        borderInlineStart: '1px solid var(--border-primary)',
                        padding: 16, background: 'var(--bg-secondary)',
                        display: 'flex', flexDirection: 'column', gap: 14,
                    }}>
                        <StageMarksBlock turns={turns} routeBySlot={routeBySlot} />
                        <VoiceRoutingBlock routeBySlot={routeBySlot} fallbackBySlot={fallbackBySlot} />
                        <EmotionLadderBlock emotion={liveCall.callerEmotion ?? 'neutral'} />
                        <TransferBriefBlock brief={liveCall.transferBrief} />
                        <DegradationBlock mode={degradedMode} setMode={setDegraded} />

                        <div style={{
                            padding: 10, borderRadius: 'var(--radius)',
                            background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-secondary)',
                        }}>
                            <strong>Read-only in v1.</strong> Watching a live call is fine; acting mid-call is not a
                            capability, and a control that appears to allow it is a support ticket.
                        </div>

                        <Button size="sm" onClick={() => setWs(wsStatus === 'connected' ? 'stale' : 'connected', 3)}>
                            {wsStatus === 'connected' ? 'Break the socket' : 'Reconnect'}
                        </Button>
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

/* ══════════════════════════════════════════════════════════════════════════
   TRANSCRIPT TURN
   ══════════════════════════════════════════════════════════════════════════ */

function TranscriptTurn({
    turn, expanded, onToggle,
}: {
    turn: Turn;
    expanded: boolean;
    onToggle: () => void;
}) {
    const isAgent = turn.role === 'agent';
    const emo = turn.emotionTag;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            alignItems: isAgent ? 'flex-end' : 'flex-start',
        }}>
            <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    textTransform: 'uppercase', letterSpacing: '.04em',
                }}>
                    {isAgent ? 'Agent' : 'Caller'} turn {turn.idx}
                </span>
                {emo && (
                    <Pill tone={EMOTION_TONE[emo]} style={{ fontSize: 10.5 }}>
                        {EMOTION_LABEL[emo]}
                    </Pill>
                )}
                {turn.guardrailFired && (
                    <Pill tone="p1" style={{ fontSize: 10.5 }}>🔥 {turn.guardrailFired}</Pill>
                )}
                {isAgent && turn.provenance?.providerUsed && (
                    <ProviderBadge
                        provider={turn.provenance.providerUsed.provider}
                        model={turn.provenance.providerUsed.model}
                        muted
                    />
                )}
            </div>

            <div style={{
                maxWidth: '80%', padding: '8px 12px', borderRadius: 'var(--radius)',
                background: isAgent ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                color: 'var(--text-primary)', fontSize: 13.5,
                border: `1px solid ${isAgent ? 'rgba(11,87,208,.2)' : 'var(--border-primary)'}`,
            }}>
                {turn.text}
                {turn.idx === 4 && <span style={{ color: 'var(--text-tertiary)' }}> ▍</span>}
            </div>

            {turn.provenance && (
                <button
                    className="focus-ring"
                    onClick={onToggle}
                    style={{
                        font: 'inherit', fontSize: 11.5, cursor: 'pointer', padding: '3px 8px',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)',
                        background: 'var(--bg-secondary)', color: 'var(--ai)', fontWeight: 500,
                        display: 'inline-flex', gap: 4, alignItems: 'center',
                    }}
                >
                    {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    §5 #20 · Why did the agent say that?
                </button>
            )}

            {turn.provenance && expanded && (
                <div style={{
                    alignSelf: 'stretch', marginTop: 4, padding: 12,
                    borderRadius: 'var(--radius)', background: 'var(--ai-subtle)',
                    border: '1px solid rgba(147,51,234,.25)', fontSize: 12,
                }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Pill tone="ai">scope v{turn.provenance.scopeVersion}</Pill>
                        {turn.provenance.providerUsed && (
                            <ProviderBadge
                                provider={turn.provenance.providerUsed.provider}
                                model={turn.provenance.providerUsed.model}
                            />
                        )}
                        {turn.provenance.guardrailsChecked.length > 0 && (
                            <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                                {turn.provenance.guardrailsChecked.map((g) => (
                                    <Pill key={g} tone="ok" style={{ fontSize: 10.5 }}>
                                        checked · {g.replace(/_/g, ' ').toLowerCase()}
                                    </Pill>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{
                        fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                        color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600,
                    }}>
                        Prompt snippet (LLM)
                    </div>
                    <div style={{
                        fontFamily: 'ui-monospace, monospace', fontSize: 11.5,
                        background: 'var(--bg-primary)', padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                        marginBottom: 8, whiteSpace: 'pre-wrap',
                    }}>
                        {turn.provenance.promptSnippet}
                    </div>

                    {turn.provenance.chunks.length > 0 && (
                        <>
                            <div style={{
                                fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                                color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600,
                            }}>
                                Retrieval hits · {turn.provenance.chunks.length} chunks
                            </div>
                            {turn.provenance.chunks.map((c) => (
                                <div key={c.id} style={{
                                    padding: '6px 8px', background: 'var(--bg-primary)',
                                    borderRadius: 'var(--radius-sm)', marginBottom: 4,
                                    display: 'flex', gap: 8,
                                }}>
                                    <Pill
                                        tone={c.tier === 'T0' ? 'ok' : c.tier === 'T1' ? 'ai' : c.tier === 'T2' ? 'flag' : 'p1'}
                                        style={{ fontSize: 10.5, flex: 'none' }}
                                    >
                                        {c.tier} · {(c.score * 100).toFixed(0)}%
                                    </Pill>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>« {c.snippet} »</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {turn.stages && (
                <span style={{
                    fontSize: 11,
                    color: turn.stages.turnGapMs && turn.stages.turnGapMs < 2000 ? 'var(--success)' : 'var(--warning)',
                }}>
                    turn_gap {turn.stages.turnGapMs ?? '—'}ms
                    {turn.stages.turnGapMs && turn.stages.turnGapMs < 2000 ? ' ✔' : ' ⚠'}
                </span>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR BLOCKS
   ══════════════════════════════════════════════════════════════════════════ */

function StageMarksBlock({
    turns, routeBySlot,
}: {
    turns: Turn[];
    routeBySlot: Partial<Record<AiCapabilitySlot, { provider: AiProvider; model: string }>>;
}) {
    const current = turns[4];
    const rows: { label: string; value: number; slot: AiCapabilitySlot | null }[] = [
        { label: 'VAD', value: current?.stages?.vadMs ?? 181, slot: null },
        ...LIVE_SLOTS.map((s) => ({
            label: s.label,
            value: current?.stages?.[s.stageKey] ?? 0,
            slot: s.slot,
        })),
    ];

    return (
        <div>
            <div style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 8,
            }}>
                Stage marks — current turn
            </div>

            {rows.map((row) => (
                <div key={row.label} style={{ padding: '4px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                            {row.value}ms
                        </span>
                    </div>
                    {row.slot && routeBySlot[row.slot] && (
                        <div style={{ marginTop: 2 }}>
                            <ProviderBadge
                                provider={routeBySlot[row.slot]!.provider}
                                model={routeBySlot[row.slot]!.model}
                                muted
                            />
                        </div>
                    )}
                </div>
            ))}

            <div style={{
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-secondary)',
                fontSize: 12.5, display: 'flex', justifyContent: 'space-between',
            }}>
                <span style={{ color: 'var(--text-secondary)' }}>turn_gap</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--success)', fontWeight: 600 }}>
                    {current?.stages?.turnGapMs ?? 1524}ms ✔
                </span>
            </div>
        </div>
    );
}

function VoiceRoutingBlock({
    routeBySlot, fallbackBySlot,
}: {
    routeBySlot: Partial<Record<AiCapabilitySlot, { provider: AiProvider; model: string }>>;
    fallbackBySlot: Partial<Record<AiCapabilitySlot, { provider: AiProvider; model: string }[]>>;
}) {
    return (
        <div style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)' }}>
            <div style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
            }}>
                <Workflow size={11} /> Voice routing
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['voice.stt', 'voice.llm', 'voice.tts'] as AiCapabilitySlot[]).map((slot) => {
                    const r = routeBySlot[slot];
                    const fb = fallbackBySlot[slot] ?? [];
                    if (!r) return null;
                    return (
                        <div key={slot}>
                            <div style={{
                                fontSize: 10, color: 'var(--text-tertiary)',
                                letterSpacing: '.04em', fontWeight: 600, marginBottom: 3,
                            }}>
                                {slot.replace('voice.', '').toUpperCase()}
                            </div>
                            <ProviderBadge provider={r.provider} model={r.model} />
                            {fb.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', alignSelf: 'center' }}>→</span>
                                    {fb.map((f, i) => (
                                        <ProviderBadge
                                            key={`${f.provider}-${f.model}-${i}`}
                                            provider={f.provider}
                                            model={f.model}
                                            muted
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4 }}>
                Primary + ordered fallback, read live from the task router. Change on Config → AI routing.
            </div>
        </div>
    );
}

function EmotionLadderBlock({ emotion }: { emotion: CallerEmotion }) {
    const ladder: CallerEmotion[] = ['happy', 'neutral', 'confused', 'stressed', 'angry'];
    return (
        <div style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--bg-tertiary)' }}>
            <div style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600,
            }}>
                §5 #11 · Emotion ladder
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 6 }}>
                {ladder.map((e) => {
                    const active = emotion === e;
                    const bg = active
                        ? (e === 'angry' ? 'var(--danger)' : e === 'stressed' ? 'var(--warning)' : e === 'happy' ? 'var(--ai)' : 'var(--accent)')
                        : 'var(--border-primary)';
                    return (
                        <div
                            key={e}
                            title={EMOTION_LABEL[e]}
                            style={{
                                height: 20, borderRadius: 3, background: bg,
                                display: 'grid', placeItems: 'center',
                                color: active ? '#fff' : 'transparent',
                                fontSize: 10,
                            }}
                        >
                            {active ? '●' : ''}
                        </div>
                    );
                })}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                2 angry turns = skip the ladder. Current: <strong>{EMOTION_LABEL[emotion]}</strong>
            </div>
        </div>
    );
}

function TransferBriefBlock({ brief }: { brief: Turn['provenance'] extends never ? never : import('../types').TransferBrief | null | undefined }) {
    return (
        <div>
            <div style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600,
            }}>
                §5 #4 · Warm-transfer brief
            </div>

            {brief ? (
                <div style={{
                    padding: 10, borderRadius: 'var(--radius)',
                    background: 'var(--success-light)', border: '1px solid rgba(5,150,105,.2)',
                }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        📞 {brief.who}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        💬 {brief.what}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        🎯 Next: {brief.nextAction}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {brief.alreadySaid.map((s, i) => (
                            <span key={i} style={{ padding: '1px 6px', background: 'var(--bg-primary)', borderRadius: 999 }}>
                                «{s.slice(0, 24)}»
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div style={{
                    padding: 10, borderRadius: 'var(--radius)',
                    background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-tertiary)',
                }}>
                    No transfer requested yet. When the agent escalates, P4 Julie rings with this filled in
                    before the call reaches her.
                </div>
            )}
        </div>
    );
}

function DegradationBlock({
    mode, setMode,
}: {
    mode: DegradedMode;
    setMode: (m: DegradedMode) => void;
}) {
    return (
        <div>
            <div style={{
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
                color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600,
            }}>
                §5 #13 · Degradation mode
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                {DEGRADED_MODES.map(({ v, l, i: I, d }) => {
                    const on = mode === v;
                    const isNormal = v === 'normal';
                    return (
                        <button
                            key={v}
                            onClick={() => setMode(v)}
                            className="focus-ring"
                            title={d}
                            style={{
                                font: 'inherit', fontSize: 11.5, cursor: 'pointer', padding: '6px 8px',
                                border: `1px solid ${on ? (isNormal ? 'var(--success)' : 'var(--danger)') : 'var(--border-primary)'}`,
                                background: on ? (isNormal ? 'var(--success-light)' : '#ffe4e6') : 'var(--bg-primary)',
                                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                                display: 'flex', gap: 4, alignItems: 'center',
                            }}
                        >
                            <I
                                size={12}
                                color={on ? (isNormal ? 'var(--success)' : 'var(--danger)') : 'var(--text-tertiary)'}
                            />
                            {l}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}