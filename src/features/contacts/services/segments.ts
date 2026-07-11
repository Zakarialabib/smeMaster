import { searchContacts } from "@features/contacts/db/contacts.ts";
import { executeSearchQuery, createDynamicSegment as dbCreateDynamicSegment, updateDynamicSegmentRefresh as dbUpdateDynamicSegmentRefresh } from "@shared/services/db/db-invoke";

export async function evaluateSegmentQuery(accountId: string, query: string): Promise<string[]> {
  const trimmed = query.trim().toLowerCase();

  if (trimmed.startsWith("from:")) {
    const domain = trimmed.slice(5).trim();
    if (domain.startsWith("@")) {
      const contacts = await searchContacts(domain, 1000);
      return contacts.map((c) => c.id);
    }
  }

  if (trimmed === "has:attachment") {
    const rows = await executeSearchQuery(
      `SELECT DISTINCT m.from_address as contact_id
       FROM messages m
       INNER JOIN attachments a ON a.account_id = m.account_id AND a.id = m.id
       WHERE m.account_id = $1 AND a.is_inline = 0`,
      [accountId],
    );
    return rows.map((r) => r.contact_id as string);
  }

  if (trimmed.startsWith("last_contact:<")) {
    const days = parseInt(trimmed.slice("last_contact:<".length), 10);
    if (!isNaN(days)) {
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      const rows = await executeSearchQuery(
        `SELECT id FROM contacts
         WHERE last_contacted_at IS NOT NULL AND last_contacted_at < $1
         LIMIT 1000`,
        [cutoff],
      );
      return rows.map((r) => r.id as string);
    }
  }

  if (trimmed.startsWith("health:")) {
    const status = trimmed.slice(7).trim();
    if (["cold", "lukewarm", "warm", "hot"].includes(status)) {
      const rows = await executeSearchQuery(
        "SELECT id FROM contacts WHERE health_status = $1 LIMIT 1000",
        [status],
      );
      return rows.map((r) => r.id as string);
    }
  }

  if (trimmed.startsWith("score>=")) {
    const threshold = parseFloat(trimmed.slice(7).trim());
    if (!isNaN(threshold)) {
      const rows = await executeSearchQuery(
        "SELECT id FROM contacts WHERE engagement_score >= $1 LIMIT 1000",
        [threshold],
      );
      return rows.map((r) => r.id as string);
    }
  }

  if (trimmed.startsWith("score<=")) {
    const threshold = parseFloat(trimmed.slice(7).trim());
    if (!isNaN(threshold)) {
      const rows = await executeSearchQuery(
        "SELECT id FROM contacts WHERE engagement_score <= $1 LIMIT 1000",
        [threshold],
      );
      return rows.map((r) => r.id as string);
    }
  }

  const contacts = await searchContacts(trimmed, 100);
  return contacts.map((c) => c.id);
}

export interface DynamicSegment {
  id: string;
  company_id: string;
  name: string;
  query: string;
  refreshed_at: number | null;
}

export async function getDynamicSegments(companyId: string): Promise<DynamicSegment[]> {
  const rows = await executeSearchQuery(
    "SELECT * FROM dynamic_segments WHERE company_id = $1 ORDER BY name ASC",
    [companyId],
  );
  return rows as unknown as DynamicSegment[];
}

export async function createDynamicSegment(
  accountId: string,
  name: string,
  query: string,
): Promise<string> {
  return dbCreateDynamicSegment(accountId, name, query);
}

export async function refreshDynamicSegment(segmentId: string): Promise<string[]> {
  const segmentRows = await executeSearchQuery(
    "SELECT * FROM dynamic_segments WHERE id = $1",
    [segmentId],
  );
  const segment = (segmentRows as unknown as DynamicSegment[])[0] ?? null;

  if (!segment) return [];

  const contactIds = await evaluateSegmentQuery(segment.company_id, segment.query);
  await dbUpdateDynamicSegmentRefresh(segmentId);

  return contactIds;
}

export async function getDynamicSegmentMembers(segmentId: string): Promise<string[]> {
  const segmentRows = await executeSearchQuery(
    "SELECT * FROM dynamic_segments WHERE id = $1",
    [segmentId],
  );
  const segment = (segmentRows as unknown as DynamicSegment[])[0] ?? null;

  if (!segment) return [];

  return evaluateSegmentQuery(segment.company_id, segment.query);
}

export async function refreshAllDynamicSegments(accountId: string): Promise<void> {
  const segments = await getDynamicSegments(accountId);

  for (const segment of segments) {
    try {
      await refreshDynamicSegment(segment.id);
    } catch (err) {
      console.error(`Failed to refresh dynamic segment ${segment.id}:`, err);
    }
  }
}
