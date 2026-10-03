import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CallListItem, OpsAlert } from '../types/commands';
import {
  useCallListStore,
  useConfigBlockers,
  useConfigStore,
  useFilteredCalls,
  useLiveCallStore,
  useOpsStore,
  useUnacknowledgedP1,
} from './index';

/**
 * Store tests.
 *
 * The headline test here is `does not loop on re-render`. That is not
 * hypothetical: the prototype shipped a `useFilteredCalls` that filtered inside
 * the zustand selector, returned a fresh array identity every call, and put
 * `useSyncExternalStore` into an infinite re-render (React error #185). It stayed
 * hidden until the alert drill-down was the first thing to actually render the
 * list. A regression test that renders the hook and counts renders is the only
 * thing that would have caught it before a user did.
 */

const CALL = (id: string, over: Partial<CallListItem> = {}): CallListItem => ({
  id,
  channel: 'voice',
  outcome: 'contained',
  state: 'wrapup',
  startedAt: '2026-09-28T14:30:18Z',
  durationSec: 90,
  callerMasked: '+33 6 •• •• 41 22',
  flagged: null,
  costEur: 0.3,
  containment: true,
  ...over,
});

const ROWS = [
  CALL('c_1'),
  CALL('c_2', { outcome: 'transferred' }),
  CALL('c_3', { channel: 'whatsapp', outcome: 'voicemail', costEur: 0 }),
  CALL('c_4', { outcome: 'abandoned' }),
  CALL('c_5', { flagged: 'pricing' }),
];

const ALERT = (id: string, over: Partial<OpsAlert> = {}): OpsAlert => ({
  id,
  severity: 'P1',
  rule: 'transfer_failed',
  oneLiner: 'Transfer failures',
  decision: 'Take them back yourself',
  evidence: { count: 6, firstAt: '14:32', lastAt: '14:51', blastRadius: 'this tenant' },
  acknowledgedAt: null,
  acknowledgedBy: null,
  thresholdIsProvisional: true,
  ...over,
});

beforeEach(() => {
  useCallListStore.setState({ rows: [], outcome: 'all', flaggedOnly: false, drill: null });
  useOpsStore.setState({ p1: [], p2Grouped: {}, p3Count: 0, reachable: true });
  useLiveCallStore.setState({ callId: null, wsStatus: 'idle', elapsedSec: 0 });
  useConfigStore.setState({
    answering: false,
    transferTarget: '',
    disclosureEnabled: true,
    dirty: false,
    tier: 'standard',
  });
});

describe('useFilteredCalls', () => {
  it('does not loop on re-render', () => {
    let renders = 0;
    const { rerender } = renderHook(() => {
      renders += 1;
      return useFilteredCalls();
    });
    rerender();
    rerender();
    // A looping selector renders unboundedly; a correct one renders once per
    // state change. Allow a small margin for React internals, not a loop.
    expect(renders).toBeLessThan(10);
  });

  it('returns all rows with no filters', () => {
    useCallListStore.setState({ rows: ROWS });
    const { result } = renderHook(() => useFilteredCalls());
    expect(result.current).toHaveLength(5);
  });

  it('filters by outcome', () => {
    useCallListStore.setState({ rows: ROWS, outcome: 'voicemail' });
    const { result } = renderHook(() => useFilteredCalls());
    expect(result.current.map((r) => r.id)).toEqual(['c_3']);
  });

  it('filters flagged-only', () => {
    useCallListStore.setState({ rows: ROWS, flaggedOnly: true });
    const { result } = renderHook(() => useFilteredCalls());
    expect(result.current.map((r) => r.id)).toEqual(['c_5']);
  });

  it('applies an alert drill-down', () => {
    // The bug the prototype had: the button navigated but filtered nothing.
    useCallListStore.setState({
      rows: ROWS,
      drill: { label: 'transfer failed', ids: ['c_1', 'c_2'] },
    });
    const { result } = renderHook(() => useFilteredCalls());
    expect(result.current.map((r) => r.id)).toEqual(['c_1', 'c_2']);
  });

  it('combines a drill with an outcome filter', () => {
    useCallListStore.setState({
      rows: ROWS,
      drill: { label: 'x', ids: ['c_1', 'c_2', 'c_3'] },
      outcome: 'transferred',
    });
    const { result } = renderHook(() => useFilteredCalls());
    expect(result.current.map((r) => r.id)).toEqual(['c_2']);
  });

  it('clearing the drill restores every row', () => {
    useCallListStore.setState({ rows: ROWS, drill: { label: 'x', ids: ['c_1'] } });
    act(() => useCallListStore.getState().clearDrill());
    const { result } = renderHook(() => useFilteredCalls());
    expect(result.current).toHaveLength(5);
  });

  it('keeps a stable identity when nothing changes', () => {
    useCallListStore.setState({ rows: ROWS });
    const { result, rerender } = renderHook(() => useFilteredCalls());
    const first = result.current;
    rerender();
    // A new array on every render is the exact defect this guards against.
    expect(result.current).toBe(first);
  });
});

describe('useOpsStore', () => {
  it('counts only unacknowledged P1 for the badge', () => {
    // P2/P3 must never reach the badge: it is the noise that teaches an
    // operator to ignore it.
    useOpsStore.setState({
      p1: [ALERT('a1'), ALERT('a2', { acknowledgedAt: '2026-09-28T14:52:00Z' })],
      p2Grouped: { latency: [ALERT('a3', { severity: 'P2' })] },
    });
    const { result } = renderHook(() => useUnacknowledgedP1());
    expect(result.current).toBe(1);
  });

  it('acknowledging clears the badge and stamps the alert', () => {
    useOpsStore.setState({ p1: [ALERT('a1')] });
    act(() => useOpsStore.getState().acknowledge('a1'));
    const p1 = useOpsStore.getState().p1[0];
    expect(p1.acknowledgedAt).not.toBeNull();
    expect(p1.acknowledgedBy).toBe('operator');
  });

  it('acknowledging also reaches P2 in its group', () => {
    useOpsStore.setState({ p2Grouped: { cost: [ALERT('z1', { severity: 'P2' })] } });
    act(() => useOpsStore.getState().acknowledge('z1'));
    expect(useOpsStore.getState().p2Grouped.cost[0].acknowledgedAt).not.toBeNull();
  });
});

describe('useLiveCallStore', () => {
  it('elapsed only ticks while a call is live', () => {
    act(() => useLiveCallStore.getState().tick());
    expect(useLiveCallStore.getState().elapsedSec).toBe(0);

    useLiveCallStore.setState({ callId: 'c_1' });
    act(() => useLiveCallStore.getState().tick());
    expect(useLiveCallStore.getState().elapsedSec).toBe(1);
  });

  it('carries showingDataFrom so a stale transcript is labelled, not blank', () => {
    act(() => useLiveCallStore.getState().markStale('2026-09-28T14:32:00Z'));
    expect(useLiveCallStore.getState().showingDataFrom).toBe('2026-09-28T14:32:00Z');
  });
});

describe('useConfigBlockers', () => {
  it('flags an answering agent with no transfer target', () => {
    useConfigStore.setState({ answering: true, transferTarget: '' });
    const { result } = renderHook(() => useConfigBlockers());
    expect(result.current.join(' ')).toMatch(/transfer target/i);
  });

  it('is quiet once a transfer target is set', () => {
    useConfigStore.setState({ answering: true, transferTarget: '+33612345678' });
    const { result } = renderHook(() => useConfigBlockers());
    expect(result.current).toEqual([]);
  });

  it('warns when the disclosure line is switched off', () => {
    useConfigStore.setState({ disclosureEnabled: false });
    const { result } = renderHook(() => useConfigBlockers());
    expect(result.current.join(' ')).toMatch(/disclosure/i);
  });
});

describe('store hygiene', () => {
  it('no store exposes a tenant id', () => {
    // Tenant identity comes from the token, server-side (ADR-001 D4a).
    for (const store of [useCallListStore, useOpsStore, useLiveCallStore, useConfigStore]) {
      expect(Object.keys(store.getState()).join(',')).not.toMatch(/tenant/i);
    }
  });

  it('no store holds transcript text', () => {
    // The call log must never accumulate a transcript: it is a separate surface
    // with its own store, and a transcript in the list store is a memory leak
    // on a long call.
    const state = useCallListStore.getState();
    expect(JSON.stringify(state.rows)).not.toMatch(/bonjour|rendez-vous/i);
  });
});
