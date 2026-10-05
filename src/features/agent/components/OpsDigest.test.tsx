import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OpsDigest } from './OpsDigest';
import { invokeCommand } from '@shared/services/db/invoke/command';

vi.mock('@shared/services/db/invoke/command', () => ({
  invokeCommand: vi.fn(),
}));

/**
 * Ops digest reads the snapshot from local SQLite via Tauri commands
 * (`agent_ops_snapshot`, `agent_provider_health`). No HTTP, no Python
 * sidecar — these tests mock `invokeCommand`, not the network.
 */

const SNAPSHOT = {
  generatedAt: '2026-10-04T10:00:00Z',
  since: '2026-10-04T09:00:00Z',
  p1: [
    {
      id: 'a_01',
      severity: 'P1',
      rule: 'queue-depth',
      oneLiner: 'Sync queue backing up',
      decision: 'Take 3 of these back yourself',
      evidence: { count: 12, firstAt: '09:00', lastAt: '09:55', blastRadius: 'mail sync' },
      acknowledgedAt: null,
      acknowledgedBy: null,
      thresholdIsProvisional: true,
    },
  ],
  p2Grouped: {},
  p3Count: 4,
  containedPct: 79,
  reachable: true,
  lastSeenAt: null,
};

describe('OpsDigest', () => {
  beforeEach(() => {
    vi.mocked(invokeCommand).mockImplementation(async (cmd: string) => {
      if (cmd === 'agent_ops_snapshot') return SNAPSHOT;
      if (cmd === 'agent_provider_health') return [];
      throw new Error(`unexpected command ${cmd}`);
    });
  });

  it('renders figures from the snapshot', async () => {
    render(<OpsDigest />);
    await waitFor(() => expect(screen.getByText('79%')).toBeDefined());
    expect(screen.getByText('4')).toBeDefined();
  });

  it('shows the decision on a P1, not just the headline', async () => {
    render(<OpsDigest />);
    const decision = await screen.findByTestId('decision-a_01');
    expect(decision.textContent).toContain('Take 3 of these back yourself');
  });

  it('marks a provisional threshold as provisional', async () => {
    render(<OpsDigest />);
    const note = await screen.findByTestId('provisional-a_01');
    expect(note.textContent).toMatch(/not yet agreed/i);
  });

  it('says "cannot reach" when the snapshot fetch fails to connect', async () => {
    vi.mocked(invokeCommand).mockRejectedValue(new Error('Connection refused'));
    render(<OpsDigest />);
    await waitFor(() => expect(screen.getByText('Cannot reach the agent')).toBeDefined());
  });
});
