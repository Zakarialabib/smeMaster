import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDayDiff, formatDueDate, getDueDateColor, bucketDueDateLabel } from "./dueDate";

// Pin "now" so the day-bucket math is deterministic.
const FAKE_NOW = new Date(2026, 5, 4, 12, 0, 0); // 2026-06-04 noon local

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

function ts(year: number, month: number, day: number): number {
  return Math.floor(new Date(year, month - 1, day, 9, 0, 0).getTime() / 1000);
}

describe("getDayDiff", () => {
  it("returns 0 for today", () => {
    expect(getDayDiff(ts(2026, 6, 4))).toBe(0);
  });

  it("returns 1 for tomorrow", () => {
    expect(getDayDiff(ts(2026, 6, 5))).toBe(1);
  });

  it("returns -1 for yesterday", () => {
    expect(getDayDiff(ts(2026, 6, 3))).toBe(-1);
  });

  it("returns -5 for a date 5 days in the past", () => {
    expect(getDayDiff(ts(2026, 5, 30))).toBe(-5);
  });

  it("returns 30 for a date 30 days in the future", () => {
    expect(getDayDiff(ts(2026, 7, 4))).toBe(30);
  });
});

describe("formatDueDate", () => {
  it("returns 'Today' for today", () => {
    expect(formatDueDate(ts(2026, 6, 4))).toBe("Today");
  });

  it("returns 'Tomorrow' for tomorrow", () => {
    expect(formatDueDate(ts(2026, 6, 5))).toBe("Tomorrow");
  });

  it("returns 'Nd' for N days in the next 7", () => {
    expect(formatDueDate(ts(2026, 6, 9))).toBe("5d");
  });

  it("returns 'Nd overdue' for N days in the past", () => {
    expect(formatDueDate(ts(2026, 5, 30))).toBe("5d overdue");
  });

  it("returns localized month + day for dates more than 7 days out", () => {
    expect(formatDueDate(ts(2026, 7, 1))).toBe("Jul 1");
  });
});

describe("getDueDateColor", () => {
  it("returns red for overdue", () => {
    expect(getDueDateColor(ts(2026, 6, 1))).toContain("text-red-500");
  });
  it("returns amber for today or tomorrow", () => {
    expect(getDueDateColor(ts(2026, 6, 4))).toContain("text-amber-500");
    expect(getDueDateColor(ts(2026, 6, 5))).toContain("text-amber-500");
  });
  it("returns muted for later", () => {
    expect(getDueDateColor(ts(2026, 6, 10))).toContain("text-text-tertiary");
  });
});

describe("bucketDueDateLabel", () => {
  it("classifies each bucket correctly", () => {
    expect(bucketDueDateLabel(ts(2026, 6, 1))).toBe("overdue");
    expect(bucketDueDateLabel(ts(2026, 6, 4))).toBe("today");
    expect(bucketDueDateLabel(ts(2026, 6, 5))).toBe("tomorrow");
    expect(bucketDueDateLabel(ts(2026, 6, 9))).toBe("this-week");
    expect(bucketDueDateLabel(ts(2026, 8, 1))).toBe("later");
  });
});
