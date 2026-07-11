import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAccountScopedLoader } from "./useAccountScopedLoader";
import { useAccountStore } from "@features/accounts/stores/accountStore";

beforeEach(() => {
  useAccountStore.setState({ accounts: [], activeAccountId: null });
});

describe("useAccountScopedLoader", () => {
  it("returns empty state when no account is active", async () => {
    const load = vi.fn().mockResolvedValue("data");
    const { result } = renderHook(() => useAccountScopedLoader(load));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("loads data when an account is active", async () => {
    const load = vi.fn().mockResolvedValue({ count: 5 });
    useAccountStore.setState({ activeAccountId: "acct-1" });
    const { result } = renderHook(() => useAccountScopedLoader(load));
    await waitFor(() => expect(result.current.data).toEqual({ count: 5 }));
    expect(load).toHaveBeenCalledWith("acct-1");
    expect(result.current.loading).toBe(false);
  });

  it("reloads when the active account id changes", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ id: "a" })
      .mockResolvedValueOnce({ id: "b" });
    useAccountStore.setState({ activeAccountId: "acct-1" });
    const { result } = renderHook(() => useAccountScopedLoader(load));
    await waitFor(() => expect(result.current.data).toEqual({ id: "a" }));
    useAccountStore.setState({ activeAccountId: "acct-2" });
    await waitFor(() => expect(result.current.data).toEqual({ id: "b" }));
  });

  it("surfaces errors via the error field", async () => {
    const load = vi.fn().mockRejectedValue(new Error("network down"));
    useAccountStore.setState({ activeAccountId: "acct-1" });
    const { result } = renderHook(() => useAccountScopedLoader(load));
    await waitFor(() => expect(result.current.error).toBe("network down"));
  });

  it("reload re-runs the loader with the same id", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ v: 1 })
      .mockResolvedValueOnce({ v: 2 });
    useAccountStore.setState({ activeAccountId: "acct-1" });
    const { result } = renderHook(() => useAccountScopedLoader(load));
    await waitFor(() => expect(result.current.data).toEqual({ v: 1 }));
    result.current.reload();
    await waitFor(() => expect(result.current.data).toEqual({ v: 2 }));
  });
});
