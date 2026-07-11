import {
  listSegments,
  upsertContactSegment as dbUpsertContactSegment,
  deleteContactSegment as dbDeleteContactSegment,
} from "../../../shared/services/db/db-invoke";

export interface DbContactSegment {
  id: string;
  company_id: string;
  name: string;
  query: string;
  created_at: number;
}

export async function getContactSegments(companyId: string): Promise<DbContactSegment[]> {
  return listSegments(companyId);
}

export async function upsertContactSegment(
  id: string | undefined,
  companyId: string,
  name: string,
  query: string,
): Promise<string> {
  return dbUpsertContactSegment(id ?? null, companyId, name, query);
}

export async function deleteContactSegment(id: string, companyId: string): Promise<void> {
  await dbDeleteContactSegment(id, companyId);
}
