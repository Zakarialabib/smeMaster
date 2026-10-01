import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AgentEmpty, AgentResource, AgentSkeleton } from './States';

/**
 * The four states must be VISUALLY AND SEMANTICALLY distinct.
 *
 * This is the file that stops the console from showing an empty table when the
 * server is down. The assertion that matters is not "it rendered" but "the three
 * failure-ish states say different things" — because the failure mode is a
 * generic error box that hides a dead server behind a 500-shaped message.
 */

const data = { rows: [1, 2, 3] };

describe('AgentResource — the four states', () => {
  it('loading shows a skeleton, not an empty table', () => {
    render(<AgentResource state={{ kind: 'loading' }}>{() => <p>DATA TABLE</p>}</AgentResource>);
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByLabelText('Loading')).toBeDefined();
    expect(screen.queryByText('DATA TABLE')).toBeNull();
  });

  it('ready renders the children with the data', () => {
    render(
      <AgentResource state={{ kind: 'ready', data }}>
        {(d) => <p>rows: {d.rows.length}</p>}
      </AgentResource>,
    );
    expect(screen.getByText('rows: 3')).toBeDefined();
  });

  it('unreachable says "cannot reach", and offers retry', async () => {
    const onRetry = vi.fn();
    render(
      <AgentResource
        state={{ kind: 'unreachable', message: 'connection refused' }}
        onRetry={onRetry}
      >
        {() => <p>DATA</p>}
      </AgentResource>,
    );
    // The wording is the feature: a dead server is not a failed request.
    expect(screen.getByText('Cannot reach the agent')).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('an API error says "the request failed" — a DIFFERENT screen', () => {
    render(
      <AgentResource
        state={{ kind: 'error', message: 'forbidden', code: 'x', retryable: false }}
        onRetry={() => {}}
      >
        {() => <p>DATA</p>}
      </AgentResource>,
    );
    expect(screen.getByText('The request failed')).toBeDefined();
    expect(screen.queryByText('Cannot reach the agent')).toBeNull();
  });

  it('a NON-retryable error offers no retry button', () => {
    // Offering retry on a 403 teaches the user the button is broken.
    render(
      <AgentResource
        state={{ kind: 'error', message: 'forbidden', code: 'x', retryable: false }}
        onRetry={() => {}}
      >
        {() => <p>DATA</p>}
      </AgentResource>,
    );
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('a retryable error DOES offer retry', () => {
    render(
      <AgentResource
        state={{ kind: 'error', message: 'boom', code: 'x', retryable: true }}
        onRetry={() => {}}
      >
        {() => <p>DATA</p>}
      </AgentResource>,
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('ready-but-empty is the EMPTY state, not the error state', () => {
    // The distinction that costs real time when missed: "no calls" and "the
    // server is down" must never look the same.
    render(
      <AgentResource
        state={{ kind: 'ready', data: { rows: [] } }}
        isEmpty={(d) => d.rows.length === 0}
        empty={<p>No calls today</p>}
      >
        {() => <p>DATA TABLE</p>}
      </AgentResource>,
    );
    expect(screen.getByText('No calls today')).toBeDefined();
    expect(screen.queryByText('DATA TABLE')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('children is only ever called with ready data', () => {
    // TypeScript enforces this; the runtime assertion documents it.
    const child = vi.fn(() => <p>ok</p>);
    render(<AgentResource state={{ kind: 'ready', data }}>{child}</AgentResource>);
    expect(child).toHaveBeenCalledWith(data);
  });
});

describe('AgentSkeleton / AgentEmpty', () => {
  it('skeleton renders the requested number of rows', () => {
    const { container } = render(<AgentSkeleton rows={5} />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });

  it('empty takes a custom label', () => {
    render(<AgentEmpty label="No alerts" />);
    expect(screen.getByText('No alerts')).toBeDefined();
  });
});
