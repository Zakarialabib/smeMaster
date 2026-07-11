import { describe, it, expect } from "vitest";
import {
  PRIORITY_ORDER,
  PRIORITY_BADGE,
  PRIORITY_DOT,
  PRIORITY_COLORS,
  PRIORITY_DOT_COLORS,
  PRIORITY_LABELS,
  ALL_PRIORITIES,
} from "./taskPriority";
import type { TaskPriority } from "@features/tasks/db/tasks";

describe("taskPriority", () => {
  it("defines all five priorities in PRIORITY_ORDER", () => {
    expect(Object.keys(PRIORITY_ORDER).sort()).toEqual(
      ["high", "low", "medium", "none", "urgent"].sort(),
    );
  });

  it("orders urgent → none strictly ascending", () => {
    expect(PRIORITY_ORDER.urgent).toBe(0);
    expect(PRIORITY_ORDER.high).toBe(1);
    expect(PRIORITY_ORDER.medium).toBe(2);
    expect(PRIORITY_ORDER.low).toBe(3);
    expect(PRIORITY_ORDER.none).toBe(4);
  });

  it("PRIORTY_BADGE has matching label and color for each non-none priority", () => {
    for (const p of ALL_PRIORITIES) {
      if (p === "none") {
        expect(PRIORITY_BADGE[p].label).toBe("");
      } else {
        expect(PRIORITY_BADGE[p].label.length).toBeGreaterThan(0);
        expect(PRIORITY_BADGE[p].bg).toContain("bg-");
        expect(PRIORITY_BADGE[p].text).toContain("text-");
      }
    }
  });

  it("uses a red token for urgent", () => {
    expect(PRIORITY_BADGE.urgent.text).toContain("red");
    expect(PRIORITY_DOT.urgent).toContain("red");
    expect(PRIORITY_COLORS.urgent).toContain("red");
  });

  it("PRIORTY_DOT_COLORS is an alias for PRIORITY_DOT", () => {
    expect(PRIORITY_DOT_COLORS).toEqual(PRIORITY_DOT);
  });

  it("PRIORTY_LABELS is human-readable for every priority", () => {
    for (const p of ALL_PRIORITIES) {
      expect(PRIORITY_LABELS[p].length).toBeGreaterThan(0);
    }
  });

  it("ALL_PRIORITIES contains each priority exactly once", () => {
    expect(new Set(ALL_PRIORITIES).size).toBe(ALL_PRIORITIES.length);
    for (const p of ALL_PRIORITIES) {
      const _p: TaskPriority = p; // type-only check
      expect(_p).toBe(p);
    }
  });
});
