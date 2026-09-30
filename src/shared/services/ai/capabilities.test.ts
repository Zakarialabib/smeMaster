import { describe, it, expect } from "vitest";
import {
  isTextCapable,
  isEmbeddingCapable,
  isConnectionTestable,
  isStreamingCapable,
  isSpeechToTextCapable,
  isTextToSpeechCapable,
  isRealtimeVoiceCapable,
  isModelDiscoveryCapable,
} from "../capabilities";
import {
  MODEL_REGISTRY,
  getModelsForProvider,
  getModelById,
  getEmbeddingModels,
  getModelsByCapability,
  getEmbeddingSpaceId,
  getEmbeddingDimensions,
} from "../modelRegistry";
import { DEFAULT_TASK_ROUTES, getAllTasks, getProvidersForTask } from "../taskRouter";
import type { AiProvider } from "../types";

describe("capability type guards", () => {
  it("isTextCapable returns true for object with complete()", () => {
    expect(isTextCapable({ complete: async () => "text" })).toBe(true);
    expect(isTextCapable({})).toBe(false);
    expect(isTextCapable(null)).toBe(false);
    expect(isTextCapable(undefined)).toBe(false);
  });

  it("isEmbeddingCapable returns true for object with getEmbeddings()", () => {
    expect(isEmbeddingCapable({ getEmbeddings: async () => null })).toBe(true);
    expect(isEmbeddingCapable({})).toBe(false);
  });

  it("isConnectionTestable returns true for object with testConnection()", () => {
    expect(isConnectionTestable({ testConnection: async () => true })).toBe(true);
    expect(isConnectionTestable({})).toBe(false);
  });

  it("isStreamingCapable returns true for object with streamComplete()", () => {
    expect(isStreamingCapable({ streamComplete: async function* () { yield "a"; } })).toBe(true);
    expect(isStreamingCapable({})).toBe(false);
  });

  it("isSpeechToTextCapable returns true for object with transcribe()", () => {
    expect(isSpeechToTextCapable({ transcribe: async () => "text" })).toBe(true);
    expect(isSpeechToTextCapable({})).toBe(false);
  });

  it("isTextToSpeechCapable returns true for object with synthesize()", () => {
    expect(isTextToSpeechCapable({ synthesize: async () => new Blob() })).toBe(true);
    expect(isTextToSpeechCapable({})).toBe(false);
  });

  it("isRealtimeVoiceCapable returns true for object with startRealtimeSession()", () => {
    expect(isRealtimeVoiceCapable({ startRealtimeSession: async () => ({}) })).toBe(true);
    expect(isRealtimeVoiceCapable({})).toBe(false);
  });

  it("isModelDiscoveryCapable returns true for object with listModels()", () => {
    expect(isModelDiscoveryCapable({ listModels: async () => [] })).toBe(true);
    expect(isModelDiscoveryCapable({})).toBe(false);
  });
});

describe("model registry", () => {
  it("contains models for all providers", () => {
    const providers: AiProvider[] = ["claude", "openai", "gemini", "mistral", "openrouter"];
    for (const provider of providers) {
      const models = getModelsForProvider(provider);
      expect(models.length).toBeGreaterThan(0);
    }
  });

  it("getModelById returns correct model", () => {
    const model = getModelById("gpt-4.1");
    expect(model).toBeDefined();
    expect(model?.provider).toBe("openai");
    expect(model?.tier).toBe("flagship");
  });

  it("getModelById returns undefined for unknown model", () => {
    expect(getModelById("nonexistent-model")).toBeUndefined();
  });

  it("getEmbeddingModels returns only embedding models", () => {
    const models = getEmbeddingModels();
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(model.capabilities.embeddings).toBeDefined();
    }
  });

  it("getModelsByCapability filters correctly", () => {
    const textModels = getModelsByCapability("text");
    expect(textModels.length).toBeGreaterThan(0);
    for (const model of textModels) {
      expect(model.capabilities.text).toBe(true);
    }

    const embeddingModels = getModelsByCapability("embedding");
    expect(embeddingModels.length).toBeGreaterThan(0);
    for (const model of embeddingModels) {
      expect(model.capabilities.embeddings).toBeDefined();
    }
  });

  it("getEmbeddingSpaceId returns correct space id", () => {
    expect(getEmbeddingSpaceId("text-embedding-3-small")).toBe("openai-te3-small-1536");
    expect(getEmbeddingSpaceId("gemini-embedding-2")).toBe("gemini-embed-2-768");
    expect(getEmbeddingSpaceId("mistral-embed")).toBe("mistral-embed-1024");
    expect(getEmbeddingSpaceId("gpt-4.1")).toBeUndefined();
  });

  it("getEmbeddingDimensions returns correct dimensions", () => {
    expect(getEmbeddingDimensions("text-embedding-3-small")).toBe(1536);
    expect(getEmbeddingDimensions("gemini-embedding-2")).toBe(768);
    expect(getEmbeddingDimensions("mistral-embed")).toBe(1024);
    expect(getEmbeddingDimensions("gpt-4.1")).toBeUndefined();
  });

  it("embedding models have unique embeddingSpaceIds", () => {
    const embeddingModels = getEmbeddingModels();
    const spaceIds = embeddingModels.map((m) => m.embeddingSpaceId).filter(Boolean);
    const uniqueSpaceIds = new Set(spaceIds);
    expect(spaceIds.length).toBe(uniqueSpaceIds.size);
  });
});

describe("task router", () => {
  it("has default routes for all tasks", () => {
    const tasks = getAllTasks();
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(DEFAULT_TASK_ROUTES[task]).toBeDefined();
      expect(DEFAULT_TASK_ROUTES[task].provider).toBeDefined();
      expect(DEFAULT_TASK_ROUTES[task].model).toBeDefined();
    }
  });

  it("email.classify routes to openai:gpt-4.1-nano", () => {
    const route = DEFAULT_TASK_ROUTES["email.classify"];
    expect(route.provider).toBe("openai");
    expect(route.model).toBe("gpt-4.1-nano");
  });

  it("email.compose routes to claude:claude-sonnet-4-20250514", () => {
    const route = DEFAULT_TASK_ROUTES["email.compose"];
    expect(route.provider).toBe("claude");
    expect(route.model).toBe("claude-sonnet-4-20250514");
  });

  it("rag.query routes to openai:text-embedding-3-small", () => {
    const route = DEFAULT_TASK_ROUTES["rag.query"];
    expect(route.provider).toBe("openai");
    expect(route.model).toBe("text-embedding-3-small");
  });

  it("getProvidersForTask returns providers with text capability", () => {
    const providers = getProvidersForTask("email.classify");
    expect(providers).toContain("openai");
    expect(providers).toContain("claude");
  });

  it("getProvidersForTask returns providers with embedding capability for rag.query", () => {
    const providers = getProvidersForTask("rag.query");
    expect(providers).toContain("openai");
    expect(providers).toContain("gemini");
    expect(providers).toContain("mistral");
  });
});
