import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@features/contacts/db/contacts.ts", () => ({
  getAllContacts: vi.fn(),
  deleteContact: vi.fn(),
}));

vi.mock("@shared/services/db/db-invoke", () => ({
  mergeContacts: vi.fn(),
}));

const { getAllContacts, deleteContact } = await import("@features/contacts/db/contacts.ts");
const { mergeContacts: dbMergeContacts } = await import("@shared/services/db/db-invoke");
const { findMergeCandidates, mergeContacts } = await import("./merge");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeContact(overrides: {
  id?: string;
  email?: string;
  display_name?: string | null;
  frequency?: number;
}) {
  return {
    id: overrides.id ?? "id-1",
    email: overrides.email ?? "test@example.com",
    display_name: overrides.display_name ?? null,
    avatar_url: null,
    frequency: overrides.frequency ?? 1,
    last_contacted_at: null,
    notes: null,
  };
}

describe("findMergeCandidates", () => {
  it("returns empty array when no duplicates exist", async () => {
    vi.mocked(getAllContacts).mockResolvedValue([
      makeContact({ id: "1", email: "a@test.com" }),
      makeContact({ id: "2", email: "b@test.com" }),
    ]);

    const candidates = await findMergeCandidates();
    expect(candidates).toEqual([]);
  });

  it("returns merge candidates for contacts with the same email", async () => {
    vi.mocked(getAllContacts).mockResolvedValue([
      makeContact({ id: "1", email: "dup@test.com", frequency: 10, display_name: "Alice" }),
      makeContact({ id: "2", email: "dup@test.com", frequency: 2, display_name: "Alice2" }),
    ]);

    const candidates = await findMergeCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.keepId).toBe("1"); // higher frequency
    expect(candidates[0]!.mergeId).toBe("2");
    expect(candidates[0]!.keepEmail).toBe("dup@test.com");
  });

  it("keeps the contact with the highest frequency", async () => {
    vi.mocked(getAllContacts).mockResolvedValue([
      makeContact({ id: "a", email: "x@test.com", frequency: 1 }),
      makeContact({ id: "b", email: "x@test.com", frequency: 50 }),
      makeContact({ id: "c", email: "x@test.com", frequency: 10 }),
    ]);

    const candidates = await findMergeCandidates();
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.keepId).toBe("b");
    expect(candidates[0]!.mergeId).toBe("c");
    expect(candidates[1]!.keepId).toBe("b");
    expect(candidates[1]!.mergeId).toBe("a");
  });

  it("normalizes emails to lowercase and trims whitespace", async () => {
    vi.mocked(getAllContacts).mockResolvedValue([
      makeContact({ id: "1", email: "  DUP@Test.com  " }),
      makeContact({ id: "2", email: "dup@test.com" }),
    ]);

    const candidates = await findMergeCandidates();
    expect(candidates).toHaveLength(1);
  });

  it("groups different email duplicates separately", async () => {
    vi.mocked(getAllContacts).mockResolvedValue([
      makeContact({ id: "1", email: "a@test.com", frequency: 5 }),
      makeContact({ id: "2", email: "a@test.com", frequency: 1 }),
      makeContact({ id: "3", email: "b@test.com", frequency: 8 }),
      makeContact({ id: "4", email: "b@test.com", frequency: 3 }),
    ]);

    const candidates = await findMergeCandidates();
    expect(candidates).toHaveLength(2);
  });

  it("includes names in the candidate output", async () => {
    vi.mocked(getAllContacts).mockResolvedValue([
      makeContact({ id: "1", email: "x@test.com", display_name: "Primary", frequency: 10 }),
      makeContact({ id: "2", email: "x@test.com", display_name: "Duplicate", frequency: 2 }),
    ]);

    const candidates = await findMergeCandidates();
    expect(candidates[0]!.keepName).toBe("Primary");
    expect(candidates[0]!.mergeName).toBe("Duplicate");
  });
});

describe("mergeContacts", () => {
  it("calls dbMergeContacts then deletes the merged contact", async () => {
    await mergeContacts("keep-id", "merge-id");
    expect(dbMergeContacts).toHaveBeenCalledWith("keep-id", "merge-id");
    expect(deleteContact).toHaveBeenCalledWith("merge-id");
    expect(dbMergeContacts).toHaveBeenCalledTimes(1);
    expect(deleteContact).toHaveBeenCalledTimes(1);
  });
});
