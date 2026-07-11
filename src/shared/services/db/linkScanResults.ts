import {
  deleteLinkScanResults as dbInvokeDeleteLinkScanResults,
  getLinkScanResult,
  upsertLinkScanResult,
} from "@shared/services/db/db-invoke";

export async function getCachedScanResult(
  accountId: string,
  messageId: string,
): Promise<string | null> {
  const row = await getLinkScanResult(accountId, messageId);
  return row?.result_json ?? null;
}

export async function cacheScanResult(
  accountId: string,
  messageId: string,
  resultJson: string,
): Promise<void> {
  await upsertLinkScanResult(accountId, messageId, resultJson);
}

export async function deleteScanResults(accountId: string): Promise<void> {
  await dbInvokeDeleteLinkScanResults(accountId);
}
