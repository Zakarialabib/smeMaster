import { invokeCommand } from './command';

import type { ComplianceCheck, ComplianceProfile } from '../schema';

import type {
  CountRow,
  InsertComplianceProfileIgnoreRequest,
  UpsertComplianceProfileRequest,
} from './core';

export async function listComplianceProfiles(): Promise<ComplianceProfile[]> {
  return invokeCommand<ComplianceProfile[]>('db_list_compliance_profiles');
}

export async function countComplianceProfiles(): Promise<CountRow[]> {
  return invokeCommand<CountRow[]>('db_count_compliance_profiles');
}

export async function insertComplianceProfileIgnore(
  request: InsertComplianceProfileIgnoreRequest,
): Promise<void> {
  return invokeCommand<void>('db_insert_compliance_profile_ignore', {
    id: request.id,
    code: request.code,
    name: request.name,
    description: request.description ?? null,
    regionHint: request.regionHint ?? null,
    rulesJson: request.rulesJson,
  });
}

export async function getComplianceProfile(id: string): Promise<ComplianceProfile | null> {
  return invokeCommand<ComplianceProfile | null>('db_get_compliance_profile', { id });
}

export async function upsertComplianceProfile(
  profile: UpsertComplianceProfileRequest,
): Promise<void> {
  return invokeCommand<void>('db_upsert_compliance_profile', { profile });
}

export async function deleteComplianceProfile(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_compliance_profile', { id });
}

export async function listComplianceChecks(companyId: string): Promise<ComplianceCheck[]> {
  return invokeCommand<ComplianceCheck[]>('db_list_compliance_checks', { companyId });
}

export async function setComplianceProfileActive(id: string, active: boolean): Promise<void> {
  return invokeCommand<void>('db_set_compliance_profile_active', { id, active });
}

export async function setDefaultComplianceProfile(id: string): Promise<void> {
  return invokeCommand<void>('db_set_default_compliance_profile', { id });
}

export async function insertComplianceCheck(check: {
  id: string;
  accountId: string;
  emailDraftId: string | null;
  campaignId: string | null;
  profileIds: string;
  score: number;
  violationsJson: string;
}): Promise<void> {
  return invokeCommand<void>('db_insert_compliance_check', { check });
}

export async function deleteOldComplianceChecks(before: number): Promise<number> {
  return invokeCommand<number>('db_delete_old_compliance_checks', { before });
}
