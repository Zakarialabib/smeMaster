import { getContactActivity as dbGetContactActivity } from "@shared/services/db/db-invoke";

export interface ActivityEvent {
  type: "email" | "task" | "calendar";
  date: number;
  summary: string;
  id: string;
}

export async function getContactActivity(
  companyId: string,
  email: string,
  limit = 20,
): Promise<ActivityEvent[]> {
  return dbGetContactActivity(companyId, email, limit) as Promise<ActivityEvent[]>;
}
