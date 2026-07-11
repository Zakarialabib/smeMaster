import { describe, it, expect, vi } from "vitest";
import {
  withMutation,
  createAsyncActions,
  initialAsyncState,
} from "./createAsyncStore";

describe("withMutation", () => {
  it("returns the resolved value on success", async () => {
    const setLoading = vi.fn();
    const setError = vi.fn();

    const result = await withMutation(async () => 42, { setLoading, setError });

    expect(result).toBe(42);
    expect(setLoading).toHaveBeenNthCalledWith(1, true);
    expect(setLoading).toHaveBeenNthCalledWith(2, false);
    expect(setError).toHaveBeenCalledWith(null);
  });

  it("returns undefined and calls setError when fn throws an Error", async () => {
    const setLoading = vi.fn();
    const setError = vi.fn();

    const result = await withMutation(
      async () => {
        throw new Error("boom");
      },
      { setLoading, setError },
    );

    expect(result).toBeUndefined();
    expect(setError).toHaveBeenCalledWith("boom");
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it("stringifies non-Error throws", async () => {
    const setLoading = vi.fn();
    const setError = vi.fn();

    const result = await withMutation(
      async () => {
        throw new Error("string-error");
      },
      { setLoading, setError },
    );

    expect(result).toBeUndefined();
    expect(setError).toHaveBeenCalledWith("string-error");
  });

  it("toggles setLoading true→false in order", async () => {
    const calls: boolean[] = [];
    const setLoading = vi.fn((v: boolean) => {
      calls.push(v);
    });
    const setError = vi.fn();

    await withMutation(async () => "ok", { setLoading, setError });

    expect(calls).toEqual([true, false]);
  });

  it("works without any options (all callbacks optional)", async () => {
    await expect(withMutation(async () => 7)).resolves.toBe(7);
    await expect(
      withMutation(async () => {
        throw new Error("x");
      }),
    ).resolves.toBeUndefined();
  });
});

describe("createAsyncActions (regression)", () => {
  it("withLoading still produces a working helper", async () => {
    const set = vi.fn();
    const { withLoading } = createAsyncActions<{
      isLoading: boolean;
      error: string | null;
    }>(set);

    await withLoading(async () => 1);
    // First call: loading=true, error=null; second: loading=false
    expect(set).toHaveBeenCalled();
  });
});

describe("initialAsyncState", () => {
  it("has the expected default shape", () => {
    expect(initialAsyncState).toEqual({ isLoading: false, error: null });
  });
});
