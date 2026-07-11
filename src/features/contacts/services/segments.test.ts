import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@features/contacts/db/contacts.ts", () => ({
  searchContacts: vi.fn(),
}));

vi.mock("@shared/services/db/db-invoke", () => ({
  executeSearchQuery: vi.fn(),
  createDynamicSegment: vi.fn(),
  updateDynamicSegmentRefresh: vi.fn(),
}));

const { searchContacts } = await import("@features/contacts/db/contacts.ts");
const {
  executeSearchQuery,
  createDynamicSegment: dbCreateDynamicSegment,
  updateDynamicSegmentRefresh: dbUpdateDynamicSegmentRefresh,
} = await import("@shared/services/db/db-invoke");

const {
  evaluateSegmentQuery,
  getDynamicSegments,
  createDynamicSegment,
  refreshDynamicSegment,
  getDynamicSegmentMembers,
  refreshAllDynamicSegments,
} = await import("./segments");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("evaluateSegmentQuery", () => {
  it("delegates 'from:@domain' queries to searchContacts", async () => {
    vi.mocked(searchContacts).mockResolvedValue([
      { id: "c1" } as never,
      { id: "c2" } as never,
    ]);

    const ids = await evaluateSegmentQuery("acc1", "from:@example.com");
    expect(searchContacts).toHaveBeenCalledWith("@example.com", 1000);
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("trims and lowercases the query before parsing", async () => {
    vi.mocked(searchContacts).mockResolvedValue([{ id: "c1" } as never]);

    const ids = await evaluateSegmentQuery("acc1", "  FROM:@TEST.COM  ");
    expect(searchContacts).toHaveBeenCalledWith("@test.com", 1000);
    expect(ids).toEqual(["c1"]);
  });

  it("handles 'has:attachment' queries", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([
      { contact_id: "c1" },
      { contact_id: "c2" },
    ]);

    const ids = await evaluateSegmentQuery("acc1", "has:attachment");
    expect(executeSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM messages m"),
      ["acc1"],
    );
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("handles 'last_contact:<N' queries with correct cutoff", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([{ id: "c1" }]);

    const ids = await evaluateSegmentQuery("acc1", "last_contact:<30");
    expect(executeSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining("last_contacted_at <"),
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(ids).toEqual(["c1"]);
  });

  it("falls back to searchContacts when 'last_contact:<' has non-numeric value", async () => {
    vi.mocked(searchContacts).mockResolvedValue([{ id: "c1" } as never]);
    const ids = await evaluateSegmentQuery("acc1", "last_contact:<abc");
    // Non-numeric days → block skipped → falls through to searchContacts fallback
    expect(searchContacts).toHaveBeenCalledWith("last_contact:<abc", 100);
    expect(ids).toEqual(["c1"]);
  });

  it("handles 'health:cold' queries", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([{ id: "c1" }]);

    const ids = await evaluateSegmentQuery("acc1", "health:cold");
    expect(executeSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining("health_status"),
      ["cold"],
    );
    expect(ids).toEqual(["c1"]);
  });

  it("falls back to searchContacts for invalid health statuses", async () => {
    vi.mocked(searchContacts).mockResolvedValue([{ id: "c1" } as never]);
    const ids = await evaluateSegmentQuery("acc1", "health:invalid");
    // Invalid status → block skipped → falls through to searchContacts fallback
    expect(searchContacts).toHaveBeenCalledWith("health:invalid", 100);
    expect(ids).toEqual(["c1"]);
  });

  it("handles all valid health statuses", async () => {
    for (const status of ["cold", "lukewarm", "warm", "hot"]) {
      vi.mocked(executeSearchQuery).mockResolvedValue([]);
      const ids = await evaluateSegmentQuery("acc1", `health:${status}`);
      expect(ids).toEqual([]);
    }
    expect(executeSearchQuery).toHaveBeenCalledTimes(4);
  });

  it("handles 'score>=N' queries", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([{ id: "c1" }, { id: "c2" }]);

    const ids = await evaluateSegmentQuery("acc1", "score>=50");
    expect(executeSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining("engagement_score >="),
      [50],
    );
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("handles 'score<=N' queries", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([{ id: "c1" }]);

    const ids = await evaluateSegmentQuery("acc1", "score<=25");
    expect(executeSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining("engagement_score <="),
      [25],
    );
    expect(ids).toEqual(["c1"]);
  });

  it("falls back to searchContacts for non-numeric score values", async () => {
    vi.mocked(searchContacts).mockResolvedValue([{ id: "c1" } as never]);
    const ids = await evaluateSegmentQuery("acc1", "score>=abc");
    // Non-numeric threshold → block skipped → falls through to searchContacts fallback
    expect(searchContacts).toHaveBeenCalledWith("score>=abc", 100);
    expect(ids).toEqual(["c1"]);
  });

  it("falls back to searchContacts for unrecognized queries", async () => {
    vi.mocked(searchContacts).mockResolvedValue([{ id: "c1" } as never]);

    const ids = await evaluateSegmentQuery("acc1", "some free text query");
    expect(searchContacts).toHaveBeenCalledWith("some free text query", 100);
    expect(ids).toEqual(["c1"]);
  });
});

describe("getDynamicSegments", () => {
  it("returns dynamic segments for the account", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([
      { id: "s1", name: "VIP" },
      { id: "s2", name: "Inactive" },
    ]);

    const segments = await getDynamicSegments("acc1");
    expect(segments).toHaveLength(2);
    expect(executeSearchQuery).toHaveBeenCalledWith(
      expect.stringContaining("dynamic_segments"),
      ["acc1"],
    );
  });
});

describe("createDynamicSegment", () => {
  it("delegates to dbCreateDynamicSegment", async () => {
    vi.mocked(dbCreateDynamicSegment).mockResolvedValue("seg-id");

    const id = await createDynamicSegment("acc1", "My Segment", "health:hot");
    expect(id).toBe("seg-id");
    expect(dbCreateDynamicSegment).toHaveBeenCalledWith("acc1", "My Segment", "health:hot");
  });
});

describe("refreshDynamicSegment", () => {
  it("returns empty array when segment not found", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([]);

    const ids = await refreshDynamicSegment("nonexistent");
    expect(ids).toEqual([]);
  });

  it("evaluates segment query and updates refresh timestamp", async () => {
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([{ id: "s1", account_id: "acc1", query: "health:hot" }])
      .mockResolvedValueOnce([{ id: "c1" }]);
    vi.mocked(dbUpdateDynamicSegmentRefresh).mockResolvedValue(undefined);

    const ids = await refreshDynamicSegment("s1");
    expect(ids).toEqual(["c1"]);
    expect(dbUpdateDynamicSegmentRefresh).toHaveBeenCalledWith("s1");
  });
});

describe("getDynamicSegmentMembers", () => {
  it("returns empty array when segment not found", async () => {
    vi.mocked(executeSearchQuery).mockResolvedValue([]);

    const ids = await getDynamicSegmentMembers("nonexistent");
    expect(ids).toEqual([]);
  });

  it("evaluates the segment query to get members", async () => {
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([{ id: "s1", account_id: "acc1", query: "from:@vip.com" }])
      .mockResolvedValueOnce([{ id: "vip1" }]);
    vi.mocked(searchContacts).mockResolvedValue([{ id: "vip1" } as never]);

    const ids = await getDynamicSegmentMembers("s1");
    expect(ids).toEqual(["vip1"]);
  });
});

describe("refreshAllDynamicSegments", () => {
  it("refreshes all segments successfully", async () => {
    vi.mocked(executeSearchQuery)
      // getDynamicSegments
      .mockResolvedValueOnce([
        { id: "s1", account_id: "acc1", query: "health:cold" },
        { id: "s2", account_id: "acc1", query: "health:hot" },
      ])
      // refreshDynamicSegment s1 → segment lookup
      .mockResolvedValueOnce([{ id: "s1", account_id: "acc1", query: "health:cold" }])
      // refreshDynamicSegment s1 → evaluateSegmentQuery health:cold
      .mockResolvedValueOnce([{ id: "c1" }])
      // refreshDynamicSegment s2 → segment lookup
      .mockResolvedValueOnce([{ id: "s2", account_id: "acc1", query: "health:hot" }])
      // refreshDynamicSegment s2 → evaluateSegmentQuery health:hot
      .mockResolvedValueOnce([{ id: "c2" }]);

    await refreshAllDynamicSegments("acc1");
    expect(dbUpdateDynamicSegmentRefresh).toHaveBeenCalledTimes(2);
    expect(dbUpdateDynamicSegmentRefresh).toHaveBeenCalledWith("s1");
    expect(dbUpdateDynamicSegmentRefresh).toHaveBeenCalledWith("s2");
  });

  it("continues to next segment when one fails", async () => {
    vi.mocked(executeSearchQuery)
      // getDynamicSegments
      .mockResolvedValueOnce([
        { id: "s1", account_id: "acc1", query: "health:cold" },
        { id: "s2", account_id: "acc1", query: "health:hot" },
      ])
      // refreshDynamicSegment s1 → segment lookup → throws
      .mockRejectedValueOnce(new Error("DB error"))
      // refreshDynamicSegment s2 → segment lookup
      .mockResolvedValueOnce([{ id: "s2", account_id: "acc1", query: "health:hot" }])
      // refreshDynamicSegment s2 → evaluateSegmentQuery health:hot
      .mockResolvedValueOnce([{ id: "c2" }]);

    await refreshAllDynamicSegments("acc1");
    // Only s2 should have been refreshed (s1 lookup throws)
    expect(dbUpdateDynamicSegmentRefresh).toHaveBeenCalledTimes(1);
    expect(dbUpdateDynamicSegmentRefresh).toHaveBeenCalledWith("s2");
  });
});
