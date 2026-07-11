import { describe, it, expect } from "vitest";
import { safeParseJson } from "./safeParseJson";

describe("safeParseJson", () => {
  it("returns the fallback for null", () => {
    expect(safeParseJson(null, [])).toEqual([]);
    expect(safeParseJson(null, null)).toBeNull();
    expect(safeParseJson(null, "fallback")).toBe("fallback");
  });

  it("returns the fallback for undefined", () => {
    expect(safeParseJson(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it("returns the fallback for empty string", () => {
    expect(safeParseJson("", [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("returns the fallback for invalid JSON", () => {
    expect(safeParseJson("not json", "x")).toBe("x");
    expect(safeParseJson("{unclosed", 0)).toBe(0);
  });

  it("returns the parsed value for valid JSON", () => {
    expect(safeParseJson("[1,2,3]", [])).toEqual([1, 2, 3]);
    expect(safeParseJson('{"a":1}', null)).toEqual({ a: 1 });
    expect(safeParseJson('"hello"', "")).toBe("hello");
    expect(safeParseJson("42", 0)).toBe(42);
    expect(safeParseJson("true", false)).toBe(true);
    expect(safeParseJson("null", "x")).toBeNull();
  });

  it("applies the validate predicate and returns fallback on mismatch", () => {
    const isString = (v: unknown): v is string => typeof v === "string";
    expect(safeParseJson('"hi"', "x", isString)).toBe("hi");
    expect(safeParseJson("42", "x", isString)).toBe("x");
    expect(safeParseJson("[1]", "x", isString)).toBe("x");
  });

  it("does not throw on weird inputs", () => {
    expect(() => safeParseJson("\u0000", "x")).not.toThrow();
    expect(safeParseJson("\u0000", "x")).toBe("x");
  });
});
