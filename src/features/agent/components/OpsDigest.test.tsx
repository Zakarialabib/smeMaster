import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { __setBaseUrlForTests } from '../api/client';
import { OpsDigest } from './OpsDigest';

/**
 * The Ops digest against a LIVE agent-core.
 *
 * Not a mock. The point of this screen is that it renders whatever the server
 * actually sends, and a mocked fetch would render whatever the test author
 * believed the server sends — which is the exact gap that let the
 * `SessionRequest` camelCase bug hide for so long.
 *
 * Skipped (visibly) when no server is running, so CI without agent-core does
 * not report a false failure.
 */

const BASE = 'http://127.0.0.1:8788';

async function reachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

const live = await reachable();

afterEach(() => __setBaseUrlForTests(null));

describe.skipIf(!live)('OpsDigest against a live agent-core', () => {
  beforeAll(() => __setBaseUrlForTests(BASE));

  it('renders figures from the real snapshot', async () => {
    render(<OpsDigest />);
    // A skeleton first — the screen must not flash an empty table.
    expect(screen.getByLabelText('Loading')).toBeDefined();

    await waitFor(() => expect(screen.getByText('Calls')).toBeDefined(), { timeout: 20_000 });
    // 128 is the live fixture's callCount; if the server changed, this fails
    // loudly rather than silently rendering whatever arrived.
    expect(screen.getByText('128')).toBeDefined();
    expect(screen.getByText('79%')).toBeDefined();
  }, 25_000);

  it('shows the decision on a P1, not just the headline', async () => {
    render(<OpsDigest />);
    // 20s: each of these renders triggers a REAL fetch against a dev server
    // that is also serving other tests. The 5s default is not the thing being
    // tested, and a timeout here hides whether the assertion is even right.
    const decision = await screen.findByTestId('decision-a_01', {}, { timeout: 20_000 });
    // "Take 3 of these back yourself" — an alert without a decision is a log line.
    expect(decision.textContent).toContain('Take 3 of these back yourself');
  }, 25_000);

  it('marks a provisional threshold as provisional', async () => {
    render(<OpsDigest />);
    // Without this the console presents a number nobody agreed on as a limit.
    const note = await screen.findByTestId('provisional-a_01', {}, { timeout: 20_000 });
    expect(note.textContent).toMatch(/not yet agreed/i);
  }, 25_000);
});

describe('OpsDigest when the server is unreachable', () => {
  it('says "cannot reach" and does not show figures', async () => {
    // Port 1 refuses immediately. This is the screen-level proof that a dead
    // server is never mistaken for a quiet day.
    __setBaseUrlForTests('http://127.0.0.1:1');
    render(<OpsDigest />);
    await waitFor(() => expect(screen.getByText('Cannot reach the agent')).toBeDefined(), {
      timeout: 10_000,
    });
    expect(screen.queryByText('Calls')).toBeNull();
  });
});
