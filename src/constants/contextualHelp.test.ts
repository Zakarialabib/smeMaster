import { describe, it, expect } from "vitest";
import {
  getContextualHelp,
  getContextualHelpKeys,
} from "./contextualHelp";

describe("contextualHelp registry", () => {
  // ─── known keys ──────────────────────────────────────────────────────

  it("getContextualHelp('smart-folders') returns entry", () => {
    const entry = getContextualHelp("smart-folders");
    expect(entry).toBeDefined();
    expect(entry?.summary).toBeTruthy();
    expect(entry?.description).toBeTruthy();
  });

  it("getContextualHelp('split-inbox') returns entry", () => {
    const entry = getContextualHelp("split-inbox");
    expect(entry).toBeDefined();
    expect(entry?.summary).toBeTruthy();
    expect(entry?.description).toBeTruthy();
  });

  it("getContextualHelp('bundle-rules') returns entry", () => {
    const entry = getContextualHelp("bundle-rules");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('composer-templates') returns entry", () => {
    const entry = getContextualHelp("composer-templates");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('composer-compliance') returns entry", () => {
    const entry = getContextualHelp("composer-compliance");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('composer-schedule') returns entry", () => {
    const entry = getContextualHelp("composer-schedule");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('calendar-sync') returns entry", () => {
    const entry = getContextualHelp("calendar-sync");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('task-priority') returns entry", () => {
    const entry = getContextualHelp("task-priority");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('campaign-analytics') returns entry", () => {
    const entry = getContextualHelp("campaign-analytics");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('vault-encryption') returns entry", () => {
    const entry = getContextualHelp("vault-encryption");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('pgp-encryption') returns entry", () => {
    const entry = getContextualHelp("pgp-encryption");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('deliverability-dns') returns entry", () => {
    const entry = getContextualHelp("deliverability-dns");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('deliverability-warming') returns entry", () => {
    const entry = getContextualHelp("deliverability-warming");
    expect(entry).toBeDefined();
  });

  it("getContextualHelp('offline-queue') returns entry", () => {
    const entry = getContextualHelp("offline-queue");
    expect(entry).toBeDefined();
  });

  // ─── nonexistent key ─────────────────────────────────────────────────

  it("getContextualHelp('nonexistent') returns undefined", () => {
    expect(getContextualHelp("nonexistent")).toBeUndefined();
  });

  it("getContextualHelp('') returns undefined", () => {
    expect(getContextualHelp("")).toBeUndefined();
  });

  // ─── getContextualHelpKeys ───────────────────────────────────────────

  it("getContextualHelpKeys() returns array of all keys", () => {
    const keys = getContextualHelpKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("getContextualHelpKeys() returns expected known keys", () => {
    const keys = getContextualHelpKeys();
    expect(keys).toContain("smart-folders");
    expect(keys).toContain("split-inbox");
    expect(keys).toContain("bundle-rules");
    expect(keys).toContain("composer-templates");
    expect(keys).toContain("offline-queue");
  });

  it("every key returned by getContextualHelpKeys resolves to an entry", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      expect(getContextualHelp(key)).toBeDefined();
    }
  });

  // ─── Data integrity: all keys ────────────────────────────────────────

  it("all keys are non-empty strings", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      expect(key.trim().length).toBeGreaterThan(0);
    }
  });

  // ─── Data integrity: every entry has summary and description ─────────

  it("every entry has a non-empty summary", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      expect(entry.summary.trim().length).toBeGreaterThan(0);
    }
  });

  it("every entry has a non-empty description", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("summary is shorter than description for every entry", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      expect(entry.summary.length).toBeLessThan(entry.description.length);
    }
  });

  it("every entry has summary and description fields", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      expect(entry).toHaveProperty("summary");
      expect(entry).toHaveProperty("description");
    }
  });

  // ─── Data integrity: tips ────────────────────────────────────────────

  it("every entry with tips has a non-empty array of strings", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      if (entry.tips) {
        expect(Array.isArray(entry.tips)).toBe(true);
        expect(entry.tips.length).toBeGreaterThan(0);
        for (const tip of entry.tips) {
          expect(typeof tip).toBe("string");
          expect(tip.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("every entry with tips has valid tips (no empty strings)", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      if (entry.tips) {
        for (const tip of entry.tips) {
          expect(tip.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  // ─── Data integrity: learnMoreHref ───────────────────────────────────

  it("every entry with learnMoreHref has a non-empty string", () => {
    const keys = getContextualHelpKeys();
    for (const key of keys) {
      const entry = getContextualHelp(key)!;
      if (entry.learnMoreHref) {
        expect(entry.learnMoreHref.trim().length).toBeGreaterThan(0);
      }
    }
  });

  // ─── Unique keys ─────────────────────────────────────────────────────

  it("all keys are unique", () => {
    const keys = getContextualHelpKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  // ─── Expected key count ──────────────────────────────────────────────

  it("has exactly 15 entries", () => {
    const keys = getContextualHelpKeys();
    expect(keys.length).toBe(15);
  });

  // ─── Category coverage ───────────────────────────────────────────────

  it("has keys from all expected categories", () => {
    const keys = getContextualHelpKeys();
    // Mail
    expect(keys).toContain("smart-folders");
    expect(keys).toContain("split-inbox");
    expect(keys).toContain("bundle-rules");

    // Composer
    expect(keys).toContain("composer-templates");
    expect(keys).toContain("composer-compliance");
    expect(keys).toContain("composer-schedule");

    // Calendar
    expect(keys).toContain("calendar-sync");

    // Tasks
    expect(keys).toContain("task-priority");

    // Campaigns
    expect(keys).toContain("campaign-analytics");

    // Security
    expect(keys).toContain("vault-encryption");
    expect(keys).toContain("pgp-encryption");

    // Deliverability
    expect(keys).toContain("deliverability-dns");
    expect(keys).toContain("deliverability-warming");

    // Sync & Offline
    expect(keys).toContain("offline-queue");
  });
});
