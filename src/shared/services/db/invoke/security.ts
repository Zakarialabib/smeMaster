import { invokeCommand } from './command';

import type { Allowlist, LinkScanResult, PgpKey } from '../schema';

export async function listPgpKeys(accountId: string): Promise<PgpKey[]> {
  return invokeCommand<PgpKey[]>('db_list_pgp_keys', { accountId });
}

export async function listAllowlist(
  accountId: string,
  listType?: string | null,
): Promise<Allowlist[]> {
  return invokeCommand<Allowlist[]>('db_list_allowlist', {
    accountId,
    listType: listType ?? null,
  });
}

export async function getLinkScanResult(
  accountId: string,
  messageId: string,
): Promise<LinkScanResult | null> {
  return invokeCommand<LinkScanResult | null>('db_get_link_scan_result', { accountId, messageId });
}

export async function upsertLinkScanResult(
  accountId: string,
  messageId: string,
  resultJson: string,
): Promise<LinkScanResult> {
  return invokeCommand<LinkScanResult>('db_upsert_link_scan_result', {
    accountId,
    messageId,
    resultJson,
  });
}

export async function deleteLinkScanResults(accountId: string): Promise<void> {
  return invokeCommand<void>('db_delete_link_scan_results', { accountId });
}
