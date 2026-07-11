import {
  getEngagementDataForContact as dbGetEngagementDataForContact,
  updateContactScore as dbUpdateContactScoreCmd,
  batchUpdateContactScores as dbBatchUpdateContactScores,
  executeSearchQuery,
} from "@shared/services/db/db-invoke";

/**
 * Unified engagement scoring algorithm (A1).
 *
 * Computes a composite score (0–1) from multiple dimensions:
 * - Email engagement (recency, frequency, reply rate)
 * - Task completions (weight per completed task)
 * - Campaign engagement (opens + clicks)
 * - Calendar activity (meetings attended)
 *
 * Weights are tuned for SME use where email + tasks dominate.
 */
const WEIGHTS = {
  emailRecency: 0.25,
  emailFrequency: 0.15,
  emailReplyRate: 0.15,
  taskCompletion: 0.15,
  campaignEngagement: 0.15,
  calendarActivity: 0.15,
} as const;

export interface UnifiedContactInput {
  /** Days since last email contact */
  daysSinceLastContact: number;
  /** Email contacts in last 30 days */
  contactsLast30d: number;
  /** Replies sent (email) */
  repliesSent: number;
  /** Emails received */
  emailsReceived: number;
  /** Tasks completed in last 90 days */
  tasksCompletedLast90d: number;
  /** Total assigned tasks in last 90 days */
  totalAssignedTasksLast90d: number;
  /** Campaign emails opened in last 90 days */
  campaignOpensLast90d: number;
  /** Campaign links clicked in last 90 days */
  campaignClicksLast90d: number;
  /** Calendar meetings attended in last 90 days */
  meetingsAttendedLast90d: number;
  /** Total calendar meeting invites in last 90 days */
  totalMeetingsLast90d: number;
}

/**
 * Compute a unified engagement score (0–1) from all available signals.
 */
export function computeUnifiedScore(input: UnifiedContactInput): number {
  // ── Email signals ──────────────────────────────────────────────────
  const recencyFactor = Math.min(1.0, 30 / Math.max(1, input.daysSinceLastContact));
  const frequencyFactor = Math.min(1.0, input.contactsLast30d / 10);
  const replyRate = input.emailsReceived > 0
    ? Math.min(1.0, input.repliesSent / input.emailsReceived)
    : 0;

  // ── Task signals ───────────────────────────────────────────────────
  const taskFactor = input.totalAssignedTasksLast90d > 0
    ? Math.min(1.0, input.tasksCompletedLast90d / input.totalAssignedTasksLast90d)
    : 0;

  // ── Campaign signals ────────────────────────────────────────────────
  const campaignFactor = Math.min(1.0,
    (input.campaignOpensLast90d * 2 + input.campaignClicksLast90d * 3) / 20,
  );

  // ── Calendar signals ────────────────────────────────────────────────
  const calendarFactor = input.totalMeetingsLast90d > 0
    ? Math.min(1.0, input.meetingsAttendedLast90d / input.totalMeetingsLast90d)
    : 0;

  const score =
    WEIGHTS.emailRecency * recencyFactor +
    WEIGHTS.emailFrequency * frequencyFactor +
    WEIGHTS.emailReplyRate * replyRate +
    WEIGHTS.taskCompletion * taskFactor +
    WEIGHTS.campaignEngagement * campaignFactor +
    WEIGHTS.calendarActivity * calendarFactor;

  return Math.round(Math.min(1.0, Math.max(0, score)) * 1000) / 1000;
}

export function getHealthStatus(score: number): 'cold' | 'lukewarm' | 'warm' | 'hot' {
  if (score >= 0.7) return 'hot';
  if (score >= 0.4) return 'warm';
  if (score >= 0.2) return 'lukewarm';
  return 'cold';
}

export interface ContactEngagementInput {
  daysSinceLastContact: number;
  contactsLast30d: number;
  repliesSent: number;
  emailsReceived: number;
}

/**
 * Compute a simple email-only engagement score (0–1) from the four core
 * engagement signals: recency, frequency, and reply rate.
 *
 * Used for lightweight scoring when only email data is available.
 */
export function computeEngagementScore(input: ContactEngagementInput): number {
  const recencyFactor = Math.min(1.0, 30 / Math.max(1, input.daysSinceLastContact));
  const frequencyFactor = Math.min(1.0, input.contactsLast30d / 10);
  const replyRate = input.emailsReceived > 0
    ? Math.min(1.0, input.repliesSent / input.emailsReceived)
    : 0;
  const score = 0.4 * recencyFactor + 0.3 * frequencyFactor + 0.3 * replyRate;
  return Math.min(1.0, Math.max(0, score));
}

export async function getEngagementDataForContact(email: string): Promise<ContactEngagementInput> {
  return dbGetEngagementDataForContact(email);
}

/**
 * Fetch expanded unified engagement data for a contact from all sources.
 * Falls back gracefully if a query fails (logs warning, returns 0 for that dimension).
 */
export async function getUnifiedDataForContact(contactId: string, email: string): Promise<UnifiedContactInput> {
  const emailData = await dbGetEngagementDataForContact(email).catch(() => ({
    daysSinceLastContact: 999,
    contactsLast30d: 0,
    repliesSent: 0,
    emailsReceived: 0,
  }));

  // Query tasks completed vs assigned
  let tasksCompletedLast90d = 0;
  let totalAssignedTasksLast90d = 0;
  try {
    const taskRows = await executeSearchQuery(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'done' AND updated_at >= strftime('%s', 'now', '-90 days')) AS completed,
         COUNT(*) AS total
       FROM tasks WHERE contact_id = $1`,
      [contactId],
    );
    if (taskRows.length > 0) {
      tasksCompletedLast90d = Number(taskRows[0]!.completed ?? 0);
      totalAssignedTasksLast90d = Number(taskRows[0]!.total ?? 0);
    }
  } catch { /* query not available — silent fallback */ }

  // Query campaign engagement
  let campaignOpensLast90d = 0;
  let campaignClicksLast90d = 0;
  try {
    const campRows = await executeSearchQuery(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'open') AS opens,
         COUNT(*) FILTER (WHERE event_type = 'click') AS clicks
       FROM campaign_events
       WHERE contact_email = $1 AND created_at >= strftime('%s', 'now', '-90 days')`,
      [email],
    );
    if (campRows.length > 0) {
      campaignOpensLast90d = Number(campRows[0]!.opens ?? 0);
      campaignClicksLast90d = Number(campRows[0]!.clicks ?? 0);
    }
  } catch { /* silent */ }

  // Query calendar engagement
  let meetingsAttendedLast90d = 0;
  let totalMeetingsLast90d = 0;
  try {
    const calRows = await executeSearchQuery(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'accepted') AS attended,
         COUNT(*) AS total
       FROM calendar_events
       WHERE contact_id = $1 AND end_time >= strftime('%s', 'now', '-90 days')`,
      [contactId],
    );
    if (calRows.length > 0) {
      meetingsAttendedLast90d = Number(calRows[0]!.attended ?? 0);
      totalMeetingsLast90d = Number(calRows[0]!.total ?? 0);
    }
  } catch { /* silent */ }

  return {
    daysSinceLastContact: emailData.daysSinceLastContact,
    contactsLast30d: emailData.contactsLast30d,
    repliesSent: emailData.repliesSent,
    emailsReceived: emailData.emailsReceived,
    tasksCompletedLast90d,
    totalAssignedTasksLast90d,
    campaignOpensLast90d,
    campaignClicksLast90d,
    meetingsAttendedLast90d,
    totalMeetingsLast90d,
  };
}

/**
 * Update a contact's score using the unified algorithm.
 * Fetches data from all available sources and computes a weighted score.
 */
export async function updateContactScore(contactId: string): Promise<void> {
  const rows = await executeSearchQuery(
    "SELECT email FROM contacts WHERE id = $1",
    [contactId],
  );
  if (rows.length === 0) return;

  const email = rows[0]!.email as string;
  const input = await getUnifiedDataForContact(contactId, email);
  const score = computeUnifiedScore(input);
  const healthStatus = getHealthStatus(score);
  const now = Math.floor(Date.now() / 1000);

  await dbUpdateContactScoreCmd(contactId, score, now, healthStatus);
}

export async function batchUpdateScores(): Promise<void> {
  await dbBatchUpdateContactScores();
}
