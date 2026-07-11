import { invokeCommand } from './command';

import type { AiCache, AiConfig } from '../schema';

import type { UpsertAiCacheRequest } from './core';

export async function getAiCache(
  accountId: string,
  threadId: string,
  cacheType: string,
): Promise<AiCache | null> {
  return invokeCommand<AiCache | null>('db_get_ai_cache', {
    accountId,
    threadId,
    cacheType,
  });
}

export async function upsertAiCache(entry: UpsertAiCacheRequest): Promise<void> {
  return invokeCommand<void>('db_upsert_ai_cache', { entry });
}

export async function setAiCache(
  accountId: string,
  threadId: string,
  cacheType: string,
  content: string,
): Promise<void> {
  return invokeCommand<void>('db_set_ai_cache', { accountId, threadId, cacheType, content });
}

export async function deleteAiCache(id: string): Promise<void> {
  return invokeCommand<void>('db_delete_ai_cache', { id });
}

export async function listAiConfigs(accountId: string): Promise<AiConfig[]> {
  return invokeCommand<AiConfig[]>('db_list_ai_configs', { accountId });
}
