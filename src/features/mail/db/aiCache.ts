import {
  getAiCache as dbGetAiCache,
  setAiCache as dbSetAiCache,
  deleteAiCache as dbDeleteAiCache,
} from "@/shared/services/db/db-invoke";

export async function getAiCache(
  accountId: string, threadId: string, type: string,
): Promise<string | null> {
  const result = await dbGetAiCache(accountId, threadId, type);
  return result?.content ?? null;
}

export const setAiCache = dbSetAiCache;

export async function deleteAiCache(
  accountId: string, threadId: string, type: string,
): Promise<void> {
  await dbDeleteAiCache(`${accountId}:${threadId}:${type}`);
}
