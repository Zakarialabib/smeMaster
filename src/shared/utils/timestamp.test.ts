import { getCurrentUnixTimestamp } from "./timestamp";

describe("getCurrentUnixTimestamp", () => {
  it("returns a number", () => {
    expect(typeof getCurrentUnixTimestamp()).toBe("number");
  });

  it("returns the current time in seconds (not milliseconds)", () => {
    const before = Math.floor(Date.now() / 1000);
    const result = getCurrentUnixTimestamp();
    const after = Math.floor(Date.now() / 1000);
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns an integer (no fractional seconds)", () => {
    const result = getCurrentUnixTimestamp();
    expect(result).toBe(Math.floor(result));
  });

  it("returns a value roughly 1000x smaller than Date.now()", () => {
    const result = getCurrentUnixTimestamp();
    const dateNow = Date.now();
    // The ratio should be approximately 1000 (within a small tolerance)
    const ratio = dateNow / result;
    expect(ratio).toBeGreaterThan(999);
    expect(ratio).toBeLessThan(1001);
  });
});
