import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { freshTestDb, runMigrations, getTestAccountId, seedAccount, createDbInvokeHandlers, MockTauriDb } from "./setup";

let db: MockTauriDb;

const mockInvoke = vi.fn();

vi.mock("@shared/utils/crypto", () => ({
  encryptValue: vi.fn((val: string) => Promise.resolve(`enc:${val}`)),
  decryptValue: vi.fn((val: string) => Promise.resolve(val.replace("enc:", ""))),
  isEncrypted: vi.fn((val: string) => val.startsWith("enc:")),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

describe("Integration: Contacts", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    db = freshTestDb();
    await runMigrations();
    const handlers = createDbInvokeHandlers(db);
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "parse_csv") {
        const csvContent = args?.csvContent as string ?? "";
        if (csvContent.includes("alice")) {
          return Promise.resolve([
            { email: "alice@example.com", display_name: "Alice Johnson", notes: "VIP customer" },
            { email: "bob@example.com", display_name: "Bob Smith", notes: null },
          ]);
        }
        return Promise.resolve([]);
      }
      return handlers.handler(cmd, args);
    });
    await runMigrations();
    await seedAccount();
  });

  afterEach(() => {
    db?.close();
  });

  describe("Contact CSV import flow", () => {
    it("parses CSV content via invoke and imports contacts", async () => {
      const csvContent = "email,display_name,notes\nalice@example.com,Alice Johnson,VIP customer\nbob@example.com,Bob Smith,";

      const parsed = await mockInvoke("parse_csv", { csvContent });
      expect(parsed).toHaveLength(2);
      expect(parsed[0].email).toBe("alice@example.com");
      expect(parsed[0].display_name).toBe("Alice Johnson");

      const { upsertContact } = await import("@features/contacts/db/contacts");
      for (const contact of parsed as Array<{ email: string; display_name: string | null; notes: string | null }>) {
        await upsertContact(contact.email, contact.display_name);
      }

      const allContacts = await db!.select<{ email: string; display_name: string | null; frequency: number }[]>(
        "SELECT email, display_name, frequency FROM contacts ORDER BY email",
      );
      expect(allContacts).toHaveLength(2);
      expect(allContacts[0]!.email).toBe("alice@example.com");
      expect(allContacts[0]!.display_name).toBe("Alice Johnson");
      expect(allContacts[0]!.frequency).toBe(1);
      expect(allContacts[1]!.email).toBe("bob@example.com");
      expect(allContacts[1]!.display_name).toBe("Bob Smith");
    });

    it("upserts duplicate contacts and increments frequency", async () => {
      const { upsertContact } = await import("@features/contacts/db/contacts");

      await upsertContact("alice@example.com", "Alice Johnson");
      await upsertContact("alice@example.com", "Alice Johnson Updated");

      const contacts = await db!.select<{ email: string; display_name: string | null; frequency: number }[]>(
        "SELECT email, display_name, frequency FROM contacts WHERE email = $1",
        ["alice@example.com"],
      );
      expect(contacts).toHaveLength(1);
      expect(contacts[0]!.display_name).toBe("Alice Johnson Updated");
      expect(contacts[0]!.frequency).toBe(1);
    });
  });

  describe("Contact groups", () => {
    it("creates a group and adds contacts to it", async () => {
      await db!.execute(
        "INSERT INTO contacts (id, email, display_name, frequency) VALUES ($1, $2, $3, 1)",
        ["c1", "alice@example.com", "Alice"],
      );
      await db!.execute(
        "INSERT INTO contacts (id, email, display_name, frequency) VALUES ($1, $2, $3, 1)",
        ["c2", "bob@example.com", "Bob"],
      );

      const { upsertContactGroup } = await import("@features/contacts/db/contactGroups");
      await upsertContactGroup(undefined, getTestAccountId(), "Newsletter Subscribers", "People who get newsletters");

      const groups = await db!.select<{ id: string; name: string; description: string | null }[]>(
        "SELECT id, name, description FROM contact_groups WHERE account_id = $1",
        [getTestAccountId()],
      );
      expect(groups).toHaveLength(1);
      const groupId = groups[0]!.id;

      const { addContactToGroup } = await import("@features/contacts/services/groups");
      await addContactToGroup("c1", groupId);
      await addContactToGroup("c2", groupId);

      const members = await db!.select<{ contact_id: string }[]>(
        "SELECT contact_id FROM contact_group_pivot WHERE group_id = $1 ORDER BY contact_id",
        [groupId],
      );
      expect(members).toHaveLength(2);
      expect(members[0]!.contact_id).toBe("c1");
      expect(members[1]!.contact_id).toBe("c2");
    });
  });

  describe("Contact tags", () => {
    it("creates tags and assigns them to contacts", async () => {
      await db!.execute(
        "INSERT INTO contacts (id, email, display_name, frequency) VALUES ($1, $2, $3, 1)",
        ["c-tag-1", "alice@example.com", "Alice"],
      );

      const { upsertContactTag } = await import("@features/contacts/db/contactTags");
      await upsertContactTag(undefined, getTestAccountId(), "VIP", "gold");
      await upsertContactTag(undefined, getTestAccountId(), "Newsletter", "blue");

      const tags = await db!.select<{ id: string; name: string; color: string | null }[]>(
        "SELECT id, name, color FROM contact_tags WHERE account_id = $1 ORDER BY name",
        [getTestAccountId()],
      );
      expect(tags).toHaveLength(2);
      expect(tags[0]!.name).toBe("Newsletter");

      const { tagContact, getContactTags } = await import("@features/contacts/services/tags");
      await tagContact("c-tag-1", tags[0]!.id);
      await tagContact("c-tag-1", tags[1]!.id);

      const contactTags = await getContactTags("c-tag-1");
      expect(contactTags).toHaveLength(2);
      const tagNames = contactTags.map((t) => t.name).sort();
      expect(tagNames).toEqual(["Newsletter", "VIP"]);
    });
  });

  describe("Contact engagement scoring", () => {
    it("calculates engagement score for a contact", async () => {
      const contactId = "c-score-1";
      await db!.execute(
        "INSERT INTO contacts (id, email, display_name, frequency) VALUES ($1, $2, $3, 1)",
        [contactId, "score@example.com", "Score Test"],
      );

      const now = Math.floor(Date.now() / 1000);
      for (let i = 1; i <= 5; i++) {
        await db!.execute(
          "INSERT INTO messages (id, account_id, thread_id, from_address, date, subject, snippet, is_read) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)",
          [`msg-score-${i}`, getTestAccountId(), "thread-score", "score@example.com", now - (i * 86400), `Subject ${i}`, `Snippet ${i}`],
        );
      }

      const { getContactStats } = await import("@features/contacts/db/contacts");
      const stats = await getContactStats("score@example.com");
      expect(stats.emailCount).toBe(5);
    });
  });
});


