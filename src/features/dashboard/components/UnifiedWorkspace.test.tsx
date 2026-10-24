import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children?: React.ReactNode }) => (
    <a href={`#${to}`}>{children}</a>
  ),
}));

const THREADS = [
  {
    id: 't1',
    subject: 'Please review the Q3 proposal?',
    last_message_at: '2026-05-10T10:00:00',
    unread_count: 2,
    participant_count: 2,
  },
  {
    id: 't2',
    subject: 'Newsletter #42',
    last_message_at: '2026-05-11T10:00:00',
    unread_count: 0,
    participant_count: 1,
  },
  {
    id: 't3',
    subject: 'Invoice #1042 attached',
    last_message_at: '2026-05-09T10:00:00',
    unread_count: 1,
    participant_count: 1,
  },
];

const CONTACTS = [
  {
    id: 'c1',
    email: 'sara@acme.ma',
    display_name: 'Sara Douiri',
    company: 'Acme',
    tags: [],
    last_contacted_at: '2026-05-10',
  },
];

const TASKS = [
  { id: 'k1', title: 'Late report', priority: 'low', is_completed: 0, due_date: 1000 },
  { id: 'k2', title: 'Done thing', priority: 'low', is_completed: 1, due_date: null },
];

vi.mock('@shared/services/db/liveQueries', () => ({
  useLiveThreads: vi.fn(() => ({ data: THREADS, isLoading: false, error: null, refresh: vi.fn() })),
  useLiveContacts: vi.fn(() => ({
    data: CONTACTS,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));

vi.mock('@shared/hooks/useLiveQuery', () => ({
  useLiveQuery: vi.fn(() => ({ data: [], isLoading: false, error: null, refresh: vi.fn() })),
}));

vi.mock('@features/accounts/stores/accountStore', () => ({
  useAccountStore: (sel: (s: { activeAccountId: string | null }) => unknown) =>
    sel({ activeAccountId: 'acc-1' }),
}));

import { useTaskStore } from '@features/tasks/stores/taskStore';
import { UnifiedWorkspace } from './UnifiedWorkspace';

function renderWorkspace() {
  useTaskStore.setState({ tasks: TASKS } as never);
  return render(<UnifiedWorkspace />);
}

describe('UnifiedWorkspace accordion', () => {
  it('renders all five sections with counts and opens mail by default', () => {
    renderWorkspace();
    for (const label of ['Mail', 'People', 'Tasks', 'Calendar', 'Automation']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
    // Mail preview: unread first.
    expect(screen.getByText('Please review the Q3 proposal?')).toBeInTheDocument();
    expect(screen.getByText('Invoice #1042 attached')).toBeInTheDocument();
  });

  it('switches preview when another section is opened', () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: /People/ }));
    expect(screen.getByText('Sara Douiri')).toBeInTheDocument();
    // Mail preview collapses away.
    expect(screen.queryByText('Please review the Q3 proposal?')).not.toBeInTheDocument();
  });

  it('each open section links to its full view', () => {
    renderWorkspace();
    const viewAll = screen.getByRole('link', { name: /View all/ });
    expect(viewAll).toHaveAttribute('href', '#/mail/inbox');
  });

  it('on-demand AI check reports real findings, nothing before', () => {
    renderWorkspace();
    expect(screen.queryByText('Needs your attention')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Check with AI/ }));
    return screen.findByText('Needs your attention').then(() => {
      // Real scanned items, not canned copy — present in both the mail
      // preview and the AI findings banner.
      expect(screen.getAllByText('Please review the Q3 proposal?')).toHaveLength(2);
      expect(screen.getByText('Late report')).toBeInTheDocument();
    });
  });

  it('on-demand check reports all-clear when nothing signals', async () => {
    const liveQueries = await import('@shared/services/db/liveQueries');
    vi.mocked(liveQueries.useLiveThreads).mockReturnValueOnce({
      data: [
        {
          id: 't9',
          subject: 'Newsletter',
          last_message_at: '2026-05-01',
          unread_count: 0,
          participant_count: 1,
        },
      ],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    } as never);
    useTaskStore.setState({ tasks: [] } as never);
    render(<UnifiedWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Check with AI/ }));
    await screen.findByText(/All clear/);
  });
});
