import { invokeCommand } from "@shared/services/db/invoke/command";

export interface DnsCheckResult {
  spf: string | null;
  dkim: string | null;
  dmarc: string | null;
}

export async function checkDomainDns(domain: string): Promise<DnsCheckResult> {
  return invokeCommand<DnsCheckResult>("check_dns_records", { domain });
}

export function extractDomain(email: string): string | null {
  const match = email.match(/@([^@]+)$/);
  return match?.[1] ?? null;
}
