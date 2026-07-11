import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiGenerationFlow, type AiGenerationStateReturn } from "./AiGenerationFlow";

interface TestResult {
  name: string;
}

function makeState<T>(
  overrides: Partial<AiGenerationStateReturn<T>> = {},
): AiGenerationStateReturn<T> {
  return {
    step: "prompt",
    prompt: "",
    result: null,
    error: null,
    setPrompt: vi.fn(),
    generate: vi.fn().mockResolvedValue(undefined),
    regenerate: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    setResult: vi.fn(),
    ...overrides,
  } as AiGenerationStateReturn<T>;
}

const PROMPT_SLOT = (
  <div data-testid="prompt-slot">prompt form</div>
);
const PREVIEW_SLOT = (
  <div data-testid="preview-slot">preview</div>
);
const ERROR_SLOT = (
  <div data-testid="error-slot">error</div>
);

function renderFlow<T>(
  state: AiGenerationStateReturn<T>,
  props: Partial<React.ComponentProps<typeof AiGenerationFlow<T>>> = {},
) {
  return render(
    <AiGenerationFlow<T>
      state={state}
      isOpen
      onClose={vi.fn()}
      title="Test Modal"
      isLocked={false}
      generatingLabel="Generating…"
      promptSlot={() => PROMPT_SLOT}
      previewSlot={() => PREVIEW_SLOT}
      errorSlot={() => ERROR_SLOT}
      {...props}
    />,
  );
}

describe("AiGenerationFlow", () => {
  it("renders the title in the modal header", () => {
    renderFlow<TestResult>(makeState<TestResult>(), { title: "AI Workflow" });
    expect(screen.getByText("AI Workflow")).toBeInTheDocument();
  });

  it("renders the prompt slot when step is 'prompt'", () => {
    renderFlow<TestResult>(makeState<TestResult>({ step: "prompt" }));
    expect(screen.getByTestId("prompt-slot")).toBeInTheDocument();
  });

  it("renders the generating label and an animated spinner when step is 'generating'", () => {
    renderFlow<TestResult>(
      makeState<TestResult>({ step: "generating" }),
      { generatingLabel: "Generating workflow…", generatingSubLabel: "Designing rules" },
    );
    expect(screen.getByText("Generating workflow…")).toBeInTheDocument();
    expect(screen.getByText("Designing rules")).toBeInTheDocument();
    // Modal portal-renders to document.body, so query the body for the spinner
    const spinner = document.body.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("does not render the generating sub-label when not provided", () => {
    renderFlow<TestResult>(makeState<TestResult>({ step: "generating" }), {
      generatingLabel: "Generating…",
    });
    expect(screen.getByText("Generating…")).toBeInTheDocument();
    // No second paragraph for the sub-label
    expect(screen.queryByText("Designing rules")).not.toBeInTheDocument();
  });

  it("renders the preview slot when step is 'preview' and result is present", () => {
    const result: TestResult = { name: "x" };
    renderFlow<TestResult>(
      makeState<TestResult>({ step: "preview", result }),
    );
    expect(screen.getByTestId("preview-slot")).toBeInTheDocument();
  });

  it("does not render the preview slot when result is null even if step is 'preview'", () => {
    renderFlow<TestResult>(makeState<TestResult>({ step: "preview", result: null }));
    expect(screen.queryByTestId("preview-slot")).not.toBeInTheDocument();
  });

  it("renders the custom error slot when provided and step is 'error'", () => {
    renderFlow<TestResult>(
      makeState<TestResult>({ step: "error", error: "boom" }),
    );
    expect(screen.getByTestId("error-slot")).toBeInTheDocument();
  });

  it("renders the default error UI when errorSlot is not provided", () => {
    render(
      <AiGenerationFlow<TestResult>
        state={makeState<TestResult>({ step: "error", error: "Network down" })}
        isOpen
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={() => PROMPT_SLOT}
        previewSlot={() => PREVIEW_SLOT}
        retryLabel="Try again"
        cancelLabel="Cancel"
      />,
    );
    expect(screen.getByText("Network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("falls back to a generic message when error is null in error step", () => {
    render(
      <AiGenerationFlow<TestResult>
        state={makeState<TestResult>({ step: "error", error: null })}
        isOpen
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={() => PROMPT_SLOT}
        previewSlot={() => PREVIEW_SLOT}
      />,
    );
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
  });

  it("renders the locked banner when isLocked is true", () => {
    renderFlow<TestResult>(makeState<TestResult>(), { isLocked: true });
    // The default UpgradeBanner has the "Learn More" CTA
    expect(screen.getByText(/learn more/i)).toBeInTheDocument();
  });

  it("uses the custom lockedBanner when provided", () => {
    renderFlow<TestResult>(
      makeState<TestResult>(),
      { isLocked: true, lockedBanner: <div data-testid="custom-lock" /> },
    );
    expect(screen.getByTestId("custom-lock")).toBeInTheDocument();
    // The default UpgradeBanner should NOT be present
    expect(screen.queryByText(/learn more/i)).not.toBeInTheDocument();
  });

  it("does not render prompt/generating/preview/error slots when isLocked is true", () => {
    renderFlow<TestResult>(
      makeState<TestResult>({ step: "prompt" }),
      { isLocked: true },
    );
    expect(screen.queryByTestId("prompt-slot")).not.toBeInTheDocument();
  });

  it("calls state.reset and onClose when the modal close button is clicked", () => {
    const state = makeState<TestResult>();
    const onClose = vi.fn();
    render(
      <AiGenerationFlow<TestResult>
        state={state}
        isOpen
        onClose={onClose}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={() => PROMPT_SLOT}
        previewSlot={() => PREVIEW_SLOT}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close modal/i }));
    expect(state.reset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes state.generate and canGenerate=true to the prompt slot when prompt is non-empty", () => {
    const state = makeState<TestResult>({ prompt: "hello" });
    const promptSlot = vi.fn(() => PROMPT_SLOT);
    render(
      <AiGenerationFlow<TestResult>
        state={state}
        isOpen
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={promptSlot}
        previewSlot={() => PREVIEW_SLOT}
      />,
    );
    expect(promptSlot).toHaveBeenCalledWith(state.generate, true);
  });

  it("passes canGenerate=false to the prompt slot when prompt is empty", () => {
    const state = makeState<TestResult>({ prompt: "   " });
    const promptSlot = vi.fn(() => PROMPT_SLOT);
    render(
      <AiGenerationFlow<TestResult>
        state={state}
        isOpen
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={promptSlot}
        previewSlot={() => PREVIEW_SLOT}
      />,
    );
    expect(promptSlot).toHaveBeenCalledWith(state.generate, false);
  });

  it("passes result, regenerate, and reset to the preview slot", () => {
    const state = makeState<TestResult>({
      step: "preview",
      result: { name: "abc" },
    });
    const previewSlot = vi.fn(() => PREVIEW_SLOT);
    render(
      <AiGenerationFlow<TestResult>
        state={state}
        isOpen
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={() => PROMPT_SLOT}
        previewSlot={previewSlot}
      />,
    );
    expect(previewSlot).toHaveBeenCalledWith(
      { name: "abc" },
      state.regenerate,
      state.reset,
    );
  });

  it("passes error and retry (state.generate) to the custom error slot", () => {
    const state = makeState<TestResult>({
      step: "error",
      error: "Model overloaded",
    });
    const errorSlot = vi.fn(() => ERROR_SLOT);
    render(
      <AiGenerationFlow<TestResult>
        state={state}
        isOpen
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={() => PROMPT_SLOT}
        previewSlot={() => PREVIEW_SLOT}
        errorSlot={errorSlot}
      />,
    );
    expect(errorSlot).toHaveBeenCalledWith("Model overloaded", state.generate);
  });

  it("does not render any slot content when isOpen is false", () => {
    render(
      <AiGenerationFlow<TestResult>
        state={makeState<TestResult>({ step: "prompt" })}
        isOpen={false}
        onClose={vi.fn()}
        title="Test"
        isLocked={false}
        generatingLabel="Generating…"
        promptSlot={() => PROMPT_SLOT}
        previewSlot={() => PREVIEW_SLOT}
      />,
    );
    // The Modal's CSSTransition unmounts when closed, so prompt slot should be gone
    expect(screen.queryByTestId("prompt-slot")).not.toBeInTheDocument();
  });
});
