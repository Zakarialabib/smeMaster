// src/shared/services/commands.test.ts
// Unit tests for the typed invoke wrapper — verifies that our wrapper
// correctly delegates to @tauri-apps/api/core's invoke() with the right
// command name and args, and returns the expected responses.

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { invoke } from "@shared/services/commands";

const mockInvoke = vi.mocked(tauriInvoke);

describe("typed invoke wrapper", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  // ── Command name passthrough ─────────────────────────────────────────────

  it('passes "get_platform" command name to tauriInvoke', async () => {
    mockInvoke.mockResolvedValueOnce({
      mobile: false,
      desktop: true,
      os: "windows",
      arch: "x86_64",
      is_tablet: false,
      is_phone: false,
    });
    await invoke("get_platform");
    expect(mockInvoke).toHaveBeenCalledWith("get_platform", {});
  });

  it('passes "imap_list_folders" with config args', async () => {
    const config = {
      host: "imap.example.com",
      port: 993,
      security: "tls" as const,
      username: "user@example.com",
      password: "secret",
      auth_method: "password" as const,
    };
    mockInvoke.mockResolvedValueOnce([]);
    await invoke("imap_list_folders", { config });
    expect(mockInvoke).toHaveBeenCalledWith("imap_list_folders", { config });
  });

  it('passes "close_splashscreen" with no args', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await invoke("close_splashscreen");
    expect(mockInvoke).toHaveBeenCalledWith("close_splashscreen", {});
  });

  it('passes "check_dns_records" with domain param', async () => {
    mockInvoke.mockResolvedValueOnce({ spf: "v=spf1 include:_spf.example.com ~all" });
    await invoke("check_dns_records", { domain: "example.com" });
    expect(mockInvoke).toHaveBeenCalledWith("check_dns_records", { domain: "example.com" });
  });

  // ── Returns the exact value from tauriInvoke ─────────────────────────────

  it("returns the value resolved by tauriInvoke", async () => {
    const platform = {
      mobile: false,
      desktop: true,
      os: "macos",
      arch: "aarch64",
      is_tablet: false,
      is_phone: false,
    };
    mockInvoke.mockResolvedValueOnce(platform);
    const result = await invoke("get_platform");
    expect(result).toEqual(platform);
  });

  it("returns undefined for void-result commands", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const result = await invoke("close_splashscreen");
    expect(result).toBeUndefined();
  });

  it("returns plain strings when the command returns a string", async () => {
    mockInvoke.mockResolvedValueOnce("/home/user/.sme/vault");
    const result = await invoke("get_vault_root");
    expect(result).toBe("/home/user/.sme/vault");
  });

  it("returns arrays when the command returns an array", async () => {
    const folders = [
      { path: "INBOX", raw_path: "INBOX", name: "INBOX", delimiter: "/", special_use: "\\Inbox", exists: 10, unseen: 2 },
    ];
    mockInvoke.mockResolvedValueOnce(folders);
    const result = await invoke("imap_list_folders", {
      config: { host: "imap.example.com", port: 993, security: "tls", username: "u", password: "p", auth_method: "password" },
    });
    expect(result).toEqual(folders);
  });

  // ── Error propagation ────────────────────────────────────────────────────

  it("propagates errors from tauriInvoke", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("command not found: get_platform"));
    await expect(invoke("get_platform")).rejects.toThrow("command not found: get_platform");
  });

  it("propagates string rejections as errors", async () => {
    mockInvoke.mockRejectedValueOnce("IMAP connection timeout");
    await expect(
      invoke("imap_test_connection", {
        config: { host: "imap.example.com", port: 993, security: "tls", username: "u", password: "p", auth_method: "password" },
      }),
    ).rejects.toBe("IMAP connection timeout");
  });

  it("propagates structured error objects", async () => {
    const err = { code: -1, message: "invalid params: port must be 1-65535" };
    mockInvoke.mockRejectedValueOnce(err);
    await expect(
      invoke("imap_list_folders", {
        config: { host: "imap.example.com", port: 0, security: "tls", username: "u", password: "p", auth_method: "password" },
      }),
    ).rejects.toEqual(err);
  });

  // ── Null/undefined args become empty object ──────────────────────────────

  it("calls tauriInvoke with {} when args is undefined", async () => {
    mockInvoke.mockResolvedValueOnce({ mobile: false, desktop: true, os: "linux", arch: "x86_64", is_tablet: false, is_phone: false });
    await invoke("get_platform", undefined as any);
    expect(mockInvoke).toHaveBeenCalledWith("get_platform", {});
  });

  it("calls tauriInvoke with {} when args is null", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await invoke("imap_list_folders", null as any);
    expect(mockInvoke).toHaveBeenCalledWith("imap_list_folders", {});
  });
});
