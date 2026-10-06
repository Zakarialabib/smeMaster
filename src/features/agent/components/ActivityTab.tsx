/**
 * ActivityTab — every AI call the service made, with its cost and latency.
 *
 * Reads the `ai_activity` table (migration 034). One row per call, written by
 * `activityRecorder.ts` at the `callAi`/`streamAi` funnel — so this is a record
 * of what actually happened, not a projection of what should have.
 *
 * Two things this screen must get right:
 *
 * 1. **`agent_id` is nullable by design.** Calls made outside an agent (a direct
 *    RAG search, a settings connection test) are still AI calls worth seeing.
 *    The agent column renders an em-dash for those rather than dropping the row —
 *    filtering them out would hide real spend.
 *
 * 2. **Cost is i64 minor units (centimes).** It is formatted through the
 *    invoicing helpers, the same ones the ERP uses. Re-rolling currency math
 *    here would produce a second, subtly different answer to the same question.
 */

import { useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { BTN_BASE, BTN_GHOST } from '@shared/styles/ui-tokens';
import { formatMoney, formatDate } from '@features/invoicing/utils/format';
import { listActivity } from '@shared/services/db/invoke/agents';
import { useAgentResource } from '../api/useAgentResource';
import { AgentBadge, AgentCard, AgentEmpty, AgentResource } from '../components/States';

/** One row of `ai_activity`, snake_case (the Rust struct has no serde rename). */
interface AiActivityRow {
  id: string;
  agent_id: string | null;
  task: string | null;
  provider: string;
  model: string;
  outcome: string;
  detail: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  cost_minor: number;
  currency: string;
  latency_ms: number;
  guardrails: string;
  created_at: number;
}

const OUTCOME_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  ok: 'success',
  error: 'danger',
  denied: 'warning',
};

/** Rust stores guardrails as a JSON-array string. Parse tolerantly. */
function parseGuardrails(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function relativeTime(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  const delta = Math.floor(Date.now() / 1000) - unixSeconds;
  if (delta < 60) return 'just now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return formatDate(unixSeconds, 'short');
}

export function ActivityTab() {
  const [limit, setLimit] = useState(100);

  const { state, refresh } = useAgentResource<AiActivityRow[]>(
    () => listActivity(undefined, limit),
    [limit],
  );

  // Stable identity so the rollup memo below doesn't recompute every render.
  const rows = useMemo(() => (state.kind === 'ready' ? state.data : []), [state]);

  /**
   * Rollup over the VISIBLE window, not all time. Labelling it clearly matters:
   * a total that silently means "the last 100 calls" reads as "this month".
   */
  const totals = useMemo(() => {
    const cost = rows.reduce((sum, r) => sum + (r.cost_minor || 0), 0);
    const tokens = rows.reduce(
      (sum, r) => sum + (r.prompt_tokens || 0) + (r.completion_tokens || 0),
      0,
    );
    const failures = rows.filter((r) => r.outcome === 'error').length;
    // Currency is per-row; the rollup uses the first row's, which is correct for
    // a single-tenant install and honest enough to label.
    const currency = rows[0]?.currency ?? 'MAD';
    return { cost, tokens, failures, currency };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Rollup header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-text-tertiary">Cost (visible)</p>
            <p className="text-sm font-semibold text-text-primary">
              {formatMoney(totals.cost / 100, { currency: totals.currency })}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Tokens</p>
            <p className="text-sm font-semibold text-text-primary">
              {totals.tokens.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Calls</p>
            <p className="text-sm font-semibold text-text-primary">{rows.length}</p>
          </div>
          {totals.failures > 0 && (
            <div>
              <p className="text-xs text-text-tertiary">Failures</p>
              <p className="text-sm font-semibold text-danger">{totals.failures}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            Show
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="glass-select rounded-md px-2 py-1 text-xs text-text-primary"
            >
              {[50, 100, 250, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`${BTN_BASE} ${BTN_GHOST}`}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} aria-hidden /> Refresh
          </button>
        </div>
      </div>

      <AgentCard title="AI calls">
        <AgentResource
          state={state}
          onRetry={refresh}
          isEmpty={(data) => data.length === 0}
          empty={
            <AgentEmpty label="No AI calls recorded yet. Run an automation to see one here." />
          }
        >
          {(data) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-primary/60 text-start text-xs text-text-tertiary">
                    <th className="py-2 pe-3 text-start font-medium">When</th>
                    <th className="py-2 pe-3 text-start font-medium">Task</th>
                    <th className="py-2 pe-3 text-start font-medium">Provider / model</th>
                    <th className="py-2 pe-3 text-start font-medium">Outcome</th>
                    <th className="py-2 pe-3 text-end font-medium">Tokens</th>
                    <th className="py-2 pe-3 text-end font-medium">Cost</th>
                    <th className="py-2 pe-3 text-end font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-b border-border-primary/40 last:border-b-0">
                      <td
                        className="py-2 pe-3 text-text-secondary"
                        title={new Date(row.created_at * 1000).toLocaleString()}
                      >
                        {relativeTime(row.created_at)}
                      </td>
                      <td className="py-2 pe-3 text-text-primary">
                        {row.task || <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="py-2 pe-3">
                        <span className="text-text-primary">{row.provider}</span>
                        <span className="text-text-tertiary"> / {row.model || '—'}</span>
                        {/* Nullable agent: outside-agent calls are still calls. */}
                        {!row.agent_id && (
                          <span className="ms-2 text-xs text-text-tertiary">(no agent)</span>
                        )}
                      </td>
                      <td className="py-2 pe-3">
                        <AgentBadge tone={OUTCOME_TONE[row.outcome] ?? 'neutral'}>
                          {row.outcome}
                        </AgentBadge>
                        {row.detail && (
                          <span className="ms-2 text-xs text-text-tertiary" title={row.detail}>
                            {row.detail.slice(0, 40)}
                            {row.detail.length > 40 ? '…' : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pe-3 text-end tabular-nums text-text-secondary">
                        {(row.prompt_tokens + row.completion_tokens).toLocaleString('en-US')}
                      </td>
                      <td className="py-2 pe-3 text-end tabular-nums text-text-primary">
                        {row.cost_minor
                          ? formatMoney(row.cost_minor / 100, { currency: row.currency })
                          : '—'}
                      </td>
                      <td className="py-2 pe-3 text-end tabular-nums text-text-secondary">
                        {row.latency_ms ? `${row.latency_ms} ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Guardrail hits, when any fired. */}
              {data.some((r) => parseGuardrails(r.guardrails).length > 0) && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-medium text-text-tertiary">Guardrails fired</p>
                  {data
                    .filter((r) => parseGuardrails(r.guardrails).length > 0)
                    .slice(0, 5)
                    .map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-text-tertiary">{relativeTime(r.created_at)}</span>
                        {parseGuardrails(r.guardrails).map((g) => (
                          <AgentBadge key={g} tone="ai">
                            {g}
                          </AgentBadge>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </AgentResource>
      </AgentCard>

      {/* The honest footnote: this is the local record, not a billing statement. */}
      <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Activity size={12} aria-hidden />
        Cost is computed from provider rate cards at call time — a local estimate, not an invoice
        from the provider.
      </p>
    </div>
  );
}
