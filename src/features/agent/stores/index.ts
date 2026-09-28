import { useMemo } from 'react';
import { create } from 'zustand';
import type { CallListItem, CallOutcome, OpsAlert, ProviderHealth, WsStatus } from '../types/commands';

/**
 * Store split for the agent console — one store per domain, per
 * `docs/voice/design/FRONTEND.md` §12.3. Components subscribe to the selectors
 * below, never to a whole store.
 *
 * ── THE ONE RULE ───────────────────────────────────────────────────────────
 * **A derived array belongs in `useMemo`, never inside a store selector.**
 *
 * A selector that calls `.filter()` returns a new array identity on every
 * invocation, and `useSyncExternalStore` re-renders forever on a changed
 * identity — React error #185, "Maximum update depth exceeded". It is invisible
 * until a navigation path actually reaches the screen, which is exactly how it
 * survived in the prototype: the drill-down was the first thing that ever
 * rendered this list.
 *
 * So: select PRIMITIVES, memoise the derived array. `useFilteredCalls` below is
 * the reference implementation.
 */

// ── 1. Call list ────────────────────────────────────────────────────────────

export interface CallFilter {
  range: '7d' | '30d' | 'all';
  outcome: 'all' | CallOutcome;
  flaggedOnly: boolean;
  /** Alert drill-down, e.g. "show me the 6 transfer failures". Null = no filter. */
  drill: { label: string; ids: string[] } | null;
}

interface CallListState extends CallFilter {
  rows: CallListItem[];
  selectedId: string | null;
  setRange: (r: CallFilter['range']) => void;
  setOutcome: (o: CallFilter['outcome']) => void;
  toggleFlagged: () => void;
  select: (id: string | null) => void;
  setDrill: (d: CallFilter['drill']) => void;
  clearDrill: () => void;
  setRows: (rows: CallListItem[]) => void;
}

export const useCallListStore = create<CallListState>((set) => ({
  rows: [],
  range: '30d',
  outcome: 'all',
  flaggedOnly: false,
  drill: null,
  selectedId: null,
  setRange: (range) => set({ range }),
  setOutcome: (outcome) => set({ outcome }),
  toggleFlagged: () => set((s) => ({ flaggedOnly: !s.flaggedOnly })),
  select: (selectedId) => set({ selectedId }),
  setDrill: (drill) => set({ drill }),
  clearDrill: () => set({ drill: null }),
  setRows: (rows) => set({ rows }),
}));

/** REFERENCE IMPLEMENTATION of the rule above. Read this before adding a filter. */
export const useFilteredCalls = (): CallListItem[] => {
  const rows = useCallListStore((s) => s.rows);
  const outcome = useCallListStore((s) => s.outcome);
  const flaggedOnly = useCallListStore((s) => s.flaggedOnly);
  // `.ids` is a stable reference while the drill is unchanged; selecting the
  // array itself would be fine too, but selecting the object and depending on
  // its identity is what lets `clearDrill` actually change the result.
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

// ── 2. Live call ────────────────────────────────────────────────────────────

/**
 * WS lifecycle, from `FRONTEND.md` §12.4. A silently dead transcript is
 * indistinguishable from a caller who stopped talking, so every state is
 * observable and none of them renders as an empty or stale list.
 */
export type { WsStatus };

interface LiveState {
  callId: string | null;
  elapsedSec: number;
  wsStatus: WsStatus;
  lastDeltaAt: string | null;
  reconnectAttempt: number;
  /** Set when the transcript is displayed but the socket is not live. */
  showingDataFrom: string | null;
  setWs: (status: WsStatus, attempt?: number) => void;
  markStale: (lastGoodAt: string) => void;
  tick: () => void;
  endCall: () => void;
}

export const useLiveCallStore = create<LiveState>((set) => ({
  callId: null,
  elapsedSec: 0,
  wsStatus: 'idle',
  lastDeltaAt: null,
  reconnectAttempt: 0,
  showingDataFrom: null,
  setWs: (wsStatus, reconnectAttempt = 0) => set({ wsStatus, reconnectAttempt }),
  markStale: (lastGoodAt) => set({ showingDataFrom: lastGoodAt }),
  tick: () => set((s) => (s.callId ? { elapsedSec: s.elapsedSec + 1 } : {})),
  endCall: () => set({ callId: null, wsStatus: 'idle', showingDataFrom: null }),
}));

// ── 3. Ops ──────────────────────────────────────────────────────────────────

interface OpsState {
  p1: OpsAlert[];
  p2Grouped: Record<string, OpsAlert[]>;
  p3Count: number;
  callCount: number;
  containedPct: number;
  providerHealth: ProviderHealth[];
  /** Read by EVERY surface from this one store. A per-component online check is
   *  how two surfaces end up disagreeing about the truth. */
  reachable: boolean;
  lastSeenAt: string | null;
  acknowledge: (id: string) => void;
  setSnapshot: (s: Partial<OpsState>) => void;
  setReachable: (v: boolean) => void;
}

const acknowledgeIn = <T extends { id: string; acknowledgedAt: string | null }>(
  list: T[],
  id: string,
  at: string,
): T[] => list.map((a) => (a.id === id ? { ...a, acknowledgedAt: at, acknowledgedBy: 'operator' } : a));

export const useOpsStore = create<OpsState>((set) => ({
  p1: [],
  p2Grouped: {},
  p3Count: 0,
  callCount: 0,
  containedPct: 0,
  providerHealth: [],
  reachable: true,
  lastSeenAt: null,
  acknowledge: (id) =>
    set((s) => {
      const at = new Date().toISOString();
      return {
        p1: acknowledgeIn(s.p1, id, at),
        p2Grouped: Object.fromEntries(
          Object.entries(s.p2Grouped).map(([k, v]) => [k, acknowledgeIn(v, id, at)]),
        ),
      };
    }),
  setSnapshot: (patch) => set(patch),
  setReachable: (reachable) => set({ reachable }),
}));

export const useReachable = () => useOpsStore((s) => s.reachable);

/**
 * Badge count for the console nav. **P1 only.** Everything else waits for the
 * digest (`UX.md` §8); a badge carrying P2 and P3 becomes noise, and noise is the
 * failure mode that teaches an operator to ignore the badge entirely.
 */
export const useUnacknowledgedP1 = (): number =>
  useOpsStore((s) => s.p1.filter((a) => !a.acknowledgedAt).length);

// ── 4. Config ───────────────────────────────────────────────────────────────

export type ConfigDraft = {
  voiceFr: string;
  voiceEn: string;
  hours: string;
  tz: string;
  transferTarget: string;
  afterHours: 'take_message' | 'transfer' | 'announce_only';
  tier: 'standard' | 'selfhosted' | 'premium';
  disclosureEnabled: boolean;
};

const CONFIG_DEFAULTS: ConfigDraft = {
  voiceFr: 'siwis-medium',
  voiceEn: 'matilda',
  hours: 'Mon–Fri 09:00–18:00',
  tz: 'Europe/Paris',
  transferTarget: '',
  afterHours: 'take_message',
  tier: 'standard',
  disclosureEnabled: true,
};

interface ConfigState extends ConfigDraft {
  /** True once the tenant is actually answering inbound calls. Mirrors the
   *  `answering` column the `tenants` CHECK is written against. */
  answering: boolean;
  dirty: boolean;
  saving: boolean;
  set: <K extends keyof ConfigDraft>(k: K, v: ConfigDraft[K]) => void;
  save: () => Promise<void>;
  discard: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  ...CONFIG_DEFAULTS,
  answering: false,
  dirty: false,
  saving: false,
  set: (k, v) => set({ [k]: v, dirty: true } as Partial<ConfigState>),
  save: async () => {
    set({ saving: true });
    try {
      // Phase C wires this to agent_set_provider_tier. Until then the store is
      // the only writer, and `dirty` still clears so the path is exercised.
      set({ dirty: false });
    } finally {
      set({ saving: false });
    }
  },
  discard: () => set({ ...CONFIG_DEFAULTS, answering: false, dirty: false, saving: false }),
}));

/**
 * Reasons the console should surface before or during a config change. Selects
 * primitives and memoises, per the rule at the top of this file.
 *
 * - An in-hours agent with no transfer target drops callers silently
 *   (`CALL-FLOW.md` section 4). Same invariant the `tenants` CHECK enforces
 *   server-side, shown here so the operator sees it before the write.
 * - The AI disclosure line is spoken on 100% of calls (`PILOT-CRITERIA.md`), so
 *   switching it off fails a headline pilot criterion. Warned, not blocked: it is
 *   a legal requirement, and a console that quietly permits it is worse.
 */
export const useConfigBlockers = (): string[] => {
  const transferTarget = useConfigStore((s) => s.transferTarget);
  const disclosureEnabled = useConfigStore((s) => s.disclosureEnabled);
  const answering = useConfigStore((s) => s.answering);

  return useMemo(() => {
    const out: string[] = [];
    if (answering && !transferTarget.trim()) {
      out.push('An in-hours agent needs a transfer target, or callers are dropped silently.');
    }
    if (!disclosureEnabled) {
      out.push(
        'The AI disclosure line is spoken on 100% of calls - switching it off breaks a pilot criterion.',
      );
    }
    return out;
  }, [answering, transferTarget, disclosureEnabled]);
};
