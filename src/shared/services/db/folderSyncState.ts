import {
  getFolderSyncState as dbInvokeGetFolderSyncState,
  upsertFolderSyncState as dbInvokeUpsertFolderSyncState,
  deleteFolderSyncState as dbInvokeDeleteFolderSyncState,
  clearFolderSyncStates as dbInvokeClearFolderSyncStates,
  listFolderSyncStates as dbInvokeListFolderSyncStates,
  type FolderSyncState,
} from "@shared/services/db/db-invoke";

export type { FolderSyncState };

export async function getFolderSyncState(
  accountId: string,
  folderPath: string,
): Promise<FolderSyncState | null> {
  return dbInvokeGetFolderSyncState(accountId, folderPath);
}

export async function upsertFolderSyncState(
  state: FolderSyncState,
): Promise<void> {
  await dbInvokeUpsertFolderSyncState({
    accountId: state.account_id,
    folderPath: state.folder_path,
    uidvalidity: state.uidvalidity,
    lastUid: state.last_uid,
    modseq: state.modseq,
    lastSyncAt: state.last_sync_at,
  });
}

/**
 * Delete a specific folder sync state.
 * Uses raw SQL since there is no db-invoke delete equivalent.
 */
export async function deleteFolderSyncState(
  accountId: string,
  folderPath: string,
): Promise<void> {
  await dbInvokeDeleteFolderSyncState(accountId, folderPath);
}

/**
 * Clear all folder sync states for an account.
 * Uses raw SQL since there is no db-invoke bulk-delete equivalent.
 */
export async function clearAllFolderSyncStates(
  accountId: string,
): Promise<void> {
  await dbInvokeClearFolderSyncStates(accountId);
}

/**
 * Get all folder sync states for an account.
 * Uses raw SQL since there is no db-invoke list-all equivalent.
 */
export async function getAllFolderSyncStates(
  accountId: string,
): Promise<FolderSyncState[]> {
  return dbInvokeListFolderSyncStates(accountId);
}
