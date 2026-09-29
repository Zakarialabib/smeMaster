import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentClientError } from './client';
import { dataOr, isLoading, isUnreachable, useAgentResource } from './useAgentResource';

/**
 * The four states, and the two concurrency bugs that make a data hook wrong in
 * ways nobody notices until production.
 *
 * A deferred-promise helper is used rather than fake timers, because the bugs
 * here are about ORDER OF RESOLUTION, not about time. Timers cannot express
 * "the first request resolves second".
 */

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const unreachable = () => new AgentClientError(0, 'unreachable', 'connection refused', true);
const apiError = () => new AgentClientError(403, 'caller_override_not_allowed', 'no', false);

describe('useAgentResource', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

  it('starts loading, then ready', async () => {
    const { promise, resolve } = deferred<string>();
    const { result } = renderHook(() => useAgentResource(() => promise, []));

    expect(result.current.state.kind).toBe('loading');
    expect(isLoading(result.current.state)).toBe(true);

    await act(async () => {
      resolve('ok');
      await promise;
    });

    expect(result.current.state).toEqual({ kind: 'ready', data: 'ok' });
  });

  it('reports unreachable SEPARATELY from an API error', async () => {
    const { result, rerender } = renderHook(() =>
      useAgentResource(() => Promise.reject(unreachable()), []),
    );
    await waitFor(() => expect(result.current.state.kind).toBe('unreachable'));
    expect(isUnreachable(result.current.state)).toBe(true);

    // The distinction is the point: different screen, different advice.
    const s = result.current.state;
    if (s.kind !== 'unreachable') throw new Error('expected unreachable');
    expect(s.message).toContain('connection refused');

    rerender();
    const { result: r2 } = renderHook(() =>
      useAgentResource(() => Promise.reject(apiError()), []),
    );
    await waitFor(() => expect(r2.current.state.kind).toBe('error'));
    const e = r2.current.state;
    if (e.kind !== 'error') throw new Error('expected error');
    expect(e.code).toBe('caller_override_not_allowed');
    expect(e.retryable).toBe(false);
  });

  it('an EMPTY successful response is ready, not error', async () => {
    // "Loaded and there is nothing" and "it broke" are different states, and
    // conflating them makes an empty Ops digest look like a failure.
    const { result } = renderHook(() =>
      useAgentResource(() => Promise.resolve([] as string[]), []),
    );
    await waitFor(() => expect(result.current.state.kind).toBe('ready'));
    const s = result.current.state;
    if (s.kind !== 'ready') throw new Error('expected ready');
    expect(s.data).toEqual([]);
  });

  it('a non-AgentClientError still becomes a typed error, not a crash', async () => {
    const { result } = renderHook(() =>
      useAgentResource(() => Promise.reject(new Error('boom')), []),
    );
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    const s = result.current.state;
    if (s.kind !== 'error') throw new Error('expected error');
    expect(s.message).toBe('boom');
    expect(s.retryable).toBe(true);
  });

  it('a SLOW first request does not overwrite a FAST second one', async () => {
    // The bug this whole file exists for. Both requests are in flight; the first
    // resolves LAST. Without the request-id guard the screen shows stale data.
    const slow = deferred<string>();
    const fast = deferred<string>();
    const fetcher = vi
      .fn<[], Promise<string>>()
      .mockImplementationOnce(() => slow.promise)
      .mockImplementationOnce(() => fast.promise);

    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useAgentResource(fetcher, [n]),
      { initialProps: { n: 0 } },
    );

    // Trigger the second request.
    act(() => rerender({ n: 1 }));

    await act(async () => {
      fast.resolve('NEW');
      await fast.promise;
    });
    await waitFor(() =>
      expect(result.current.state).toEqual({ kind: 'ready', data: 'NEW' }),
    );

    // Now the stale one lands. It must be DISCARDED.
    await act(async () => {
      slow.resolve('STALE');
      await slow.promise;
    });
    expect(result.current.state).toEqual({ kind: 'ready', data: 'NEW' });
  });

  it('does not stack overlapping requests while polling', async () => {
    vi.useFakeTimers();
    let resolveAll: (v: string) => void = () => {};
    const fetcher = vi.fn(() => {
      const d = deferred<string>();
      resolveAll = d.resolve;
      return d.promise;
    });

    renderHook(() => useAgentResource(fetcher, [], { pollMs: 1000 }));

    await vi.advanceTimersByTimeAsync(10_000);
    // The first request is still in flight, so the ticks must NOT have queued
    // more. Exactly one.
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAll('done');
    });
    await vi.advanceTimersByTimeAsync(2000);
    // Now that it settled, polling resumes.
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not fetch while disabled, and starts once enabled', async () => {
    const fetcher = vi.fn(() => Promise.resolve('x'));
    const { rerender } = renderHook(
      ({ on }: { on: boolean }) => useAgentResource(fetcher, [], { enabled: on }),
      { initialProps: { on: false } },
    );
    expect(fetcher).not.toHaveBeenCalled();
    rerender({ on: true });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });

  it('unmount does not set state', async () => {
    const { promise, resolve } = deferred<string>();
    const { unmount } = renderHook(() => useAgentResource(() => promise, []));
    unmount();
    // Must not throw or warn about setting state after unmount.
    await act(async () => {
      resolve('late');
      await promise;
    });
  });
});

describe('dataOr', () => {
  it('returns the data when ready and the fallback otherwise', () => {
    expect(dataOr({ kind: 'ready', data: [1, 2] }, [])).toEqual([1, 2]);
    expect(dataOr({ kind: 'loading' }, [])).toEqual([]);
    expect(dataOr({ kind: 'unreachable', message: 'x' }, [])).toEqual([]);
    // A component that forgets to handle unreachable renders zeros, not a crash.
    expect(dataOr({ kind: 'error', message: 'x', code: 'y', retryable: true }, [])).toEqual([]);
  });
});
