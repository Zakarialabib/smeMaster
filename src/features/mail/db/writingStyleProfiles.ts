import {
  listWritingStyleProfiles as dbList,
  upsertWritingStyleProfile as dbUpsert,
  deleteWritingStyleProfile as dbDelete,
  type WritingStyleProfile,
} from "@shared/services/db/db-invoke";

export type DbWritingStyleProfile = WritingStyleProfile;

export async function getWritingStyleProfile(
  accountId: string,
): Promise<DbWritingStyleProfile | null> {
  const profiles = await dbList(accountId);
  return profiles[0] ?? null;
}

export async function upsertWritingStyleProfile(
  accountId: string,
  profileText: string,
  sampleCount: number,
): Promise<void> {
  await dbUpsert({ accountId, profileText, sampleCount });
}

export async function deleteWritingStyleProfile(
  accountId: string,
): Promise<void> {
  const profiles = await dbList(accountId);
  const first = profiles[0];
  if (first) {
    await dbDelete(first.id);
  }
}
