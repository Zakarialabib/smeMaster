import { executeSearchQuery, deleteOldComplianceChecks } from '@shared/services/db/db-invoke';

export interface DbComplianceCheck {
  id: string;
  company_id: string;
  email_draft_id: string | null;
  campaign_id: string | null;
  profile_ids: string;
  score: number;
  violations_json: string | null;
  checked_at: number;
}

export async function getRecentChecks(
  companyId: string,
  limit: number = 10,
): Promise<DbComplianceCheck[]> {
  // compliance_checks is company-scoped (company_id FK to companies) — there
  // is no account_id column on this table.
  return executeSearchQuery(
    'SELECT * FROM compliance_checks WHERE company_id = $1 ORDER BY checked_at DESC LIMIT $2',
    [companyId, limit],
  ) as unknown as Promise<DbComplianceCheck[]>;
}

export async function deleteOldChecks(before: number): Promise<number> {
  return deleteOldComplianceChecks(before);
}
