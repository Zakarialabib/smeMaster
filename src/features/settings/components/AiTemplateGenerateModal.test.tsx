import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiTemplateGenerateModal } from "./AiTemplateGenerateModal";

const { mockState, mockFeatureAccess } = vi.hoisted(() => ({
  mockState: {
    step: "prompt" as "prompt" | "generating" | "preview" | "error",
    prompt: "",
    result: null as any,
    error: null as string | null,
    setPrompt: vi.fn(), generate: vi.fn().mockResolvedValue(undefined),
    regenerate: vi.fn().mockResolvedValue(undefined), reset: vi.fn(), setResult: vi.fn(),
  },
  mockFeatureAccess: vi.fn(() => "enabled"),
}));

vi.mock("@features/settings/hooks/useAiGenerationModal", () => ({
  useAiGenerationModal: () => mockState,
}));
vi.mock("@features/settings/stores/featureFlagStore", () => ({
  useFeatureFlagStore: (sel: (s: { getFeatureAccess: (id: string, n: number) => string }) => unknown) =>
    sel({ getFeatureAccess: mockFeatureAccess }),
}));

const onClose = vi.fn();
const onInsert = vi.fn();
const onSave = vi.fn();
const renderModal = () =>
  render(<AiTemplateGenerateModal isOpen onClose={onClose} onInsert={onInsert} onSave={onSave} />);

describe("AiTemplateGenerateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.step = "prompt";
    mockState.result = null;
    mockState.error = null;
    mockFeatureAccess.mockReturnValue("enabled");
  });

  it("renders prompt step with textarea and category chips", () => {
    renderModal();
    expect(screen.getByPlaceholderText(/modern newsletter/i)).toBeInTheDocument();
    expect(screen.getByText("Announcement")).toBeInTheDocument();
  });

  it("renders the generating label when step is generating", () => {
    mockState.step = "generating";
    renderModal();
    expect(screen.getByText(/generating template/i)).toBeInTheDocument();
  });

  it("renders the iframe preview with srcdoc on the preview step", () => {
    mockState.step = "preview";
    mockState.result = { name: "Tpl", description: "Desc", category: "newsletter", html: "<p>Hi</p>", variables: ["name"] };
    renderModal();
    const iframe = document.querySelector("iframe");
    expect(iframe?.getAttribute("srcdoc")).toBe("<p>Hi</p>");
    expect(screen.getByText("Tpl")).toBeInTheDocument();
  });

  it("renders the error UI when step is error", () => {
    mockState.step = "error";
    mockState.error = "boom";
    renderModal();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("calls onClose and reset when the modal close button is clicked", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockState.reset).toHaveBeenCalledTimes(1);
  });

  it("shows the locked banner when feature access is locked", () => {
    mockFeatureAccess.mockReturnValue("locked");
    renderModal();
    expect(screen.getByText(/learn more/i)).toBeInTheDocument();
  });
});
