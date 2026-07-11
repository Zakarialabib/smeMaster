import {
  listComplianceProfiles as dbListProfiles,
  upsertComplianceProfile as dbUpsertProfile,
  setComplianceProfileActive as dbSetProfileActive,
  setDefaultComplianceProfile as dbSetDefaultProfile,
  insertComplianceCheck as dbInsertCheck,
  type ComplianceProfile as DbComplianceProfileRow,
} from "@shared/services/db/db-invoke";
import type { ComplianceProfile, ComplianceRule } from "@features/mail/services/compliance/types";

function mapRow(row: DbComplianceProfileRow): ComplianceProfile {
  let rules: ComplianceRule[] = [];
  try {
    rules = JSON.parse(row.rules_json) as ComplianceRule[];
  } catch {
    rules = [];
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    regionHint: row.region_hint,
    rules,
    isActive: row.is_active === 1,
    isDefault: row.is_default === 1,
  };
}

export async function getActiveProfiles(): Promise<ComplianceProfile[]> {
  const rows = await dbListProfiles();
  return rows.filter((r) => r.is_active === 1).map(mapRow);
}

export async function getProfilesForDomains(domains: string[]): Promise<ComplianceProfile[]> {
  if (domains.length === 0) return [];
  const rows = await dbListProfiles();
  return rows
    .filter((row) => {
      if (!row.is_active) return false;
      if (!row.region_hint) return true;
      const hints = row.region_hint.split(",").map((h) => h.trim().toLowerCase());
      return domains.some((d) => hints.some((h) => d.endsWith(h)));
    })
    .map(mapRow);
}

export async function getAllProfiles(): Promise<ComplianceProfile[]> {
  const rows = await dbListProfiles();
  return rows.map(mapRow);
}

export async function upsertProfile(profile: ComplianceProfile): Promise<void> {
  const encRules = JSON.stringify(profile.rules);
  await dbUpsertProfile({
    id: profile.id,
    code: profile.code,
    name: profile.name,
    description: profile.description,
    regionHint: profile.regionHint,
    rulesJson: encRules,
    isActive: profile.isActive,
    isDefault: profile.isDefault,
  });
}

export async function setProfileActive(id: string, active: boolean): Promise<void> {
  return dbSetProfileActive(id, active);
}

export async function setDefaultProfile(id: string): Promise<void> {
  return dbSetDefaultProfile(id);
}

export async function insertCheck(
  accountId: string,
  emailDraftId: string | null,
  campaignId: string | null,
  profileIds: string,
  score: number,
  violationsJson: string,
): Promise<void> {
  return dbInsertCheck({
    id: `${accountId}_${Date.now()}`,
    accountId,
    emailDraftId,
    campaignId,
    profileIds,
    score,
    violationsJson,
  });
}
