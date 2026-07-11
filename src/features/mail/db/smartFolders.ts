import {
  listSmartFolders as dbListSmartFolders,
  upsertSmartFolder as dbUpsertSmartFolder,
  deleteSmartFolder as dbDeleteSmartFolder,
  updateSmartFolder as dbUpdateSmartFolder,
  updateSmartFolderSortOrder as dbUpdateSmartFolderSortOrder,
  type SmartFolder,
  type UpdateFields,
} from "@shared/services/db/db-invoke";

export type DbSmartFolder = SmartFolder;

/**
 * Return global (account_id IS NULL) + account-specific folders, ordered by sort_order.
 */
export async function getSmartFolders(
  accountId?: string,
): Promise<DbSmartFolder[]> {
  return dbListSmartFolders(accountId);
}

export async function getSmartFolderById(
  id: string,
): Promise<DbSmartFolder | null> {
  const folders = await dbListSmartFolders();
  return folders.find((f) => f.id === id) ?? null;
}

export async function insertSmartFolder(folder: {
  name: string;
  query: string;
  accountId?: string;
  icon?: string;
  color?: string;
}): Promise<string> {
  const created = await dbUpsertSmartFolder({
    accountId: folder.accountId ?? null,
    name: folder.name,
    query: folder.query,
    icon: folder.icon ?? "Search",
    color: folder.color ?? null,
  });
  return created.id;
}

export async function updateSmartFolder(
  id: string,
  updates: { name?: string; query?: string; icon?: string; color?: string },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.query !== undefined) set.query = updates.query;
  if (updates.icon !== undefined) set.icon = updates.icon;
  if (updates.color !== undefined) set.color = updates.color;
  if (Object.keys(set).length === 0) return;

  await dbUpdateSmartFolder(id, { set, unset: [] } satisfies UpdateFields);
}

export async function deleteSmartFolder(id: string): Promise<void> {
  return dbDeleteSmartFolder(id);
}

export async function updateSmartFolderSortOrder(
  orders: { id: string; sortOrder: number }[],
): Promise<void> {
  return dbUpdateSmartFolderSortOrder(orders);
}
