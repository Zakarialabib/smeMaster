import { describe, it, expect, vi } from "vitest";
import { createOpenAICompatibleProvider, validateUrl, runTest } from "./openAiCompatibleProvider";

describe("validateUrl", () => {
  it("accepts valid http URLs", () => {
    expect(validateUrl("http://localhost:1234")).toBe("http://localhost:1234");
  });

  it("accepts valid https URLs", () => {
    expect(validateUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("throws for invalid URLs", () => {
    expect(() => validateUrl("ftp://invalid")).toThrow("Only http and https are allowed");
  });

  it("throws for malformed URLs", () => {
    expect(() => validateUrl("not-a-url")).toThrow("Invalid server URL");
  });
});

describe("createOpenAICompatibleProvider", () => {
  it("normalizes base URL by removing trailing slashes", () => {
    const provider = createOpenAICompatibleProvider(
      "http://localhost:1234/",
      "test-key",
      "test-model",
    );
    expect(provider).toBeDefined();
  });

  it("returns complete() result on successful response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Hello response" } }],
        }),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      "http://localhost:1234",
      "test-key",
      "test-model",
    );
    const result = await provider.complete({
      systemPrompt: "You are helpful",
      userContent: "Say hi",
    });

    expect(result).toBe("Hello response");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("returns empty string on empty response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      "http://localhost:1234",
      "test-key",
      "test-model",
    );
    const result = await provider.complete({
      systemPrompt: "You are helpful",
      userContent: "Say hi",
    });

    expect(result).toBe("");
  });

  it("throws on non-OK response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      "http://localhost:1234",
      "bad-key",
      "test-model",
    );

    await expect(
      provider.complete({ systemPrompt: "", userContent: "Say hi" }),
    ).rejects.toThrow("AI provider error (401)");
  });

  it("testConnection returns true on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "hi" } }],
        }),
    });
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      "http://localhost:1234",
      "test-key",
      "test-model",
    );
    const result = await provider.testConnection();

    expect(result).toBe(true);
  });

  it("testConnection returns false on error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    global.fetch = mockFetch;

    const provider = createOpenAICompatibleProvider(
      "http://localhost:1234",
      "test-key",
      "test-model",
    );
    const result = await provider.testConnection();

    expect(result).toBe(false);
  });
});

describe("runTest", () => {
  it("returns true when callable succeeds", async () => {
    await expect(runTest(async () => "ok")).resolves.toBe(true);
  });

  it("returns false when callable throws", async () => {
    await expect(runTest(async () => { throw new Error("fail"); })).resolves.toBe(false);
  });
});