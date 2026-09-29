import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentClientError } from './client';

/**
 * The four states every data-backed console surface needs.
 *
 * The prototype had one — data present. The product needs all four, and the
 * distinction that matters is between "loaded and empty" and "could not load":
 *
 *   loading     first fetch in flight; show a skeleton, NOT an empty table
 *   ready       data arrived, possibly empty
 *   unreachable the server could not be reached at all  (VPS off, wrong port)
 *   error       the server answered, and the answer was a failure
 *
 * `unreachable` and `error` are separate on purpose. "Cannot reach the agent"
 * and "the request failed" are different screens with different advice, and
 * collapsing them into one `error` is how a user ends up refreshing a page
 * whose problem is that the server is down.
 *
 * Deliberately NOT a zustand store. Fetch state is per-component and dies with
 * it; putting it in a global store means one component's retry silently resets
 * another's loading flag, and "is the Ops page loading" becomes unanswerable.
 */
export type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'unreachable'; message: string }
  | { kind: 'error'; message: string; code: string; retryable: boolean };

export interface UseAgentResourceOptions {
  /** Poll interval in ms. 0 disables polling. */
  pollMs?: number;
  /** Skip fetching entirely (e.g. no session yet). */
  enabled?: boolean;
}

/**
 * Fetch a resource, with the four states above.
 *
 * Two details that are easy to get wrong and expensive to debug later:
 *
 * 1. **A stale response never overwrites a newer one.** Requests are not
 *    cancelled, so a slow first request can resolve after a fast second one and
 *    silently revert the screen. A monotonic request id discards it.
 * 2. **Polling does not stack.** An interval that fires while the previous
 *    request is in flight produces overlapping requests that arrive out of
 *    order — the same bug, self-inflicted, forever.
 */
export function useAgentResource<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  options: UseAgentResourceOptions = {},
): {
  state: LoadState<T>;
  refresh: () => void;
} {
  const { pollMs = 0, enabled = true } = options;

  const [state, setState] = useState<LoadState<T>>({ kind: 'loading' });
  const [nonce, setNonce] = useState(0);

  // Bumping this invalidates every in-flight response.
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async (opts: { fromPoll: boolean }): Promise<void> => {
      // A POLL tick must never stack on an in-flight request — that is how
      // out-of-order arrivals happen without anyone asking for them.
      //
      // A request caused by a real change (new deps, manual refresh) is
      // different: it MUST start even if something is in flight, because it
      // supersedes it. Skipping it was a real bug — the superseded response is
      // then correctly discarded as stale, leaving the screen stuck on
      // 'loading' forever with no request of its own in flight.
      if (opts.fromPoll && inFlight.current) return;
      inFlight.current = true;

      const id = ++requestId.current;
      try {
        const data = await fetcher();
        // A response from a superseded request is dropped, not applied.
        if (cancelled || id !== requestId.current || !mounted.current) return;
        setState({ kind: 'ready', data });
      } catch (e) {
        if (cancelled || id !== requestId.current || !mounted.current) return;
        if (e instanceof AgentClientError) {
          setState(
            e.isUnreachable
              ? { kind: 'unreachable', message: e.message }
              : { kind: 'error', message: e.message, code: e.code, retryable: e.retryable },
          );
        } else {
          setState({
            kind: 'error',
            message: (e as Error).message,
            code: 'unknown',
            retryable: true,
          });
        }
      } finally {
        // Only the CURRENT request may clear the flag. A superseded request
        // finishing later must not unblock polling while the real one is still
        // running.
        if (id === requestId.current) inFlight.current = false;
      }
    };

    void run({ fromPoll: false });

    if (pollMs > 0) {
      const t = setInterval(() => void run({ fromPoll: true }), pollMs);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled, pollMs]);

  return { state, refresh };
}

/** Convenience: is this state showing a skeleton? */
export const isLoading = <T,>(s: LoadState<T>): boolean => s.kind === 'loading';

/** Convenience: is this state a "cannot reach the agent" screen? */
export const isUnreachable = <T,>(s: LoadState<T>): boolean => s.kind === 'unreachable';

/**
 * The value, or a safe default while loading/failed.
 *
 * Returning a default rather than throwing is deliberate: a component that
 * forgets to handle `unreachable` should render zeros, not crash the app.
 */
export function dataOr<T>(s: LoadState<T>, fallback: T): T {
  return s.kind === 'ready' ? s.data : fallback;
}
