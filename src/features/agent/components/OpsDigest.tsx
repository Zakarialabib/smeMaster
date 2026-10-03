import { useCallback } from 'react';
import { agentApi } from '../api/client';
import { useAgentResource } from '../api/useAgentResource';
import {
  AgentBadge,
  AgentCard,
  AgentEmpty,
  AgentResource,
  AgentSkeleton,
} from '../components/States';
import type { OpsAlert, OpsSnapshot, ProviderHealth, Severity } from '../types/commands';

/**
 * The Ops digest — the screen that decides whether a human does anything today.
 *
 * Ported from the prototype's `OpsPage.tsx`, with three differences that matter:
 *
 * 1. **No fixtures.** It reads the live `GET /ops/snapshot`. If the server is
 *    down the screen says so instead of showing a healthy-looking digest.
 * 2. **Four states, not one.** Loading, ready, unreachable, failed.
 * 3. **Token classes only.** The prototype's inline `style={{ color: '#9333ea' }}`
 *    is gone; a theme change now moves this screen with everything else.
 *
 * NOT WIRED YET: this component is not in the router. The prototype is still the
 * visual source of truth until someone puts it behind a route.
 */

/** Severity drives colour AND wording. A P1 that reads like a P3 is a bug. */
const SEVERITY_TONE: Record<Severity, 'danger' | 'warning' | 'neutral'> = {
  P1: 'danger',
  P2: 'warning',
  P3: 'neutral',
};

function AlertRow({ alert }: { alert: OpsAlert }) {
  return (
    <li className="border-b border-border-primary/60 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <AgentBadge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</AgentBadge>
        <span className="text-sm text-text-primary">{alert.oneLiner}</span>
      </div>

      {/*
        The DECISION is the point of an alert. An alert without one is a log
        line, and the operator has to do the analysis themselves — which is the
        job this screen exists to do.
      */}
      <p className="mt-2 text-sm text-text-secondary" data-testid={`decision-${alert.id}`}>
        <span className="text-text-tertiary">What to do: </span>
        {alert.decision}
      </p>

      <p className="mt-1 text-xs text-text-tertiary">
        {alert.evidence.count} in window · {alert.evidence.firstAt}–{alert.evidence.lastAt} ·{' '}
        {alert.evidence.blastRadius}
      </p>

      {/*
        A PROVISIONAL threshold must say so. Without this the console presents a
        number nobody agreed on as though it were a limit, and the first
        conversation about it is with a client rather than with us.
      */}
      {alert.thresholdIsProvisional && (
        <p className="mt-1 text-xs text-warning" data-testid={`provisional-${alert.id}`}>
          Threshold is provisional — not yet agreed with the client.
        </p>
      )}

      {alert.acknowledgedAt && (
        <p className="mt-1 text-xs text-text-tertiary">
          Acknowledged {alert.acknowledgedAt.slice(11, 16)} by {alert.acknowledgedBy}
        </p>
      )}
    </li>
  );
}

function ProviderRow({ p }: { p: ProviderHealth }) {
  const tone = p.state === 'ok' ? 'success' : p.state === 'degraded' ? 'warning' : 'danger';
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <AgentBadge tone={tone}>{p.state}</AgentBadge>
        <span className="text-text-primary">{p.provider}</span>
        <span className="text-text-tertiary">{p.role}</span>
      </span>
      <span className="flex items-center gap-3 text-text-secondary">
        {/*
          Telephony legitimately reports no p95. Rendering NaN or "null" would
          be worse than an em-dash, so the absence is shown as absence.
        */}
        <span>{p.latencyP95Ms === null ? '—' : `${p.latencyP95Ms} ms`}</span>
        <span>{(p.errorRate * 100).toFixed(1)}% err</span>
      </span>
    </li>
  );
}

export function OpsDigest() {
  const fetcher = useCallback(
    () => agentApi.opsSnapshot() as Promise<OpsSnapshot & { providerHealth?: ProviderHealth[] }>,
    [],
  );
  // 15s: fast enough that a fresh P1 appears without a manual refresh, slow
  // enough that a laptop waking from sleep does not stampede the server.
  const { state, refresh } = useAgentResource(fetcher, [], { pollMs: 15_000 });

  return (
    <AgentResource state={state} onRetry={refresh}>
      {(snap) => {
        const p2 = Object.entries(snap.p2Grouped).flatMap(([rule, list]) =>
          list.map((a) => ({ ...a, rule: a.rule || rule })),
        );
        return (
          <div className="space-y-4">
            {!snap.reachable && (
              <div
                className="rounded-[--radius] border border-danger/30 bg-danger/5 p-3 text-sm"
                role="alert"
              >
                The agent is not reachable. Figures below may be stale.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Calls" value={snap.callCount} />
              <Stat label="Contained" value={`${snap.containedPct}%`} />
              <Stat label="P3" value={snap.p3Count} />
              <Stat
                label="Window"
                value={new Date(snap.since).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
            </div>

            <AgentCard title={`Needs you now (${snap.p1.length})`}>
              {snap.p1.length ? (
                <ul>
                  {snap.p1.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </ul>
              ) : (
                <AgentEmpty label="Nothing needs you right now" />
              )}
            </AgentCard>

            <AgentCard title={`Worth knowing (${p2.length})`}>
              {p2.length ? (
                <ul>
                  {p2.map((a) => (
                    <AlertRow key={a.id} alert={a} />
                  ))}
                </ul>
              ) : (
                <AgentEmpty label="No warnings" />
              )}
            </AgentCard>

            {snap.providerHealth && snap.providerHealth.length > 0 && (
              <AgentCard title="Providers">
                <ul>
                  {snap.providerHealth.map((p) => (
                    <ProviderRow key={`${p.provider}-${p.role}`} p={p} />
                  ))}
                </ul>
              </AgentCard>
            )}
          </div>
        );
      }}
    </AgentResource>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[--radius] border border-border-primary bg-bg-secondary p-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}

export { AgentSkeleton };
