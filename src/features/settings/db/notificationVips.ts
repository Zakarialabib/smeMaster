import { normalizeEmail } from "@shared/utils/emailUtils";
import { listNotificationVips, upsertNotificationVip, executeSearchQuery, removeNotificationVip } from "@/shared/services/db/db-invoke";
import type { NotificationVipRow } from "@/shared/services/db/db-invoke";

export type { NotificationVipRow };

export async function getVipSenders(accountId: string): Promise<Set<string>> {
  const rows = await executeSearchQuery(
    "SELECT email_address FROM notification_vips WHERE account_id = $1",
    [accountId],
  ) as { email_address: string }[];
  return new Set(rows.map((r) => normalizeEmail(r.email_address)));
}

export async function getAllVipSenders(accountId: string): Promise<NotificationVipRow[]> {
  return listNotificationVips(accountId);
}

export async function addVipSender(
  accountId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  await upsertNotificationVip({
    accountId,
    emailAddress: normalizeEmail(email),
    displayName: displayName ?? null,
  });
}

export async function removeVipSender(
  accountId: string,
  email: string,
): Promise<void> {
  await removeNotificationVip(accountId, normalizeEmail(email));
}

export async function isVipSender(
  accountId: string,
  email: string,
): Promise<boolean> {
  const rows = await executeSearchQuery(
    "SELECT COUNT(*) as count FROM notification_vips WHERE account_id = $1 AND email_address = $2",
    [accountId, normalizeEmail(email)],
  ) as { count: number }[];
  return (rows[0]?.count ?? 0) > 0;
}

export async function updateVipDisplayName(
  accountId: string,
  email: string,
  displayName?: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  await upsertNotificationVip({
    accountId,
    emailAddress: normalized,
    displayName: displayName ?? null,
  });
}
