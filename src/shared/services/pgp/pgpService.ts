import { invokeCommand } from "@shared/services/db/invoke/command";
import {
  getPgpKeys as getDbKeys,
  deletePgpKey as deleteDbKey,
  savePgpKey,
} from "@shared/services/db/pgpKeys";
import type { DbPgpKey } from "@shared/services/db/pgpKeys";

export interface PgpKeyInfo {
  key_id: string;
  fingerprint: string;
  creation_time: string;
  user_id: string;
}

// Re-export the DB type so consumers can work with stored keys
export type { DbPgpKey };

async function pgpInvoke<T>(cmd: string, label: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invokeCommand<T>(cmd, args ?? {});
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function generatePgpKey(userId: string, passphrase: string): Promise<[string, string]> {
  return pgpInvoke<[string, string]>("generate_key", "Failed to generate PGP key", { userId, passphrase });
}

export function getPgpKeyInfo(armoredKey: string): Promise<PgpKeyInfo> {
  return pgpInvoke<PgpKeyInfo>("get_key_info_cmd", "Failed to get PGP key info", { armoredKey });
}

export function encryptMessage(plaintext: string, publicKeyArmored: string): Promise<string> {
  return pgpInvoke<string>("encrypt", "Failed to encrypt message", { plaintext, publicKeyArmored });
}

export function decryptMessage(ciphertextB64: string, privateKeyArmored: string, passphrase: string): Promise<string> {
  return pgpInvoke<string>("decrypt_message", "Failed to decrypt message", { ciphertextB64, privateKeyArmored, passphrase });
}

export async function getPrivateKeyArmored(
  accountId: string,
): Promise<string | null> {
  const keys = await getDbKeys(accountId);
  const key = keys[0];
  if (!key?.private_key_encrypted) return null;
  return key.private_key_encrypted;
}

export function isPgpMessage(text: string): boolean {
  return text.includes("-----BEGIN PGP MESSAGE-----");
}

export function extractPgpCiphertext(text: string): string | null {
  const start = text.indexOf("-----BEGIN PGP MESSAGE-----");
  if (start === -1) return null;
  const end = text.indexOf("-----END PGP MESSAGE-----", start);
  if (end === -1) return null;
  return text.slice(start, end + "-----END PGP MESSAGE-----".length);
}

// ── Key management helpers ────────────────────────────────────────────────

/** List all PGP keys for a given account from the local DB. */
export async function listPgpKeys(accountId: string): Promise<DbPgpKey[]> {
  return getDbKeys(accountId);
}

/** Delete a PGP key by its DB record id. */
export async function deletePgpKeyById(id: string): Promise<void> {
  return deleteDbKey(id);
}

/**
 * Import an armored PGP key (public + optional private) into the DB.
 * Parses the armored text via the Rust backend to extract key_id and fingerprint,
 * then saves it to the local SQLite database.
 */
export async function importPgpKey(
  accountId: string,
  publicKeyArmored: string,
  privateKeyArmored?: string,
  passphraseHint?: string,
  userId?: string,
): Promise<{ keyId: string; fingerprint: string }> {
  const info = await getPgpKeyInfo(publicKeyArmored);
  await savePgpKey(
    accountId,
    info.key_id,
    publicKeyArmored,
    privateKeyArmored,
    passphraseHint,
    info.fingerprint,
    userId ?? info.user_id,
  );
  return { keyId: info.key_id, fingerprint: info.fingerprint };
}
