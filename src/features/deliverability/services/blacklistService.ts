import { getCachedCheck, cacheCheck, getBlacklistHistory as dbGetHistory } from "@features/deliverability/db/blacklistCache";
import type { BlacklistCheckRow } from "@features/deliverability/db/blacklistCache";
import { invokeCommand } from "@shared/services/db/invoke/command";
import {
  listBlacklistMonitors,
  createBlacklistMonitor,
  updateBlacklistMonitor,
  deleteBlacklistMonitor,
  listDelistRequests,
  createDelistRequest,
  updateDelistRequestStatus,
  deleteDelistRequest,
  getBulkCheckJob,
  listBulkCheckJobs,
  createBulkCheckJob,
  updateBulkCheckJobProgress,
  completeBulkCheckJob,
  failBulkCheckJob,
  getReputationScore,
  upsertReputationScore,
  getAlertPreferences,
  upsertAlertPreferences,
  type BlacklistMonitor,
  type DelistRequest,
  type BulkCheckJob,
  type ReputationScore,
  type AlertPreferences,
} from "@shared/services/db/db-invoke";

export type { BlacklistMonitor, DelistRequest, BulkCheckJob, ReputationScore, AlertPreferences };

export interface BlacklistCheckResult {
  listName: string;
  listed: boolean;
  responded: boolean;
}

const DNSBLS = [
  { name: "Spamhaus", host: "zen.spamhaus.org" },
  { name: "Barracuda", host: "b.barracudacentral.org" },
  { name: "SpamCop", host: "bl.spamcop.net" },
  { name: "SURBL", host: "multi.surbl.org" },
];

export async function checkBlacklists(accountId: string, target: string, checkType: "ip" | "domain"): Promise<BlacklistCheckResult[]> {
  const cached = await getCachedCheck(accountId, checkType, target);
  if (cached && cached.listed === 1) {
    return [{
      listName: cached.list_name ?? "unknown",
      listed: true,
      responded: cached.responded === 1,
    }];
  }

  if (checkType !== "ip") {
    return DNSBLS.map((d) => ({ listName: d.name, listed: false, responded: false }));
  }

  let results: BlacklistCheckResult[];
  try {
    results = await invokeCommand<BlacklistCheckResult[]>("check_dnsbl_cmd", { ip: target });
  } catch {
    results = DNSBLS.map((d) => ({ listName: d.name, listed: false, responded: false }));
  }

  for (const r of results) {
    await cacheCheck(accountId, checkType, target, r.listed, r.listName, r.responded);
  }

  return results;
}

export async function getBlacklistHistory(accountId: string): Promise<BlacklistCheckRow[]> {
  return dbGetHistory(accountId);
}

// ── Blacklist Monitors ─────────────────────────────────────────────────────────

export async function getBlacklistMonitors(accountId: string): Promise<BlacklistMonitor[]> {
  return listBlacklistMonitors(accountId);
}

export async function addBlacklistMonitor(
  accountId: string,
  target: string,
  checkType: "ip" | "domain",
  intervalMinutes: number = 1440,
  alerts: string[] = ["email"]
): Promise<BlacklistMonitor> {
  return createBlacklistMonitor({
    accountId,
    target,
    checkType,
    intervalMinutes,
    alertsJson: JSON.stringify(alerts),
  });
}

export async function toggleBlacklistMonitor(id: string, enabled: boolean): Promise<void> {
  return updateBlacklistMonitor({ id, enabled });
}

export async function removeBlacklistMonitor(id: string): Promise<void> {
  return deleteBlacklistMonitor(id);
}

// ── Delist Requests ────────────────────────────────────────────────────────────

export async function getDelistRequests(accountId: string): Promise<DelistRequest[]> {
  return listDelistRequests(accountId);
}

export async function submitDelistRequest(
  accountId: string,
  listName: string,
  target: string,
  targetType: "ip" | "domain",
  reason?: string
): Promise<DelistRequest> {
  return createDelistRequest({
    accountId,
    listName,
    target,
    targetType,
    reason,
  });
}

export async function updateDelistStatus(
  id: string,
  status: "pending" | "submitted" | "in_review" | "resolved" | "rejected",
  delistUrl?: string,
  notes?: string
): Promise<void> {
  return updateDelistRequestStatus(id, status, delistUrl, notes);
}

export async function removeDelistRequest(id: string): Promise<void> {
  return deleteDelistRequest(id);
}

// ── Bulk Check Jobs ────────────────────────────────────────────────────────────

export async function getBulkCheckJobs(accountId: string, limit: number = 10): Promise<BulkCheckJob[]> {
  return listBulkCheckJobs(accountId, limit);
}

export async function getBulkCheckJobStatus(id: string): Promise<BulkCheckJob | null> {
  return getBulkCheckJob(id);
}

export async function startBulkCheck(accountId: string, targets: { target: string; type: "ip" | "domain" }[]): Promise<BulkCheckJob> {
  return createBulkCheckJob(accountId, targets.length);
}

export async function updateBulkCheckProgress(id: string, processed: number, results: unknown[]): Promise<void> {
  return updateBulkCheckJobProgress(id, processed, JSON.stringify(results));
}

export async function finishBulkCheck(id: string, results: unknown[]): Promise<void> {
  return completeBulkCheckJob(id, JSON.stringify(results));
}

export async function failBulkCheck(id: string): Promise<void> {
  return failBulkCheckJob(id);
}

// ── Reputation Score ───────────────────────────────────────────────────────────

export async function getAccountReputation(accountId: string): Promise<ReputationScore | null> {
  return getReputationScore(accountId);
}

export async function saveReputationScore(
  accountId: string,
  overall: number,
  factors: {
    blacklist: number;
    bounce: number;
    complaint: number;
    warmup: number;
  }
): Promise<ReputationScore> {
  return upsertReputationScore({
    accountId,
    overallScore: overall,
    blacklistFactor: factors.blacklist,
    bounceFactor: factors.bounce,
    complaintFactor: factors.complaint,
    warmupFactor: factors.warmup,
  });
}

// ── Alert Preferences ──────────────────────────────────────────────────────────

export async function getNotificationPreferences(accountId: string): Promise<AlertPreferences | null> {
  return getAlertPreferences(accountId);
}

export async function saveNotificationPreferences(
  accountId: string,
  enabled: boolean,
  channels: string[],
  threshold: "immediate" | "daily" | "weekly"
): Promise<AlertPreferences> {
  return upsertAlertPreferences({
    accountId,
    blacklistEnabled: enabled,
    channelsJson: JSON.stringify(channels),
    threshold,
  });
}
