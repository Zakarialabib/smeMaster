import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import KnowledgeBaseSettings from "./KnowledgeBaseSettings";

const fullStore = {
  enabled: true,
  modelStatus: "idle" as const,
  modelPath: "",
  tokenizerPath: "",
  modelError: null,
  embeddingSource: null,
  modelsDir: "",
  indexingStatus: "idle" as const,
  lastIndexedAt: null,
  indexingError: null,
  embeddingTest: null,
  embeddingTesting: false,
  hydrate: vi.fn(),
  setEnabled: vi.fn(),
  setEmbeddingSource: vi.fn(),
  fetchModelsDir: vi.fn(),
  removeModel: vi.fn(),
  downloadBgeModel: vi.fn(),
  loadEmbeddingModel: vi.fn(),
  indexAll: vi.fn(),
  testEmbedding: vi.fn(),
};

vi.mock("@features/assistant/stores/ragStore", () => ({
  useRagStore: vi.fn((selector?: any) => {
    const store = fullStore;
    return selector ? selector(store) : store;
  }),
}));

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn().mockResolvedValue(""),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getSecureSetting: vi.fn().mockResolvedValue(""),
  setSecureSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/services/db/invoke/rag", () => ({
  aiGetVectorDbPath: vi.fn().mockResolvedValue("/data/vectors"),
  aiResetVectorDb: vi.fn().mockResolvedValue(undefined),
}));

describe("KnowledgeBaseSettings — engine mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fullStore.embeddingSource = null;
  });

  it("offers the three explicit embedding-engine modes", () => {
    render(<KnowledgeBaseSettings />);

    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Provider (LM Studio)")).toBeInTheDocument();
    expect(screen.getByText("On-device BGE")).toBeInTheDocument();
  });

  it("shows the embedding-config status group in provider mode", () => {
    fullStore.embeddingSource = "provider";
    render(<KnowledgeBaseSettings />);

    expect(screen.getByText("Provider Embeddings")).toBeInTheDocument();
    // BGE-only controls stay hidden.
    expect(screen.queryByText("Download BGE-Small")).not.toBeInTheDocument();
  });

  it("reveals the local model management in BGE mode", () => {
    fullStore.embeddingSource = "rust_bge";
    render(<KnowledgeBaseSettings />);

    expect(screen.getByText("Download BGE-Small")).toBeInTheDocument();
    expect(screen.getByText("Local Models Folder")).toBeInTheDocument();
    // Provider-only controls stay hidden.
    expect(screen.queryByText("Provider Embeddings")).not.toBeInTheDocument();
  });
});
