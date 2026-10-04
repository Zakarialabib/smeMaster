import type { Thread, Contact } from '@shared/services/db/liveQueries';

export interface InsightItem {
  id: string;
  title: string;
  source?: string;
}

/** Latest-N preview rows per workspace section (dashboard accordion). */
export const ACCORDION_PREVIEW_COUNT = 5;
/** Max items returned by an on-demand AI check. */
export const AI_CHECK_LIMIT = 5;

const DAY_MS = 86_400_000;

// Phrases that usually mean someone is waiting on you.
const ACTION_CUES: { pattern: RegExp; label: string }[] = [
  { pattern: /\basap\b|\burgent\b|\beom\b|\btoday\b/i, label: 'time-sensitive' },
  { pattern: /\bplease\b|\bkindly\b|\bcould you\b|\bwould you\b/i, label: 'request' },
  { pattern: /\breview\b|\bsign\b|\bapprove\b|\bconfirm\b/i, label: 'needs decision' },
  { pattern: /\binvoice\b|\bpayment\b|\bpay\b|\bquote\b/i, label: 'billing' },
  { pattern: /\bmeeting\b|\bcall\b|\bschedule\b|\bdeadline\b/i, label: 'scheduling' },
  { pattern: /\?/, label: 'question' },
];

function cueOf(subject: string): string | null {
  for (const cue of ACTION_CUES) {
    if (cue.pattern.test(subject)) return cue.label;
  }
  return null;
}

/**
 * Scan loaded threads for mails that likely need action.
 *
 * Pure + offline: scores unread state, action cues and questions in the
 * subject. Returns at most `limit` items, highest signal first.
 */
export function detectMailActions(
  threads: Thread[],
  limit: number = AI_CHECK_LIMIT,
): InsightItem[] {
  const scored: { item: InsightItem; score: number }[] = [];
  for (const t of threads) {
    const subject = t.subject?.trim() || '(No subject)';
    const cue = cueOf(t.subject ?? '');
    let score = 0;
    const reasons: string[] = [];
    if (t.unread_count > 0) {
      score += 2 + Math.min(t.unread_count, 5);
      reasons.push(t.unread_count === 1 ? '1 unread' : `${t.unread_count} unread`);
    }
    if (cue) {
      score += 3;
      reasons.push(cue);
    }
    if (score === 0) continue;
    scored.push({ item: { id: t.id, title: subject, source: reasons.join(' · ') }, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, limit)).map((s) => s.item);
}

export interface TaskLike {
  id: string;
  title: string;
  priority?: string;
  is_completed: number;
  due_date?: number | null;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Surface incomplete tasks that need attention: overdue first, then due
 * today, then high priority. Returns at most `limit` items.
 */
export function detectTaskRisks(
  tasks: TaskLike[],
  nowMs: number = Date.now(),
  limit: number = AI_CHECK_LIMIT,
): InsightItem[] {
  const today = startOfDay(nowMs);
  const scored: { item: InsightItem; score: number }[] = [];
  for (const t of tasks) {
    if (t.is_completed) continue;
    const due = t.due_date ?? null;
    let score = 1;
    let reason = 'open';
    if (due !== null && due < today) {
      const days = Math.max(1, Math.round((today - startOfDay(due)) / DAY_MS));
      score = 10 + Math.min(days, 30);
      reason = days === 1 ? 'overdue 1 day' : `overdue ${days} days`;
    } else if (due !== null && startOfDay(due) === today) {
      score = 8;
      reason = 'due today';
    } else if (t.priority === 'high') {
      score = 5;
      reason = 'high priority';
    }
    scored.push({ item: { id: t.id, title: t.title, source: reason }, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, limit)).map((s) => s.item);
}

/**
 * Latest contacts preview: most recently contacted first; never-contacted
 * contacts keep their fetched order at the end.
 */
export function latestContacts(
  contacts: Contact[],
  limit: number = ACCORDION_PREVIEW_COUNT,
): Contact[] {
  return [...contacts]
    .sort((a, b) => (b.last_contacted_at ?? '').localeCompare(a.last_contacted_at ?? ''))
    .slice(0, Math.max(0, limit));
}

/**
 * Latest threads preview: unread first, then most recent.
 */
export function latestThreads(
  threads: Thread[],
  limit: number = ACCORDION_PREVIEW_COUNT,
): Thread[] {
  return [...threads]
    .sort((a, b) => {
      const unread = (b.unread_count > 0 ? 1 : 0) - (a.unread_count > 0 ? 1 : 0);
      if (unread !== 0) return unread;
      return (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '');
    })
    .slice(0, Math.max(0, limit));
}
