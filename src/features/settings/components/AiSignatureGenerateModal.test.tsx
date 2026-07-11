import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@features/settings/hooks/useAiGenerationModal", () => ({
  useAiGenerationModal: vi.fn(),
}));
vi.mock("@features/settings/stores/featureFlagStore", () => ({
  useFeatureFlagStore: vi.fn(),
}));

import { useAiGenerationModal } from "@features/settings/hooks/useAiGenerationModal";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { AiSignatureGenerateModal } from "./AiSignatureGenerateModal";

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    step: "prompt", prompt: "", result: null, error: null,
    setPrompt: vi.fn(), generate: vi.fn(), regenerate: vi.fn(),
    reset: vi.fn(), setResult: vi.fn(),
    ...overrides,
  };
}

function mockStore(isLocked: boolean) {
  vi.mocked(useFeatureFlagStore).mockImplementation(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({ getFeatureAccess: () => (isLocked ? "locked" : "unlocked") }),
  );
}

describe("AiSignatureGenerateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders prompt step on open", () => {
    vi.mocked(useAiGenerationModal).mockReturnValue(makeState() as never);
    mockStore(false);
    render(<AiSignatureGenerateModal isOpen onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.getByText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByText("Style")).toBeInTheDocument();
    expect(screen.getByText("Modern")).toBeInTheDocument();
  });

  it("renders generating step", () => {
    vi.mocked(useAiGenerationModal).mockReturnValue(makeState({ step: "generating" }) as never);
    mockStore(false);
    render(<AiSignatureGenerateModal isOpen onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.getByText("Generating signature...")).toBeInTheDocument();
    expect(document.body.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders preview step on success", () => {
    vi.mocked(useAiGenerationModal).mockReturnValue(
      makeState({ step: "preview", result: { name: "My Sig", html: "<p>x</p>", variables: [] } }) as never,
    );
    mockStore(false);
    render(<AiSignatureGenerateModal isOpen onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.getByText("My Sig")).toBeInTheDocument();
    expect(screen.getByText("Use Signature")).toBeInTheDocument();
  });

  it("renders error step on failure", () => {
    vi.mocked(useAiGenerationModal).mockReturnValue(
      makeState({ step: "error", error: "Something went wrong" }) as never,
    );
    mockStore(false);
    render(<AiSignatureGenerateModal isOpen onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls onClose on close button click", () => {
    const onClose = vi.fn();
    const state = makeState();
    vi.mocked(useAiGenerationModal).mockReturnValue(state as never);
    mockStore(false);
    render(<AiSignatureGenerateModal isOpen onClose={onClose} onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /close modal/i }));
    expect(state.reset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders upgrade banner when locked", () => {
    vi.mocked(useAiGenerationModal).mockReturnValue(makeState() as never);
    mockStore(true);
    render(<AiSignatureGenerateModal isOpen onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
    expect(screen.getByText(/signature generation/i)).toBeInTheDocument();
  });
});
