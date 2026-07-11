import {
  executeSearchQuery,
  deleteOldComplianceChecks,
} from "@shared/services/db/db-invoke";

export interface DbComplianceCheck {
  id: string;
  account_id: string;
  email_draft_id: string | null;
  campaign_id: string | null;
  profile_ids: string;
  score: number;
  violations_json: string | null;
  checked_at: number;
}

export async function getRecentChecks(
  accountId: string,
  limit: number = 10,
): Promise<DbComplianceCheck[]> {
  return executeSearchQuery(
    "SELECT * FROM compliance_checks WHERE account_id = $1 ORDER BY checked_at DESC LIMIT $2",
    [accountId, limit],
  ) as unknown as Promise<DbComplianceCheck[]>;
}

export async function deleteOldChecks(before: number): Promise<number> {
  return deleteOldComplianceChecks(before);
}

