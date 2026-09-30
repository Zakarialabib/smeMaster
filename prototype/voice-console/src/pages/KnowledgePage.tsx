import { useMemo, useState } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, HelpCircle,
  AlertTriangle, RotateCcw,
} from 'lucide-react';
import { useKnowledgeStore, useUiStore } from '../store';
import {
  DegradedBanner, Panel, PanelHead, Pill, Button, Note, Checkbox, AiBanner,
  SectionTitle, Tabs, Card, ProgressBar, Divider,
  type TabItem, type PillTone,
} from '../components/ui';
import { ProviderBadge } from '../components/ProviderBadge';
import { EMBEDDING_SPACES } from '../data';
import type {
  KnowledgeTier, KnowledgeScopeItem, EmbeddingSpace, EmbeddingHost,
} from '../types';

/* ══════════════════════════════════════════════════════════════════════════
   Tier constants
   ══════════════════════════════════════════════════════════════════════════ */

interface TierMeta {
  label: string;
  shortLabel: string;
  pillTone: PillTone;
  bg: string;
  badge: string;
  description: string;
}

const TIER_STYLE: Record<KnowledgeTier, TierMeta> = {
  T0: {
    label: 'T0 · Public',
    shortLabel: 'Public',
    pillTone: 'ok',
    bg: 'var(--success-light)',
    badge: '#059669',
    description: 'Hours, address, brands, services. Lives on our server. Default on.',
  },
  T1: {
    label: 'T1 · Semi-public',
    shortLabel: 'Semi-public',
    pillTone: 'ai',
    bg: 'var(--ai-subtle)',
    badge: 'var(--ai)',
    description: 'Price ranges, booking rules, staff first names. Encrypted to us. Default on.',
  },
  T2: {
    label: 'T2 · Internal',
    shortLabel: 'Internal',
    pillTone: 'flag',
    bg: 'var(--warning-light)',
    badge: 'var(--warning)',
    description: 'Client list, job history, vehicle records. Client premises ONLY via local node. Opt-in.',
  },
  T3: {
    label: 'T3 · Confidential',
    shortLabel: 'Confidential',
    pillTone: 'p1',
    bg: '#ffe4e6',
    badge: 'var(--danger)',
    description: 'Payments, HR, legal/medical. NEVER reaches our server. Hard off. Escalates.',
  },
};

const HOST_LABEL: Record<EmbeddingHost, string> = {
  server: 'Our server (EU)',
  local_node: 'Client premises',
  not_indexed: 'Not indexed',
};

const HOST_TONE: Record<EmbeddingHost, PillTone> = {
  server: 'tr',
  local_node: 'flag',
  not_indexed: 'p1',
};

/* ══════════════════════════════════════════════════════════════════════════
   Tabs
   ══════════════════════════════════════════════════════════════════════════ */

type KnowledgeTab = 'matrix' | 'wizard' | 'versions' | 'index';

const TABS: TabItem<KnowledgeTab>[] = [
  { id: 'matrix', label: 'Scope matrix' },
  { id: 'wizard', label: 'Scope wizard' },
  { id: 'versions', label: 'Version history' },
  { id: 'index', label: 'Index & spaces' },
];

/* ══════════════════════════════════════════════════════════════════════════
   Page shell
   ══════════════════════════════════════════════════════════════════════════ */

export function KnowledgePage() {
  const k = useKnowledgeStore();
  const notify = useUiStore((s) => s.notify);
  const [tab, setTab] = useState<KnowledgeTab>('matrix');

  const enabledCount = k.scope.filter((s) => s.enabled).length;
  const guardableCount = k.scope.filter((s) => s.tier !== 'T3').length;
  const totalChunks = k.scope.reduce((a, s) => a + (s.chunkCount ?? 0), 0);

  return (
    <Panel>
      <PanelHead
        title="Knowledge"
        sub="what the agent is allowed to see — 4 tiers, client-owned guardrail"
        right={
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Pill tone="ai">{enabledCount}/{guardableCount} scopes on</Pill>
            <Pill tone="off">{totalChunks} chunks</Pill>
            <Tabs<KnowledgeTab>
              ariaLabel="Knowledge views"
              value={tab}
              onChange={setTab}
              tabs={TABS}
            />
          </span>
        }
      />

      {tab === 'matrix' && <ScopeMatrixView />}
      {tab === 'wizard' && <ScopeWizardView />}
      {tab === 'versions' && <ScopeVersionsView />}
      {tab === 'index' && <IndexSpacesView />}

      {/* Persistent AI-banner + ingest state, visible from every tab. */}

      <div style={{ padding: '0 16px' }}>
        <AiBanner
          title="4 digest answers cited no chunk — refunds policy missing"
          body="The agent may not know enough about refunds. Sample question: « remboursement sous 30 jours ». This is an inference from answer/retrieval pairs, not a recorded fact."
          actions={
            <button
              className="focus-ring"
              onClick={() => notify('Opened the 4 unmatched digest answers')}
              style={{
                background: 'none', border: 0, color: 'var(--ai)',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >
              See the 4 answers →
            </button>
          }
        />
      </div>

      {k.ingest === 'failed' && (
        <div style={{ padding: '0 16px 12px' }}>
          <DegradedBanner
            title="Ingest stopped at 61% — the index is mixed"
            body="Services and hours are on the new index; booking rules are still on the old one. Answers may cite either. The previous complete index can be rolled back to."
            action={
              <span style={{ display: 'flex', gap: 8 }}>
                <Button primary size="sm" onClick={() => { k.reset(); notify('Retry ingest queued'); }}>
                  Retry ingest
                </Button>
                <Button size="sm" onClick={() => { k.reset(); notify('Rolled back to 14:20'); }}>
                  Roll back to 14:20
                </Button>
              </span>
            }
          />
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        <Note>
          Publishing re-indexes the agent's knowledge. It takes about 90 seconds and the agent keeps
          serving the previous index until it completes.
        </Note>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        padding: '12px 16px', background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-primary)',
      }}>
        <Button
          primary
          disabled={k.publishing}
          onClick={() => {
            k.publish();
            setTimeout(() => {
              k.reset();
              notify('Published · re-index queued (~90s) · new scope version created');
            }, 1200);
          }}
        >
          {k.publishing ? 'Publishing…' : 'Publish & create scope version'}
        </Button>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   View 1 — Scope matrix
   ══════════════════════════════════════════════════════════════════════════ */

function ScopeMatrixView() {
  const k = useKnowledgeStore();
  const tiers: KnowledgeTier[] = ['T0', 'T1', 'T2', 'T3'];

  return (
    <>
      <div style={{
        padding: 16, borderBottom: '1px solid var(--border-secondary)',
        display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        {tiers.map((t) => <TierCard key={t} tier={t} />)}
      </div>

      {tiers.map((tier) => {
        const items = k.scope.filter((s) => s.tier === tier);
        if (items.length === 0) return null;
        return <TierSection key={tier} tier={tier} items={items} />;
      })}
    </>
  );
}

function TierCard({ tier }: { tier: KnowledgeTier }) {
  const style = TIER_STYLE[tier];
  return (
    <div style={{
      flex: '1 1 220px', minWidth: 220, padding: 12,
      borderRadius: 'var(--radius-lg)',
      background: style.bg,
      border: `1px solid ${style.badge}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: style.badge }} />
        <strong style={{ color: style.badge }}>{style.label}</strong>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {style.description}
      </div>
    </div>
  );
}

function TierSection({ tier, items }: { tier: KnowledgeTier; items: KnowledgeScopeItem[] }) {
  const style = TIER_STYLE[tier];
  const enabled = items.filter((i) => i.enabled).length;

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-secondary)' }}>
      <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: style.badge }} />
        <SectionTitle>{style.label}</SectionTitle>
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          · {enabled}/{items.length} enabled
          {tier === 'T2' && ' · 📍 client premises node required'}
          {tier === 'T3' && ' · ⛔ NEVER enabled by design'}
        </span>
      </div>
      {items.map((it) => <ScopeRow key={it.id} item={it} />)}
    </div>
  );
}

function ScopeRow({ item }: { item: KnowledgeScopeItem }) {
  const k = useKnowledgeStore();
  const style = TIER_STYLE[item.tier];
  const isT3 = item.tier === 'T3';
  const isT2 = item.tier === 'T2';

  return (
    <div style={{
      padding: '10px 16px 10px 40px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      borderTop: '1px solid var(--border-secondary)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Checkbox
            checked={item.enabled}
            disabled={isT3 || (isT2 && !item.enabled)}
            onChange={() => k.toggle(item.id)}
            label={
              <strong style={{ color: isT3 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {item.label}
              </strong>
            }
          />
          <Pill tone={style.pillTone}>{style.shortLabel}</Pill>
          {item.chunkCount
            ? <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{item.chunkCount} chunks</span>
            : null}
          {isT2 && !item.enabled && <Pill tone="flag">📍 needs local node</Pill>}
          {isT3 && <Pill tone="p1">⛔ confidential — NEVER</Pill>}
        </div>

        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {item.description}
        </p>

        {item.examples.length > 0 && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Ex.{' '}
            {item.examples.slice(0, 3).map((e, i) => (
              <span key={i}>
                « {e} »{i < item.examples.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   View 2 — Scope wizard
   ══════════════════════════════════════════════════════════════════════════ */

function ScopeWizardView() {
  const k = useKnowledgeStore();
  const notify = useUiStore((s) => s.notify);
  const [answered, setAnswered] = useState<Record<string, boolean | null>>({});

  const questions = useMemo(
    () => k.scope.filter((s) => s.wizardQuestion),
    [k.scope],
  );
  const t3Items = useMemo(
    () => k.scope.filter((s) => s.tier === 'T3'),
    [k.scope],
  );

  const done = Object.keys(answered).length;
  const total = questions.length;
  const combinedTotal = total + t3Items.length;
  const combinedDone = done + t3Items.length;
  const progressPct = combinedTotal === 0 ? 0 : (combinedDone / combinedTotal) * 100;
  const isComplete = done === total;

  /**
   * Answer one question.
   *
   * The previous version called `k.toggle` and then checked `!it.enabled`
   * against a stale snapshot, which netted zero change on any item that was
   * already in the desired state and inverted the change on items that were
   * not. The correct behaviour is to toggle only when the intent differs
   * from the current state — one toggle per user action, always in the
   * direction the user asked for.
   */
  const onAnswer = (id: string, yes: boolean) => {
    const item = k.scope.find((s) => s.id === id);
    if (!item || item.tier === 'T3') return;
    setAnswered((prev) => ({ ...prev, [id]: yes }));
    if (yes !== item.enabled) k.toggle(id);
  };

  const reset = () => {
    setAnswered({});
    notify('Wizard answers cleared — scope items unchanged');
  };

  return (
    <div style={{ padding: 16 }}>
      <AiBanner
        title="The wizard turns the guardrail into plain-language questions"
        body="§4 decision #5 blocker: the client no longer has to decide « what content is allowed to reach our server ». They answer yes/no questions. Every T3 item is forced to NO with an explanation. The 4-tier framework runs behind the UX."
      />

      <ProgressHeader
        done={done}
        total={total}
        t3Count={t3Items.length}
        progressPct={progressPct}
        isComplete={isComplete}
        onReset={reset}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q, i) => (
          <WizardQuestion
            key={q.id}
            n={i + 1}
            item={q}
            answer={answered[q.id] ?? null}
            onAnswer={(v) => onAnswer(q.id, v)}
          />
        ))}
      </div>

      <LockedTiersNote t3Items={t3Items} />
    </div>
  );
}

function ProgressHeader({
  done, total, t3Count, progressPct, isComplete, onReset,
}: {
  done: number;
  total: number;
  t3Count: number;
  progressPct: number;
  isComplete: boolean;
  onReset: () => void;
}) {
  return (
    <div style={{
      margin: '12px 0 16px', padding: 12,
      borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)',
      display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4,
        }}>
          <span>
            Progress · answered {done} of {total}
            {t3Count > 0 && <> · {t3Count} auto-locked (T3)</>}
          </span>
          <span style={{
            fontWeight: 600,
            color: isComplete ? 'var(--success)' : 'var(--accent)',
          }}>
            {Math.round(progressPct)}%
          </span>
        </div>
        <ProgressBar value={progressPct} tone={isComplete ? 'ok' : 'tr'} />
      </div>
      <Button size="sm" onClick={onReset}>
        <RotateCcw size={12} /> Reset answers
      </Button>
    </div>
  );
}

function WizardQuestion({
  n, item, answer, onAnswer,
}: {
  n: number;
  item: KnowledgeScopeItem;
  answer: boolean | null;
  onAnswer: (v: boolean) => void;
}) {
  const style = TIER_STYLE[item.tier];
  const hasAnswer = answer !== null;

  const bg = !hasAnswer
    ? 'var(--bg-primary)'
    : answer ? 'var(--success-light)' : 'var(--bg-tertiary)';
  const borderColor = !hasAnswer
    ? 'var(--border-primary)'
    : answer ? 'rgba(5,150,105,.25)' : 'var(--border-primary)';

  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-lg)',
      background: bg, border: `1px solid ${borderColor}`,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        flex: 'none', width: 28, height: 28, borderRadius: 999,
        background: 'var(--bg-tertiary)',
        display: 'grid', placeItems: 'center',
        fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
      }}>{n}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <HelpCircle size={14} color="var(--accent)" />
          <span style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            {item.wizardQuestion}
          </span>
          <Pill tone={style.pillTone}>{style.label}</Pill>
          {item.requiresLocalNode && <Pill tone="flag">📍 client-local node</Pill>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          {item.description}
          {item.examples.length > 0 && <> · {item.examples[0]}</>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button primary={answer === true} size="sm" onClick={() => onAnswer(true)}>
            <CheckCircle2 size={13} /> Yes, allow
          </Button>
          <Button primary={answer === false} size="sm" onClick={() => onAnswer(false)}>
            <XCircle size={13} /> No, keep off
          </Button>
          {hasAnswer && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: answer ? 'var(--success)' : 'var(--text-tertiary)',
            }}>
              {answer ? '✅ On' : '❌ Off'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LockedTiersNote({ t3Items }: { t3Items: KnowledgeScopeItem[] }) {
  return (
    <div style={{
      marginTop: 20, padding: 16,
      borderRadius: 'var(--radius-lg)',
      background: '#ffe4e6',
      border: '1px solid rgba(225,29,72,.25)',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <ShieldCheck size={16} color="var(--danger)" />
        <strong style={{ color: 'var(--danger)' }}>
          ⛔ Confidential (T3) — automatically locked OFF
        </strong>
      </div>

      <Note icon={false}>
        The following are <strong>never</strong> reachable by design. If the agent is asked, it
        refuses and transfers. These are not negotiable questions — they are listed so the client
        can see the full boundary.
      </Note>

      <div style={{
        marginTop: 8, display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 8,
      }}>
        {t3Items.map((it) => (
          <div key={it.id} style={{
            padding: 10, borderRadius: 'var(--radius)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <XCircle size={15} color="var(--danger)" style={{ flex: 'none', marginTop: 1 }} />
            <div style={{ fontSize: 12.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{it.label}</strong>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{it.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   View 3 — Version history
   ══════════════════════════════════════════════════════════════════════════ */

function ScopeVersionsView() {
  const k = useKnowledgeStore();
  const currentScope = Object.fromEntries(k.scope.map((s) => [s.id, s.enabled]));

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Note>
        <strong>§5 innovation #20:</strong> scope is versioned. Every change is a new version with
        a timestamp, an approver, and a snapshot of the enabled items. If the agent says something
        wrong, you replay the call against the exact scope version that was live.{' '}
        <em>The wizard and the matrix always write a new version on Publish.</em>
      </Note>

      <VersionCard
        label="Unpublished draft"
        icon="🚧"
        draft
        at="now"
        by="current editor"
        scope={currentScope}
        scopeItems={k.scope}
      />

      {k.versions
        .slice()
        .reverse()
        .map((v) => (
          <VersionCard
            key={v.version}
            label={`v${v.version}`}
            icon="🗂"
            at={v.at}
            by={v.by}
            scope={v.snapshot}
            scopeItems={k.scope}
            changeSummary={v.changeSummary}
            isLive={v.version === Math.max(...k.versions.map((x) => x.version))}
          />
        ))}
    </div>
  );
}

function VersionCard({
  label, icon, at, by, scope, scopeItems, changeSummary, draft, isLive,
}: {
  label: string;
  icon: string;
  at: string;
  by: string;
  scope: Record<string, boolean>;
  scopeItems: KnowledgeScopeItem[];
  changeSummary?: string;
  draft?: boolean;
  isLive?: boolean;
}) {
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-lg)',
      background: draft ? 'var(--warning-light)' : 'var(--bg-primary)',
      border: `1px solid ${draft ? 'rgba(217,119,6,.3)' : 'var(--border-primary)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <strong style={{ color: draft ? 'var(--warning)' : 'var(--text-primary)' }}>
          {icon} {label}
        </strong>
        <span style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {at} · by {by}
        </span>
        {isLive && !draft && <Pill tone="ok">● live</Pill>}
        {draft && <Pill tone="flag">draft · not yet published</Pill>}
      </div>

      {changeSummary && !draft && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {changeSummary}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 6,
      }}>
        {Object.entries(scope).map(([id, on]) => {
          const meta = scopeItems.find((s) => s.id === id);
          return (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 'var(--radius-sm)',
              background: on ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
              fontSize: 12,
            }}>
              {on
                ? <CheckCircle2 size={12} color="var(--success)" />
                : <XCircle size={12} color="var(--text-tertiary)" />}
              <span style={{ color: on ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {meta?.label ?? id}
              </span>
              {meta && <Pill tone={TIER_STYLE[meta.tier].pillTone}>{meta.tier}</Pill>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   View 4 — Index & spaces (new)
   ══════════════════════════════════════════════════════════════════════════ */

function IndexSpacesView() {
  const spaces = EMBEDDING_SPACES;

  const totalChunks = spaces.reduce((a, s) => a + s.docCount, 0);
  const pinnedSpaces = spaces.filter((s) => s.host !== 'not_indexed').length;
  const serverSpaces = spaces.filter((s) => s.host === 'server').length;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <AiBanner
        title="Embedding spaces — the vector-space trap made visible"
        body="Two embedding models produce two vector spaces. A vector from bge-m3 and a vector from arctic-embed-l are not comparable even when both are 1024-d. Swapping the embedder is a config change for the agent and a full re-embed for the corpus — the two are not the same decision, and this page says so out loud."
      />

      <SummaryStrip
        spaces={spaces.length}
        chunks={totalChunks}
        pinnedSpaces={pinnedSpaces}
        serverSpaces={serverSpaces}
      />

      <SectionTitle>Spaces in use</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spaces.map((space) => <SpaceCard key={space.id} space={space} />)}
      </div>

      <Divider label="Why swap ≠ config value" />

      <Note>
        <strong>The Gate 1 exit criterion is "swap is a config value."</strong> For the LLM that is
        true — the router picks a different provider and the next call uses it. For the embedder it
        is <em>half</em> true: the config value changes, and then the index must be rebuilt before
        any query returns a correct answer. The operator sees the same colour as a provider swap;
        the operator's <em>second</em> step is completely different.
      </Note>
    </div>
  );
}

function SummaryStrip({
  spaces, chunks, pinnedSpaces, serverSpaces,
}: {
  spaces: number;
  chunks: number;
  pinnedSpaces: number;
  serverSpaces: number;
}) {
  const items: { label: string; value: string; sub: string; tone: PillTone }[] = [
    { label: 'Spaces', value: String(spaces), sub: 'one per distinct vector space', tone: 'ai' },
    { label: 'Chunks indexed', value: chunks.toLocaleString('fr-FR'), sub: 'across all spaces', tone: 'ok' },
    { label: 'Pinned spaces', value: String(pinnedSpaces), sub: 'cannot be swapped without re-embed', tone: 'flag' },
    { label: 'On our server', value: String(serverSpaces), sub: 'the rest is local or not indexed', tone: 'tr' },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 10,
    }}>
      {items.map(({ label, value, sub, tone }) => (
        <Card key={label} style={{ padding: 12 }}>
          <div style={{
            fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em',
            color: toneColor(tone), fontWeight: 600, marginBottom: 2,
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-primary)', marginBottom: 2,
          }}>
            {value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div>
        </Card>
      ))}
    </div>
  );
}

function SpaceCard({ space }: { space: EmbeddingSpace }) {
  const isNone = space.host === 'not_indexed';

  return (
    <Card
      style={{
        padding: 14,
        background: isNone ? '#fff1f2' : 'var(--bg-primary)',
        borderColor: isNone ? 'rgba(225,29,72,.22)' : 'var(--border-primary)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        gap: 12, flexWrap: 'wrap', marginBottom: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <strong style={{
              fontFamily: isNone ? 'inherit' : 'ui-monospace, monospace',
              fontSize: 13, color: 'var(--text-primary)',
            }}>
              {space.id}
            </strong>
            <Pill tone={HOST_TONE[space.host]}>{HOST_LABEL[space.host]}</Pill>
            {space.licence !== '—' && <Pill tone="off">{space.licence}</Pill>}
            {space.provider && (
              <ProviderBadge provider={space.provider} model={space.modelId} muted />
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            {space.tiers.map((t) => (
              <Pill key={t} tone={TIER_STYLE[t].pillTone}>{TIER_STYLE[t].shortLabel}</Pill>
            ))}
          </div>

          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {space.note}
          </div>
        </div>

        {/* Right column — the numeric facts, quick to scan. */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'auto auto',
          columnGap: 14, rowGap: 4, fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Model</span>
          <span style={{
            color: 'var(--text-secondary)',
            fontFamily: 'ui-monospace, monospace',
          }}>
            {space.modelLabel}
          </span>

          <span style={{ color: 'var(--text-tertiary)' }}>Dims</span>
          <span style={{
            color: 'var(--text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {space.dimensions > 0 ? space.dimensions : '—'}
          </span>

          <span style={{ color: 'var(--text-tertiary)' }}>Docs</span>
          <span style={{
            color: 'var(--text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {space.docCount.toLocaleString('fr-FR')}
          </span>
        </div>
      </div>

      {!isNone && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          padding: '8px 10px', borderRadius: 'var(--radius-sm)',
          background: 'var(--warning-light)',
          border: '1px solid rgba(217,119,6,.25)',
        }}>
          <AlertTriangle size={13} color="var(--warning)" style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.45 }}>
            <strong>Swap cost:</strong> {space.swapWarning}
          </div>
        </div>
      )}
    </Card>
  );
}

function toneColor(tone: PillTone): string {
  switch (tone) {
    case 'ok': return 'var(--success)';
    case 'tr': return 'var(--accent)';
    case 'vm': return '#0891b2';
    case 'p1': return 'var(--danger)';
    case 'flag': return 'var(--warning)';
    case 'ai': return 'var(--ai)';
    case 'off': return 'var(--text-tertiary)';
  }
}