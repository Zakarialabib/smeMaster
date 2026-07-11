import { invokeCommand } from "@shared/services/db/invoke/command";

export interface VaultEntry {
  path: string;
  isDir: boolean;
  category?: string;
}

export interface CopyToVaultOptions {
  encrypt?: boolean;
  publicKeyArmored?: string;
}

/**
 * Get the vault root directory path.
 * Requires biometric auth on mobile.
 */
export async function getVaultRoot(accountId?: string): Promise<string> {
  return invokeCommand<string>('get_vault_root', accountId ? { accountId } : {});
}

/**
 * Copy a file to the vault with optional PGP encryption.
 * Requires biometric auth on mobile.
 */
export async function copyToVaultEncrypted(
  sourcePath: string,
  vaultPath: string,
  options?: CopyToVaultOptions,
): Promise<void> {
  return invokeCommand('copy_to_vault_encrypted', {
    sourcePath,
    vaultPath,
    options: options ?? null,
  });
}

/**
 * Copy a file to the vault (plain, no encryption).
 */
export async function copyToVault(
  sourcePath: string,
  vaultPath: string,
  accountId?: string,
): Promise<void> {
  return invokeCommand('copy_to_vault', { sourcePath, vaultPath, ...(accountId ? { accountId } : {}) });
}

/**
 * Delete a file or folder from the vault.
 * Requires biometric auth on mobile.
 */
export async function deleteFromVault(vaultPath: string, accountId?: string): Promise<void> {
  return invokeCommand('delete_from_vault', { vaultPath, ...(accountId ? { accountId } : {}) });
}

/**
 * List all files in a vault directory.
 * Requires biometric auth on mobile.
 */
export async function listVaultDir(dirPath: string, accountId?: string): Promise<VaultEntry[]> {
  return invokeCommand<VaultEntry[]>('list_vault_dir', { dirPath, ...(accountId ? { accountId } : {}) });
}

/**
 * Check if biometric is available and get its status.
 */
export async function checkBiometricStatus(): Promise<{
  isAvailable: boolean;
  biometryType: number;
  error: string | null;
}> {
  return invokeCommand('check_biometric');
}

/**
 * Authenticate with biometric.
 */
export async function authenticateBiometric(reason: string): Promise<void> {
  return invokeCommand('authenticate_biometric', { reason });
}

/**
 * Read a vault file and return its contents as a base64-encoded string.
 * Requires biometric auth on mobile.
 */
export async function readVaultFile(path: string, accountId?: string): Promise<string> {
  return invokeCommand<string>('read_vault_file', { path, ...(accountId ? { accountId } : {}) });
}

/**
 * Copy a vault file to the system Downloads folder.
 * Requires biometric auth on mobile.
 */
export async function copyVaultToDownloads(vaultPath: string, accountId?: string): Promise<void> {
  return invokeCommand('copy_vault_to_downloads', { vaultPath, ...(accountId ? { accountId } : {}) });
}

/**
 * Create a new directory inside the vault.
 * Requires biometric auth on mobile.
 */
export async function createVaultDir(path: string, accountId?: string): Promise<void> {
  return invokeCommand('create_vault_dir', { path, ...(accountId ? { accountId } : {}) });
}

/**
 * Set a PIN for vault access (used as biometric fallback).
 * Does NOT require biometric.
 */
export async function setVaultPin(pin: string): Promise<void> {
  return invokeCommand('set_vault_pin', { pin });
}

/**
 * Verify a PIN against the stored vault PIN hash.
 * Does NOT require biometric.
 */
export async function verifyVaultPin(pin: string): Promise<boolean> {
  return invokeCommand<boolean>('verify_vault_pin', { pin });
}

/**
 * Check whether a vault PIN has been set. Single source of truth: the
 * presence of the `.vault_pin` file in the app data directory. Replaces
 * the old `localStorage` `vault_pin_set` flag, which was lost on
 * Android "clear data" and could desync with the actual file state.
 */
export async function hasVaultPin(): Promise<boolean> {
  return invokeCommand<boolean>('has_vault_pin');
}

/**
 * Move a file or directory within the vault.
 * Requires biometric auth on mobile.
 */
export async function moveVaultItem(
  sourcePath: string,
  destPath: string,
  accountId?: string,
): Promise<void> {
  return invokeCommand('move_vault_item', { sourcePath, destPath, ...(accountId ? { accountId } : {}) });
}

/**
 * Rename a file or directory in the vault.
 * Requires biometric auth on mobile.
 */
export async function renameVaultItem(
  path: string,
  newName: string,
  accountId?: string,
): Promise<void> {
  return invokeCommand('rename_vault_item', { path, newName, ...(accountId ? { accountId } : {}) });
}

/**
 * Copy a file or directory within the vault.
 * Requires biometric auth on mobile.
 */
export async function copyVaultItem(
  sourcePath: string,
  destPath: string,
  accountId?: string,
): Promise<void> {
  return invokeCommand('copy_vault_item', { sourcePath, destPath, ...(accountId ? { accountId } : {}) });
}

/**
 * Get total size of the vault directory in bytes.
 */
export async function getVaultSize(): Promise<number> {
  return invokeCommand<number>('get_vault_size');
}

/**
 * Search vault files by glob pattern.
 * Requires biometric auth on mobile.
 */
export async function searchVault(
  dirPath: string,
  pattern: string,
  accountId?: string,
): Promise<string[]> {
  return invokeCommand<string[]>('search_vault', {
    dirPath,
    pattern,
    ...(accountId ? { accountId } : {}),
  });
}

/**
 * Get vault items filtered by category.
 * Requires biometric auth on mobile.
 */
export async function getVaultItemsByCategory(
  category: string,
  dirPath?: string,
  accountId?: string,
): Promise<VaultEntry[]> {
  return invokeCommand<VaultEntry[]>('get_vault_items_by_category', {
    category,
    ...(dirPath ? { dirPath } : {}),
    ...(accountId ? { accountId } : {}),
  });
}
