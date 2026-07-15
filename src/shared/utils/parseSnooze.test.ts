import { describe, it, expect } from "vitest";
import { parseSnooze } from "./parseSnooze";

const NOW = new Date("2026-07-15T12:00:00");

describe("parseSnooze", () => {
  it("returns null on empty input", () => {
    expect(parseSnooze("", NOW)).toBeNull();
    expect(parseSnooze("   ", NOW)).toBeNull();
  });

  it("parses 'in <n> <unit>' offsets", () => {
    expect(parseSnooze("in 30 minutes", NOW)?.until).toBe(
      Math.floor(NOW.getTime() / 1000) + 30 * 60,
    );
    expect(parseSnooze("in 2 hours", NOW)?.until).toBe(
      Math.floor(NOW.getTime() / 1000) + 2 * 3600,
    );
    expect(parseSnooze("in 3 days", NOW)?.until).toBe(
      Math.floor(NOW.getTime() / 1000) + 3 * 86400,
    );
  });

  it("parses short forms <n>h / <n>m / <n>d", () => {
    expect(parseSnooze("2h", NOW)?.until).toBe(
      Math.floor(NOW.getTime() / 1000) + 2 * 3600,
    );
    expect(parseSnooze("15m", NOW)?.until).toBe(
      Math.floor(NOW.getTime() / 1000) + 15 * 60,
    );
  });

  it("parses 'tomorrow' with default time", () => {
    const r = parseSnooze("tomorrow", NOW);
    expect(r).not.toBeNull();
    const d = new Date((r as { until: number }).until * 1000);
    expect(d.getHours()).toBe(9);
    expect(d.getDate()).toBe(16); // next day
  });

  it("parses 'friday' to the upcoming Friday at 09:00", () => {
    // 2026-07-15 is a Wednesday; next Friday is 2026-07-17
    const r = parseSnooze("friday", NOW);
    expect(r).not.toBeNull();
    const d = new Date((r as { until: number }).until * 1000);
    expect(d.getDay()).toBe(5); // Friday
    expect(d.getDate()).toBe(17);
  });

  it("parses 'tonight' to 20:00 today or next day", () => {
    const r = parseSnooze("tonight", NOW);
    expect(r).not.toBeNull();
    const d = new Date((r as { until: number }).until * 1000);
    expect(d.getHours()).toBe(20);
  });

  it("parses ISO dates", () => {
    const r = parseSnooze("2026-12-25", NOW);
    expect(r).not.toBeNull();
    const d = new Date((r as { until: number }).until * 1000);
    expect(d.getMonth()).toBe(11); // December
    expect(d.getDate()).toBe(25);
  });

  it("returns null for gibberish", () => {
    expect(parseSnooze("asdfqwer", NOW)).toBeNull();
  });
});
