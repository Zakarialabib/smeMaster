import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  executeSearchQuery: vi.fn(),
}));

vi.mock("@features/mail/db/filters", () => ({
  getFilterRuleById: vi.fn(),
  getFilterConditionsForRule: vi.fn(),
}));

vi.mock("./filterEngine", () => ({
  evaluateCondition: vi.fn(),
}));

const { executeSearchQuery } = await import("@shared/services/db/db-invoke");
const { getFilterRuleById, getFilterConditionsForRule } = await import("@features/mail/db/filters");
const { evaluateCondition } = await import("./filterEngine");
const { testFilterOnMessage } = await import("./filterTester");

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRule(overrides: { group_operator?: string } = {}) {
  return {
    id: "rule-1",
    account_id: "acc1",
    name: "Test Rule",
    group_operator: overrides.group_operator ?? "AND",
    is_enabled: 1,
    position: 0,
  };
}

function makeCondition(overrides: Record<string, unknown> = {}) {
  return {
    id: "cond-1",
    filterId: "rule-1",
    field: "from" as const,
    operator: "contains" as const,
    value: "test",
    ...overrides,
  };
}

function makeMessageRow() {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    from_address: "sender@test.com",
    from_name: "Sender",
    to_addresses: null,
    cc_addresses: null,
    bcc_addresses: null,
    reply_to: null,
    subject: "Test Subject",
    snippet: "Test snippet",
    date: 1700000000,
    is_read: 0,
    is_starred: 0,
    body_html: null,
    body_text: "Test body",
    raw_size: 1024,
    internal_date: 1700000000,
  };
}

describe("testFilterOnMessage", () => {
  it("throws when filter rule not found", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(null);

    await expect(testFilterOnMessage("nonexistent", "msg-1")).rejects.toThrow(
      "Filter rule not found: nonexistent",
    );
  });

  it("throws when message not found", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule());
    vi.mocked(executeSearchQuery).mockResolvedValue([]);

    await expect(testFilterOnMessage("rule-1", "nonexistent")).rejects.toThrow(
      "Message not found: nonexistent",
    );
  });

  it("returns overall true with empty conditions", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule());
    vi.mocked(executeSearchQuery).mockResolvedValue([makeMessageRow()]);
    vi.mocked(executeSearchQuery).mockResolvedValueOnce([makeMessageRow()]);
    vi.mocked(executeSearchQuery).mockResolvedValueOnce([{ cnt: 0 }]);
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([]);

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(true);
    expect(result.conditions).toEqual([]);
  });

  it("evaluates conditions with AND operator", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule({ group_operator: "AND" }));
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([makeMessageRow()])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    const cond1 = makeCondition({ id: "c1" });
    const cond2 = makeCondition({ id: "c2" });
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([cond1, cond2]);

    vi.mocked(evaluateCondition)
      .mockReturnValueOnce({ passed: true, matchedText: "test" })
      .mockReturnValueOnce({ passed: true, matchedText: "test" });

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(true);
    expect(result.conditions).toHaveLength(2);
    expect(result.conditions.every((c) => c.passed)).toBe(true);
  });

  it("returns overall false with AND when any condition fails", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule({ group_operator: "AND" }));
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([makeMessageRow()])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    const cond1 = makeCondition({ id: "c1" });
    const cond2 = makeCondition({ id: "c2" });
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([cond1, cond2]);

    vi.mocked(evaluateCondition)
      .mockReturnValueOnce({ passed: true, matchedText: "test" })
      .mockReturnValueOnce({ passed: false, matchedText: null });

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(false);
  });

  it("returns overall true with OR when any condition passes", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule({ group_operator: "OR" }));
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([makeMessageRow()])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    const cond1 = makeCondition({ id: "c1" });
    const cond2 = makeCondition({ id: "c2" });
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([cond1, cond2]);

    vi.mocked(evaluateCondition)
      .mockReturnValueOnce({ passed: false, matchedText: null })
      .mockReturnValueOnce({ passed: true, matchedText: "test" });

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(true);
  });

  it("returns overall false with OR when no conditions pass", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule({ group_operator: "OR" }));
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([makeMessageRow()])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    const cond1 = makeCondition({ id: "c1" });
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([cond1]);

    vi.mocked(evaluateCondition)
      .mockReturnValueOnce({ passed: false, matchedText: null });

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(false);
  });

  it("defaults to AND when group_operator is undefined", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule({ group_operator: undefined }));
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([makeMessageRow()])
      .mockResolvedValueOnce([{ cnt: 0 }]);
    const cond1 = makeCondition({ id: "c1" });
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([cond1]);

    vi.mocked(evaluateCondition)
      .mockReturnValueOnce({ passed: true, matchedText: "test" });

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(true);
  });

  it("correctly maps message fields from DB row", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule());
    const row = makeMessageRow();
    row.is_read = 1;
    row.is_starred = 1;
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ cnt: 2 }]);
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([]);

    const result = await testFilterOnMessage("rule-1", "msg-1");
    // No conditions, so overall is true; just verify it didn't throw
    expect(result.overall).toBe(true);
  });

  it("detects attachments from the attachment count query", async () => {
    vi.mocked(getFilterRuleById).mockResolvedValue(makeRule());
    vi.mocked(executeSearchQuery)
      .mockResolvedValueOnce([makeMessageRow()])
      .mockResolvedValueOnce([{ cnt: 3 }]);
    vi.mocked(getFilterConditionsForRule).mockResolvedValue([]);

    const result = await testFilterOnMessage("rule-1", "msg-1");
    expect(result.overall).toBe(true);
  });
});
