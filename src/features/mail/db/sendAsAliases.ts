import {
  listSendAsAliases as dbListAliases,
  upsertSendAsAlias as dbUpsertAlias,
  deleteSendAsAlias as dbDeleteAlias,
  setDefaultAlias as dbSetDefaultAlias,
  type SendAsAlias as DbSendAsAlias,
} from "@shared/services/db/db-invoke";

export type { DbSendAsAlias };

export interface SendAsAlias {
  id: string;
  accountId: string;
  email: string;
  displayName: string | null;
  replyToAddress: string | null;
  signatureId: string | null;
  isPrimary: boolean;
  isDefault: boolean;
  treatAsAlias: boolean;
  verificationStatus: string;
}

export function mapDbAlias(db: DbSendAsAlias): SendAsAlias {
  return {
    id: db.id,
    accountId: db.account_id,
    email: db.email,
    displayName: db.display_name,
    replyToAddress: db.reply_to_address,
    signatureId: db.signature_id,
    isPrimary: db.is_primary === 1,
    isDefault: db.is_default === 1,
    treatAsAlias: db.treat_as_alias === 1,
    verificationStatus: db.verification_status,
  };
}

export async function getAliasesForAccount(
  accountId: string,
): Promise<DbSendAsAlias[]> {
  return dbListAliases(accountId);
}

export async function upsertAlias(alias: {
  accountId: string;
  email: string;
  displayName?: string | null;
  replyToAddress?: string | null;
  signatureId?: string | null;
  isPrimary?: boolean;
  isDefault?: boolean;
  treatAsAlias?: boolean;
  verificationStatus?: string;
}): Promise<string> {
  const created = await dbUpsertAlias({
    accountId: alias.accountId,
    email: alias.email,
    displayName: alias.displayName ?? null,
    replyToAddress: alias.replyToAddress ?? null,
    signatureId: alias.signatureId ?? null,
    isPrimary: alias.isPrimary ?? null,
    isDefault: alias.isDefault ?? null,
    treatAsAlias: alias.treatAsAlias ?? null,
    verificationStatus: alias.verificationStatus ?? "accepted",
  });
  return created.id;
}

export async function getDefaultAlias(
  accountId: string,
): Promise<DbSendAsAlias | null> {
  const aliases = await dbListAliases(accountId);
  // Try to get the explicitly set default
  const defaultAlias = aliases.find((a) => a.is_default === 1);
  if (defaultAlias) return defaultAlias;
  // Fall back to the primary alias
  return aliases.find((a) => a.is_primary === 1) ?? null;
}

export async function setDefaultAlias(
  accountId: string,
  aliasId: string,
): Promise<void> {
  return dbSetDefaultAlias(accountId, aliasId);
}

export async function deleteAlias(id: string): Promise<void> {
  return dbDeleteAlias(id);
}
