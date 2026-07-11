import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({
  state: {
    step: "prompt" as "prompt" | "generating" | "preview" | "error",
    result: null as null | {
      id: string; name: string; subject: string; bodyHtml: string;
      style: "follow_up" | "thank_you" | "introduction" | "meeting_request" | "check_in" | "sharing_content";
    },
    error: null as string | null,
    prompt: "",
  },
  reset: vi.fn(),
  generate: vi.fn(),
  regenerate: vi.fn(),
  locked: { current: false },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en" } }),
}));
vi.mock("@features/settings/hooks/useAiGenerationModal", () => ({
  useAiGenerationModal: () => ({
    ...h.state, setPrompt: vi.fn(), generate: h.generate,
    regenerate: h.regenerate, reset: h.reset, setResult: vi.fn(),
  }),
}));
vi.mock("@features/settings/stores/featureFlagStore", () => ({
  useFeatureFlagStore: (sel: (s: { getFeatureAccess: () => string }) => unknown) =>
    sel({ getFeatureAccess: () => (h.locked.current ? "locked" : "full") }),
}));
vi.mock("@shared/services/ai/warmupGenerator", () => ({ generateWarmupPreset: vi.fn() }));

import { AiWarmupGenerateModal } from "./AiWarmupGenerateModal";

function setup(opts: { state?: Partial<typeof h.state>; locked?: boolean } = {}) {
  Object.assign(h.state, { step: "prompt", result: null, error: null, prompt: "" }, opts.state);
  h.locked.current = opts.locked ?? false;
  const onClose = vi.fn();
  const onAdd = vi.fn();
  render(<AiWarmupGenerateModal isOpen onClose={onClose} onAdd={onAdd} />);
  return { onClose, onAdd };
}

describe("AiWarmupGenerateModal", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("renders the modal title at the prompt step", () => {
    setup();
    expect(screen.getByText("modals.aiWarmup.title")).toBeInTheDocument();
  });

  it("renders all six warmup style options at the prompt step", () => {
    setup();
    ["followUp", "thankYou", "introduction", "meetingRequest", "checkIn", "sharingContent"]
      .forEach((k) => expect(screen.getByText(`modals.aiWarmup.${k}`)).toBeInTheDocument());
  });

  it("renders the upgrade banner and hides the prompt form when AI is locked", () => {
    setup({ locked: true });
    expect(screen.getByText(/learn more/i)).toBeInTheDocument();
    expect(screen.queryByText("modals.aiWarmup.warmupStyle")).not.toBeInTheDocument();
  });

  it("renders the preview with the result subject and name when step is 'preview'", () => {
    setup({ state: { step: "preview", result: {
      id: "1", name: "Friendly Check-In", subject: "Hi there", bodyHtml: "<p>x</p>", style: "follow_up",
    } } });
    expect(screen.getByText("Friendly Check-In")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("renders the custom pulsing error UX with the error message when step is 'error'", () => {
    setup({ state: { step: "error", error: "Network is down" } });
    const errorText = screen.getByText("Network is down");
    expect(errorText).toBeInTheDocument();
    const dialog = errorText.closest("[role='dialog']");
    expect(dialog?.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("calls state.reset and parent onClose when the prompt-step cancel button is clicked", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByText("modals.aiWarmup.cancel"));
    expect(h.reset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
