import { describe, it, expect } from 'vitest';
import {
  detectMailActions,
  detectTaskRisks,
  latestContacts,
  latestThreads,
} from './workspaceInsights';

describe('detectMailActions', () => {
  it('returns empty when nothing signals action', () => {
    const threads = [
      {
        id: 't1',
        subject: 'Newsletter #42',
        last_message_at: '2026-01-01',
        unread_count: 0,
        participant_count: 1,
      },
    ];
    expect(detectMailActions(threads)).toEqual([]);
  });

  it('flags unread threads and action cues with reasons', () => {
    const threads = [
      {
        id: 't1',
        subject: 'Please review the Q3 proposal?',
        last_message_at: '2026-01-02',
        unread_count: 2,
        participant_count: 2,
      },
      {
        id: 't2',
        subject: 'Newsletter #42',
        last_message_at: '2026-01-03',
        unread_count: 0,
        participant_count: 1,
      },
      {
        id: 't3',
        subject: 'Invoice #1042 attached',
        last_message_at: '2026-01-01',
        unread_count: 0,
        participant_count: 1,
      },
    ];
    const items = detectMailActions(threads);
    expect(items).toHaveLength(2);
    // t1 scores highest: unread + request cue; t3 second via billing cue.
    expect(items[0]!.id).toBe('t1');
    expect(items[0]!.source).toContain('2 unread');
    expect(items[1]!.id).toBe('t3');
  });

  it('caps results at the limit', () => {
    const threads = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      subject: `Urgent matter ${i}`,
      last_message_at: '2026-01-01',
      unread_count: 1,
      participant_count: 1,
    }));
    expect(detectMailActions(threads, 3)).toHaveLength(3);
  });
});

describe('detectTaskRisks', () => {
  const NOW = new Date(2026, 4, 15, 12, 0, 0).getTime();
  const DAY = 86_400_000;

  it('skips completed tasks and ranks overdue first', () => {
    const tasks = [
      { id: 'done', title: 'Old', is_completed: 1, due_date: NOW - 10 * DAY },
      { id: 'low', title: 'Someday', is_completed: 0, priority: 'low', due_date: null },
      { id: 'high', title: 'Important', is_completed: 0, priority: 'high', due_date: null },
      {
        id: 'over',
        title: 'Late report',
        is_completed: 0,
        priority: 'low',
        due_date: NOW - 2 * DAY,
      },
      { id: 'today', title: 'Call back', is_completed: 0, priority: 'low', due_date: NOW },
    ];
    const items = detectTaskRisks(tasks, NOW);
    expect(items.map((i) => i.id)).toEqual(['over', 'today', 'high', 'low']);
    expect(items[0]!.source).toContain('overdue');
  });

  it('returns empty when everything is done', () => {
    expect(detectTaskRisks([{ id: 'a', title: 'A', is_completed: 1 }], NOW)).toEqual([]);
  });
});

describe('latestContacts', () => {
  it('orders by most recently contacted', () => {
    const contacts = [
      { id: 'a', email: 'a@x.y', display_name: 'A', tags: [], last_contacted_at: '2026-01-01' },
      { id: 'b', email: 'b@x.y', display_name: 'B', tags: [] },
      { id: 'c', email: 'c@x.y', display_name: 'C', tags: [], last_contacted_at: '2026-05-01' },
    ];
    expect(latestContacts(contacts).map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('latestThreads', () => {
  it('puts unread first, then most recent', () => {
    const threads = [
      {
        id: 'old',
        subject: 'Old',
        last_message_at: '2026-01-01',
        unread_count: 0,
        participant_count: 1,
      },
      {
        id: 'new',
        subject: 'New',
        last_message_at: '2026-05-01',
        unread_count: 0,
        participant_count: 1,
      },
      {
        id: 'unread',
        subject: 'Unread',
        last_message_at: '2026-02-01',
        unread_count: 3,
        participant_count: 1,
      },
    ];
    expect(latestThreads(threads).map((t) => t.id)).toEqual(['unread', 'new', 'old']);
  });
});
