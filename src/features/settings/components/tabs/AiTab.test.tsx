import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AiTab from "./AiTab";

// ── Mutable provider used by the getSetting mock ──
let activeProvider = "claude";

vi.mock("@features/accounts/stores/accountStore", () => ({
  useAccountStore: vi.fn(() => ({ accounts: [] })),
}));

vi.mock("@features/assistant/stores/ragStore", () => ({
  useRagStore: vi.fn((selector?: any) => {
    const store = { lastIndexedAt: null };
    return selector ? selector(store) : store;
  }),
}));

vi.mock("@features/settings/db/settings", () => ({
  getSetting: vi.fn().mockImplementation(async (key: string) => {
    if (key === "ai_provider") return activeProvider;
    return "";
  }),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getSecureSetting: vi.fn().mockResolvedValue(""),
  setSecureSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/services/ai/providerManager", () => ({
  isAiAvailable: vi.fn().mockResolvedValue(true),
  clearProviderClients: vi.fn(),
  testLMStudioEmbedding: vi.fn().mockResolvedValue({ ok: true, dims: 384 }),
}));

vi.mock("@shared/services/ai/aiService", () => ({
  testConnection: vi.fn().mockResolvedValue(true),
}));

vi.mock("@shared/services/ai/writingStyleService", () => ({
  refreshWritingStyle: vi.fn().mockResolvedValue(undefined),
}));

// Keep the heavy sub-sections from pulling real Tauri modules during render.
vi.mock("../KnowledgeBaseSettings", () => ({
  default: () => <div data-testid="knowledge-base">Knowledge Base</div>,
}));
vi.mock("../BundleSettings", () => ({
  default: () => <div data-testid="bundle">Bundle</div>,
}));
vi.mock("../VoiceSettings", () => ({
  default: () => <div data-testid="voice">Voice</div>,
}));

describe("AiTab — provider select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeProvider = "claude";
  });

  it("offers LM Studio and OpenRouter as selectable providers (regression: they were dead code)", () => {
    render(<AiTab />);

    // The provider <select> maps every supported provider, including the
    // two that previously existed as unreachable panels.
    expect(screen.getByText("Local AI (LM Studio)")).toBeInTheDocument();
    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
  });

  it("renders the embedding-model field and Test embedding button when LM Studio is active", async () => {
    activeProvider = "lmstudio";
    render(<AiTab />);

    // Provider panel switches to LM Studio after the loader effect runs.
    expect(await screen.findByText("Embedding Model")).toBeInTheDocument();
    expect(screen.getByText("Test embedding")).toBeInTheDocument();
  });

  it("navigates to the Knowledge Base sub-tab", async () => {
    render(<AiTab />);
    fireEvent.click(screen.getByText("Knowledge Base"));
    expect(await screen.findByTestId("knowledge-base")).toBeInTheDocument();
  });
});
