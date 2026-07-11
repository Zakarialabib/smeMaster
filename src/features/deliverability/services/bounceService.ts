import { addToSuppression } from "./suppressionList";
import { executeSearchQuery, insertBounce } from "@shared/services/db/db-invoke";

export type BounceType = "hard" | "soft" | "policy";

export interface BounceRecord {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  recipient_email: string;
  bounce_type: BounceType;
  diagnostic_code: string | null;
  reason: string | null;
  bounced_at: number;
}

export interface BounceReport {
  totalBounces: number;
  hardBounces: number;
  softBounces: number;
  policyBounces: number;
  bounceRate: number;
  topReasons: { reason: string; count: number }[];
}

const HARD_PATTERNS = [
  /^5\d\d/, /^55[0-4]/, /user unknown/i, /does not exist/i,
  /no such (user|account|mailbox)/i, /invalid (recipient|address)/i,
  /address rejected/i, /mailbox (not found|does not exist)/i,
];

const SOFT_PATTERNS = [
  /^4\d\d/, /^45[0-2]/, /mailbox full/i, /try again later/i,
  /temporarily (rejected|unavailable)/i, /too many (connections|recipients)/i,
  /service (unavailable|temporarily)/i, /over quota/i,
];

const POLICY_PATTERNS = [
  /blocked/i, /rejected/i, /spam/i, /policy/i,
  /not allowed/i, /suspected spam/i, /message content/i,
];

export function classifyBounce(diagnosticCode: string | null, reason: string | null): BounceType {
  const text = `${diagnosticCode ?? ""} ${reason ?? ""}`;

  for (const p of HARD_PATTERNS) {
    if (p.test(text)) return "hard";
  }
  for (const p of SOFT_PATTERNS) {
    if (p.test(text)) return "soft";
  }
  for (const p of POLICY_PATTERNS) {
    if (p.test(text)) return "policy";
  }

  if (diagnosticCode) {
    if (diagnosticCode.startsWith("5")) return "hard";
    if (diagnosticCode.startsWith("4")) return "soft";
  }

  return "soft";
}

export async function processBounce(
  campaignId: string | null,
  contactId: string | null,
  recipientEmail: string,
  diagnosticCode: string | null,
  reason: string | null,
): Promise<BounceType> {
  const bounceType = classifyBounce(diagnosticCode, reason);

  const id = crypto.randomUUID();
  await insertBounce({ id, campaignId, contactId, recipientEmail, bounceType, diagnosticCode, reason });

  if (bounceType === "hard") {
    const accountId = await findAccountIdForEmail(recipientEmail);
    if (accountId) {
      await addToSuppression(accountId, recipientEmail, `hard_bounce: ${diagnosticCode ?? reason ?? "unknown"}`);
    }
  }

  if (bounceType === "policy") {
    console.warn(`Policy bounce for ${recipientEmail}: needs user review`);
  }

  if (bounceType === "soft") {
    const recentCount = await countRecentSoftBounces(recipientEmail);
    if (recentCount >= 3) {
      const accountId = await findAccountIdForEmail(recipientEmail);
      if (accountId) {
        await addToSuppression(accountId, recipientEmail, `soft_bounce_3x: ${diagnosticCode ?? reason ?? "unknown"}`);
      }
    }
  }

  return bounceType;
}

async function countRecentSoftBounces(email: string): Promise<number> {
  const threeDaysAgo = Math.floor(Date.now() / 1000) - 259200;
  const rows = await executeSearchQuery(
    "SELECT COUNT(*) as count FROM bounces WHERE recipient_email = $1 AND bounce_type = 'soft' AND bounced_at > $2",
    [email, threeDaysAgo],
  ) as unknown as { count: number }[];
  return rows[0]?.count ?? 0;
}

async function findAccountIdForEmail(email: string): Promise<string | null> {
  const rows = await executeSearchQuery(
    "SELECT id FROM accounts WHERE email = $1 LIMIT 1",
    [email],
  ) as unknown as { id: string }[];
  return rows[0]?.id ?? null;
}

export async function getBounceReport(accountId: string): Promise<BounceReport> {
  const [total, hard, soft, policy, reasons] = await Promise.all([
    executeSearchQuery("SELECT COUNT(*) as count FROM bounces WHERE campaign_id IN (SELECT id FROM campaigns WHERE account_id = $1)", [accountId]) as unknown as { count: number }[],
    executeSearchQuery("SELECT COUNT(*) as count FROM bounces WHERE bounce_type = 'hard' AND campaign_id IN (SELECT id FROM campaigns WHERE account_id = $1)", [accountId]) as unknown as { count: number }[],
    executeSearchQuery("SELECT COUNT(*) as count FROM bounces WHERE bounce_type = 'soft' AND campaign_id IN (SELECT id FROM campaigns WHERE account_id = $1)", [accountId]) as unknown as { count: number }[],
    executeSearchQuery("SELECT COUNT(*) as count FROM bounces WHERE bounce_type = 'policy' AND campaign_id IN (SELECT id FROM campaigns WHERE account_id = $1)", [accountId]) as unknown as { count: number }[],
    executeSearchQuery("SELECT COALESCE(reason, 'unknown') as reason, COUNT(*) as count FROM bounces WHERE campaign_id IN (SELECT id FROM campaigns WHERE account_id = $1) GROUP BY reason ORDER BY count DESC LIMIT 10", [accountId]) as unknown as { reason: string; count: number }[],
  ]);

  const totalCount = total[0]?.count ?? 0;
  return {
    totalBounces: totalCount,
    hardBounces: hard[0]?.count ?? 0,
    softBounces: soft[0]?.count ?? 0,
    policyBounces: policy[0]?.count ?? 0,
    bounceRate: 0,
    topReasons: reasons.map((r) => ({ reason: r.reason, count: r.count })),
  };
}
