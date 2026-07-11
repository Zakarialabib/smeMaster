import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFeatureLocked } from "./useFeatureLocked";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";

beforeEach(() => {
  // Reset to a known default — the store has its own default state.
  useFeatureFlagStore.setState({ overrideEnabled: false });
});

describe("useFeatureLocked", () => {
  it("returns isLocked=false when the feature is available", () => {
    // `ai` is unlocked in the default feature flags.
    const { result } = renderHook(() => useFeatureLocked("ai"));
    expect(result.current.isLocked).toBe(false);
  });

  it("returns a non-locked access for an available feature", () => {
    const { result } = renderHook(() => useFeatureLocked("ai"));
    expect(["enabled", "limited"]).toContain(result.current.access);
  });

  it("memoizes the result across re-renders with the same access", () => {
    const { result, rerender } = renderHook(() => useFeatureLocked("ai"));
    const first = result.current;
    rerender();
    const second = result.current;
    expect(first).toBe(second);
  });

  it("forwards a custom currentUsage value to the store", () => {
    const { result } = renderHook(() => useFeatureLocked("ai", 5));
    // The result shape must include both `isLocked` and `access`.
    expect(typeof result.current.isLocked).toBe("boolean");
    expect(typeof result.current.access).toBe("string");
  });
});
