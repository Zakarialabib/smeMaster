import { invokeCommand } from "@shared/services/db/invoke/command";

export interface RecordStatus {
  present: boolean;
  valid: boolean;
  issues: string[];
  raw_value?: string;
}

export interface BlacklistResult {
  provider: string;
  listed: boolean;
  details?: string;
}

export interface DomainHealth {
  domain: string;
  score: number;
  spf_status: RecordStatus;
  dkim_status: RecordStatus;
  dmarc_status: RecordStatus;
  ptr_status: RecordStatus;
  mx_status: RecordStatus;
  blacklist_status: BlacklistResult[];
  checked_at: string;
}

export enum FailureType {
  MissingSpf = "MissingSpf",
  SpfPermissive = "SpfPermissive",
  SpfLookupLimit = "SpfLookupLimit",
  MissingDkim = "MissingDkim",
  WeakDkimKey = "WeakDkimKey",
  MissingDmarc = "MissingDmarc",
  WeakDmarcPolicy = "WeakDmarcPolicy",
  BlacklistedIp = "BlacklistedIp",
  NoPtrMatch = "NoPtrMatch",
  MxIssues = "MxIssues",
}

export interface ProviderImpact {
  provider: string;
  severity: string;
  description: string;
}

export interface FixStep {
  step_number: number;
  action: string;
  expected_result: string;
  copy_value: string | null;
}

export interface FixPath {
  method: string;
  instructions: FixStep[];
  estimated_time: string;
}

export interface RemediationNode {
  failure_type: FailureType;
  explanation: {
    en: string;
    fr: string;
    ar: string;
  };
  impact: ProviderImpact[];
  fix_paths: FixPath[];
}

export interface SentinelAlert {
  id: string;
  alert_type: string;
  domain: string;
  severity: string;
  message: string;
  created_at: number;
  acknowledged: boolean;
}

export async function checkDomainHealth(domain: string, sendingIp?: string): Promise<DomainHealth> {
  return invokeCommand<DomainHealth>("check_domain_health", { domain, sendingIp: sendingIp ?? null });
}

export async function getRemediation(domain: string, failureTypes: FailureType[]): Promise<RemediationNode[]> {
  return invokeCommand<RemediationNode[]>("get_remediation", { domain, failureTypes });
}

export async function runSentinelCheck(domain: string, previousScore: number): Promise<SentinelAlert[]> {
  return invokeCommand<SentinelAlert[]>("run_sentinel_check", { domain, previousScore });
}
