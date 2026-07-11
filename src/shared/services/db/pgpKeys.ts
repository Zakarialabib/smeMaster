import {
  listPgpKeys,
  type PgpKey,
} from "@shared/services/db/db-invoke";
import { invokeCommand } from "@shared/services/db/invoke/command";

export type DbPgpKey = PgpKey;

export async function getPgpKeys(accountId: string): Promise<DbPgpKey[]> {
  return listPgpKeys(accountId);
}

/**
 * Save a PGP key by inserting/updating via the Rust command.
 */
export async function savePgpKey(
  accountId: string,
  keyId: string,
  publicKey: string,
  privateKeyEncrypted?: string,
  passphraseHint?: string,
  fingerprint?: string,
  userId?: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await invokeCommand("db_upsert_pgp_key", {
    id,
    accountId,
    keyId,
    publicKey,
    privateKeyEncrypted: privateKeyEncrypted ?? null,
    passphraseHint: passphraseHint ?? null,
    fingerprint: fingerprint ?? null,
    userId: userId ?? null,
  });
  return id;
}

/**
 * Delete a PGP key via the Rust command.
 */
export async function deletePgpKey(id: string): Promise<void> {
  await invokeCommand("db_delete_pgp_key", { id });
}

/**
 * Get the first PGP key that has an encrypted private key for the account.
 */
export async function getPgpKey(
  accountId: string,
): Promise<{ private_key_encrypted: string | null } | null> {
  const keys = await listPgpKeys(accountId);
  const key = keys.find((k) => k.private_key_encrypted !== null) ?? null;
  if (!key) return null;
  return { private_key_encrypted: key.private_key_encrypted ?? null };
}
