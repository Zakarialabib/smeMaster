import { getAllContacts, deleteContact } from "@features/contacts/db/contacts.ts";
import { mergeContacts as dbMergeContacts } from "@shared/services/db/db-invoke";

export interface MergeCandidate {
  keepId: string;
  keepEmail: string;
  keepName: string | null;
  mergeId: string;
  mergeEmail: string;
  mergeName: string | null;
}

export async function findMergeCandidates(): Promise<MergeCandidate[]> {
  const contacts = await getAllContacts(5000);
  const emailMap = new Map<string, typeof contacts>();

  for (const c of contacts) {
    const key = c.email.toLowerCase().trim();
    const existing = emailMap.get(key) ?? [];
    existing.push(c);
    emailMap.set(key, existing);
  }

  const candidates: MergeCandidate[] = [];
  for (const [, group] of emailMap) {
    if (group.length > 1) {
      const sorted = group.sort((a, b) => b.frequency - a.frequency);
      const keeper = sorted[0]!;
      for (let i = 1; i < sorted.length; i++) {
        const dup = sorted[i]!;
        candidates.push({
          keepId: keeper.id,
          keepEmail: keeper.email,
          keepName: keeper.display_name,
          mergeId: dup.id,
          mergeEmail: dup.email,
          mergeName: dup.display_name,
        });
      }
    }
  }

  return candidates;
}

export async function mergeContacts(keepId: string, mergeId: string): Promise<void> {
  await dbMergeContacts(keepId, mergeId);
  await deleteContact(mergeId);
}
