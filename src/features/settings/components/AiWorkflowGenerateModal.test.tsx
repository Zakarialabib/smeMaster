import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiWorkflowGenerateModal } from "./AiWorkflowGenerateModal";
import { useAiGenerationModal } from "@features/settings/hooks/useAiGenerationModal";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";

vi.mock("@features/settings/hooks/useAiGenerationModal");
vi.mock("@features/settings/stores/featureFlagStore", () => ({ useFeatureFlagStore: vi.fn() }));

const preset = { name: "Auto Archive", description: "Archive old emails",
  trigger_event: "no_reply_after_days", trigger_conditions: "{}",
  actions: JSON.stringify([{ type: "archive" }, { type: "star" }]), category: "automation" as const };

function mockState(o: Record<string, unknown> = {}) {
  const s = { step: "prompt", prompt: "", result: null, error: null,
    setPrompt: vi.fn(), generate: vi.fn().mockResolvedValue(undefined),
    regenerate: vi.fn().mockResolvedValue(undefined), reset: vi.fn(), setResult: vi.fn(), ...o };
  vi.mocked(useAiGenerationModal).mockReturnValue(s as ReturnType<typeof useAiGenerationModal>);
  return s;
}
function mockAccess(a: "enabled" | "locked") {
  vi.mocked(useFeatureFlagStore).mockImplementation(((
    sel: (s: unknown) => unknown) => sel({ getFeatureAccess: () => a })) as never);
}

describe("AiWorkflowGenerateModal", () => {
  beforeEach(() => { vi.clearAllMocks(); mockAccess("enabled"); });

  it("renders the prompt form when open and AI is unlocked", () => {
    mockState();
    render(<AiWorkflowGenerateModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText("Describe the workflow you want to create")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate workflow/i })).toBeInTheDocument();
  });
  it("renders the locked banner when AI access is locked", () => {
    mockAccess("locked"); mockState();
    render(<AiWorkflowGenerateModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText(/learn more/i)).toBeInTheDocument();
  });
  it("calls setPrompt on textarea change and generate when the prompt is non-empty", () => {
    const s = mockState({ prompt: "Archive old" });
    render(<AiWorkflowGenerateModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Archive" } });
    fireEvent.click(screen.getByRole("button", { name: /generate workflow/i }));
    expect(s.setPrompt).toHaveBeenCalledWith("Archive");
    expect(s.generate).toHaveBeenCalledTimes(1);
  });
  it("renders preview with trigger, parsed actions, and raw JSON details", () => {
    mockState({ step: "preview", result: preset });
    render(<AiWorkflowGenerateModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText("Auto Archive")).toBeInTheDocument();
    expect(screen.getByText("archive")).toBeInTheDocument();
    expect(screen.getByText("star")).toBeInTheDocument();
    expect(screen.getByText(/view raw/i)).toBeInTheDocument();
  });
  it("calls onCreate and onClose when the Create button is clicked in preview", () => {
    mockState({ step: "preview", result: preset });
    const onCreate = vi.fn(); const onClose = vi.fn();
    render(<AiWorkflowGenerateModal isOpen onClose={onClose} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /create workflow/i }));
    expect(onCreate).toHaveBeenCalledWith(preset);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("calls regenerate when the Regenerate button is clicked in preview", () => {
    const s = mockState({ step: "preview", result: preset });
    render(<AiWorkflowGenerateModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    expect(s.regenerate).toHaveBeenCalledTimes(1);
  });
});
