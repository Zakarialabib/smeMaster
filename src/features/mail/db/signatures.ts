import { v4 as uuidv4 } from 'uuid';
import {
  listSignatures,
  upsertSignature as dbUpsertSignature,
  deleteSignature as dbDeleteSignature,
  updateSignature as dbUpdateSignature,
  clearDefaultSignature as dbClearDefaultSignature,
  getDefaultSignature,
  getSignatureAccount,
} from "@/shared/services/db/db-invoke";
import type { Signature } from "@shared/services/db/schema";

export type DbSignature = Signature;

export async function getSignaturesForAccount(accountId: string): Promise<DbSignature[]> {
  return listSignatures(accountId);
}

export { getDefaultSignature as getDefaultSignature };

export async function insertSignature(sig: {
  accountId: string;
  name: string;
  bodyHtml: string;
  isDefault: boolean;
}): Promise<string> {
  const id = uuidv4();

  if (sig.isDefault) {
    await dbClearDefaultSignature(sig.accountId);
  }

  await dbUpsertSignature({
    id,
    accountId: sig.accountId,
    name: sig.name,
    bodyHtml: sig.bodyHtml,
    isDefault: sig.isDefault,
  });

  return id;
}

export async function updateSignature(
  id: string,
  updates: { name?: string; bodyHtml?: string; isDefault?: boolean },
): Promise<void> {
  const set: Record<string, unknown> = {};

  if (updates.isDefault) {
    const rows = await getSignatureAccount(id);
    if (rows[0]) {
      await dbClearDefaultSignature(rows[0].account_id);
    }
  }

  if (updates.name !== undefined) set.name = updates.name;
  if (updates.bodyHtml !== undefined) set.body_html = updates.bodyHtml;
  if (updates.isDefault !== undefined) set.is_default = updates.isDefault ? 1 : 0;

  if (Object.keys(set).length > 0) {
    await dbUpdateSignature(id, { set, unset: [] });
  }
}

export const deleteSignature = dbDeleteSignature;
