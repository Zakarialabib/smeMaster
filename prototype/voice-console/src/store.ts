import { useMemo } from 'react';
import { create } from 'zustand';
import type { CallListItem, OpsAlert, WsStatus } from './types';
import { CALLS, P1_ALERT, P2_ALERTS, SNAPSHOT } from './data';

/**
 * One store per domain, per FRONTEND.md §12.3. Components subscribe to the
 * selectors below, never to a whole store.
 *
 * `reachable` is read by EVERY surface from opsStore, not just the digest —
 * a per-component online check is how two surfaces disagree about the truth.
 */
export type Route = 'calls' | 'live' | 'ops' | 'alerts' | 'alert' | 'config' | 'knowledge' | 'cost' | 'topology' | 'settings';

interface CallListState {
  rows: CallListItem[];
  range: '7d' | '30d' | 'all';
  outcome: 'all' | CallListItem['outcome'];
  flaggedOnly: boolean;
  selectedId: string | null;
  /** Alert drill-down, e.g. "show me the 6 transfer failures". Null = no filter. */
  drill: { label: string; ids: string[] } | null;
  setRange: (r: CallListState['range']) => void;
  setOutcome: (o: CallListState['outcome']) => void;
  toggleFlagged: () => void;
  select: (id: string | null) => void;
  setDrill: (d: CallListState['drill']) => void;
  clearDrill: () => void;
}

export const useCallListStore = create<CallListState>((set) => ({
  rows: CALLS,
  range: '30d',
  outcome: 'all',
  flaggedOnly: false,
  selectedId: 'c_01',
  drill: null,
  setRange: (range) => set({ range }),
  setOutcome: (outcome) => set({ outcome }),
  toggleFlagged: () => set((s) => ({ flaggedOnly: !s.flaggedOnly })),
  select: (selectedId) => set({ selectedId }),
  setDrill: (drill) => set({ drill }),
  clearDrill: () => set({ drill: null }),
}));

/**
 * Filtered rows.
 *
 * The filter is done in a useMemo over primitive selector results rather than
 * inside the zustand selector: a selector that builds a new array on every call
 * re-renders forever under useSyncExternalStore (React error #185).
 */
export const useFilteredCalls = () => {
  const rows = useCallListStore((s) => s.rows);
  const outcome = useCallListStore((s) => s.outcome);
  const flaggedOnly = useCallListStore((s) => s.flaggedOnly);
  const drillIds = useCallListStore((s) => s.drill?.ids);

  return useMemo(
    () =>
      rows.filter(
        (r) =>
          (drillIds === undefined || drillIds.includes(r.id)) &&
          (outcome === 'all' || r.outcome === outcome) &&
          (!flaggedOnly || r.flagged !== null),
      ),
    [rows, outcome, flaggedOnly, drillIds],
  );
};

interface LiveState {
  callId: string | null;
  elapsedSec: number;
  wsStatus: WsStatus;
  lastDeltaAt: string | null;
  reconnectAttempt: number;
  setWs: (status: WsStatus, attempt?: number) => void;
  tick: () => void;
}

export const useLiveCallStore = create<LiveState>((set) => ({
  callId: 'c_01',
  elapsedSec: 134,
  wsStatus: 'connected',
  lastDeltaAt: '2026-09-28T14:31:52Z',
  reconnectAttempt: 0,
  setWs: (wsStatus, reconnectAttempt = 0) => set({ wsStatus, reconnectAttempt }),
  tick: () => set((s) => (s.callId ? { elapsedSec: s.elapsedSec + 1 } : {})),
}));

interface OpsState {
  p1: OpsAlert[];
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  reachable: boolean;
  lastSeenAt: string | null;
  providerHealth: typeof SNAPSHOT.providerHealth;
  acknowledge: (id: string) => void;
  setReachable: (v: boolean) => void;
}

export const useOpsStore = create<OpsState>((set) => ({
  p1: [P1_ALERT],
  p2Grouped: SNAPSHOT.p2Grouped,
  p3Count: SNAPSHOT.p3Count,
  callCount: SNAPSHOT.callCount,
  containedPct: SNAPSHOT.containedPct,
  reachable: true,
  lastSeenAt: SNAPSHOT.lastSeenAt,
  providerHealth: SNAPSHOT.providerHealth,
  acknowledge: (id) =>
    set((s) => ({
      p1: s.p1.map((a) =>
        a.id === id ? { ...a, acknowledgedAt: '2026-09-28T14:52:00Z', acknowledgedBy: 'operator' } : a,
      ),
      p2Grouped: Object.fromEntries(
        Object.entries(s.p2Grouped).map(([k, list]) => [
          k,
          list.map((a) =>
            a.id === id ? { ...a, acknowledgedAt: '2026-09-28T14:52:00Z', acknowledgedBy: 'operator' } : a,
          ),
        ]),
      ),
    })),
  setReachable: (reachable) => set({ reachable }),
}));

/** Read by every surface. One source of the offline truth. */
export const useReachable = () => useOpsStore((s) => s.reachable);

interface ConfigState {
  voiceFr: string;
  voiceEn: string;
  hours: string;
  tz: string;
  transferTarget: string;
  afterHours: 'take_message' | 'transfer' | 'announce_only';
  tier: 'standard' | 'selfhosted' | 'premium';
  disclosureEnabled: boolean;
  dirty: boolean;
  set: <K extends keyof ConfigState>(k: K, v: ConfigState[K]) => void;
  save: () => void;
  discard: () => void;
}

const CONFIG_DEFAULTS = {
  voiceFr: 'siwis-medium',
  voiceEn: 'matilda',
  hours: 'Mon–Fri 09:00–18:00',
  tz: 'Europe/Paris',
  transferTarget: '+33 6 •• •• 41 22',
  afterHours: 'take_message' as const,
  tier: 'standard' as const,
  disclosureEnabled: true,
};

export const useConfigStore = create<ConfigState>((set) => ({
  ...CONFIG_DEFAULTS,
  dirty: false,
  set: (k, v) => set({ [k]: v, dirty: true } as Partial<ConfigState>),
  save: () => set({ dirty: false }),
  discard: () => set({ ...CONFIG_DEFAULTS, dirty: false }),
}));

export const useKnowledgeStore = create<{
  scope: Record<string, boolean>;
  publishing: boolean;
  ingest: 'idle' | 'running' | 'failed';
  toggle: (k: string) => void;
  publish: () => void;
  fail: () => void;
  reset: () => void;
}>((set) => ({
  scope: { services: true, hours: true, pricing: true, rules: true, mail: false, contacts: false },
  publishing: false,
  ingest: 'idle',
  toggle: (k) => set((s) => ({ scope: { ...s.scope, [k]: !s.scope[k] } })),
  publish: () => set({ publishing: true }),
  fail: () => set({ publishing: false, ingest: 'failed' }),
  reset: () => set({ publishing: false, ingest: 'idle' }),
}));

interface UiState {
  route: Route;
  alertId: string | null;
  toast: string | null;
  go: (r: Route) => void;
  openAlert: (id: string) => void;
  notify: (msg: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  route: 'ops',
  alertId: null,
  toast: null,
  go: (route) => set({ route }),
  openAlert: (alertId) => set({ alertId, route: 'alert' }),
  notify: (toast) => set({ toast }),
}));

export const useUnacknowledgedCount = () =>
  useOpsStore((s) => s.p1.filter((a) => !a.acknowledgedAt).length + P2_UNACK(s));

function P2_UNACK(s: OpsState): number {
  return Object.values(s.p2Grouped)
    .flat()
    .filter((a) => !a.acknowledgedAt).length;
}

export const ALL_ALERTS = () => [P1_ALERT, ...P2_ALERTS];
