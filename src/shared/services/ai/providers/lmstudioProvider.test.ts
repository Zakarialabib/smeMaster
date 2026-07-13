import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLMStudioProvider, testEmbedding } from "./lmstudioProvider";

function mockFetchOnce(body: unknown, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("createLMStudioProvider.getEmbeddings", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("uses the configured embedding model (not the chat model)", async () => {
    const fetchMock = mockFetchOnce({ data: [{ embedding: [0.1, 0.2] }], model: "nomic-embed" });
    const client = createLMStudioProvider(
      "http://localhost:1234",
      { chatModel: "llama3.2", embeddingModel: "nomic-embed" },
      "auto",
    );

    const result = await client.getEmbeddings({ input: "hello" });

    expect(result).toEqual([[0.1, 0.2]]);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string).model).toBe("nomic-embed");
  });

  it("falls back to 'default' when no embedding model is configured", async () => {
    const fetchMock = mockFetchOnce({ data: [{ embedding: [0.1] }], model: "default" });
    const client = createLMStudioProvider(
      "http://localhost:1234",
      { chatModel: "llama3.2", embeddingModel: "" },
      "auto",
    );

    await client.getEmbeddings({ input: "hi" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("default");
  });

  it("lets a per-request model override the configured embedding model", async () => {
    const fetchMock = mockFetchOnce({ data: [{ embedding: [0.3] }], model: "override" });
    const client = createLMStudioProvider(
      "http://localhost:1234",
      { chatModel: "llama3.2", embeddingModel: "nomic-embed" },
      "auto",
    );

    await client.getEmbeddings({ input: "hi", model: "override" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("override");
  });

  it("returns null when the embedding request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createLMStudioProvider(
      "http://localhost:1234",
      { chatModel: "llama3.2", embeddingModel: "nomic-embed" },
      "auto",
    );

    const result = await client.getEmbeddings({ input: "hi" });

    expect(result).toBeNull();
  });
});

describe("testEmbedding", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns ok with dims on success", async () => {
    mockFetchOnce({ data: [{ embedding: [0.1, 0.2, 0.3] }], model: "nomic-embed" });

    const res = await testEmbedding("http://localhost:1234", "nomic-embed");

    expect(res.ok).toBe(true);
    expect(res.dims).toBe(3);
  });

  it("returns an error detail on a non-ok response", async () => {
    mockFetchOnce("not found", { ok: false, status: 404 });

    const res = await testEmbedding("http://localhost:1234", "nomic-embed");

    expect(res.ok).toBe(false);
    expect(res.error).toContain("404");
  });

  it("falls back to the 'default' model when none is supplied", async () => {
    const fetchMock = mockFetchOnce({ data: [{ embedding: [0.1] }], model: "default" });

    await testEmbedding("http://localhost:1234", undefined);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("default");
  });
});
