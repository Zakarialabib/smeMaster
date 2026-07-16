import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingScreen } from "../OnboardingScreen";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@shared/services/db/invoke/onboarding", () => ({
  seedDemoPreset: vi.fn().mockResolvedValue(undefined),
  finalizeOnboarding: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("lucide-react", async (importOriginal) => {
  return (await importOriginal()) as any;
});

describe("OnboardingScreen", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // OnboardingScreen persists the active step in sessionStorage; clear it so
    // each test starts on the welcome step instead of inheriting a step from a
    // previous (navigating) test.
    sessionStorage.clear();
  });

  it("renders actions on the welcome step by default", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getAllByText("Continue").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Skip to Demos")).toBeInTheDocument();
    expect(screen.getAllByText("Quick Start").length).toBeGreaterThanOrEqual(1);
  });

  it("shows all 4 demo preset options", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText("Solo Freelancer")).toBeInTheDocument();
    expect(screen.getByText("Small Team")).toBeInTheDocument();
    expect(screen.getByText("Sales Focused")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("disables Continue until a preset is selected", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    const continues = screen.getAllByText("Continue");
    for (const btn of continues) {
      expect(btn.closest("button")).toBeDisabled();
    }
  });

  it("enables Continue after selecting a preset", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    const continues = screen.getAllByText("Continue");
    expect(continues.some((btn) => !btn.closest("button")?.hasAttribute("disabled"))).toBe(true);
  });

  it("navigates to tools step after clicking Continue", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getAllByText("Continue")[0]);
    expect(screen.getByText("Mail")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
  });

  it("navigates through tools to account step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getAllByText("Continue")[0]);
    expect(screen.getAllByText(/connect/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/skip for now/i).length).toBeGreaterThan(0);
  });

  it("completes to the final screen via skip", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getByText("Skip for now"));
    expect(screen.getAllByText(/pro/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/start using/i).length).toBeGreaterThan(0);
  });

  it("shows pro benefits on completion step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getByText("Skip for now"));
    expect(screen.getAllByText(/smart inbox|priority/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/writing assistant/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/analytics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/compliance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/priority support|dedicated onboarding/i).length).toBeGreaterThan(0);
  });

  it("calls onComplete when clicking final CTA", async () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getByText("Skip for now"));
    await waitFor(() => {
      fireEvent.click(screen.getByText(/start using/i));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("quick start bypasses all steps and calls onComplete", async () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    await waitFor(() => {
      fireEvent.click(screen.getAllByText("Quick Start")[0]);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skip to demos bypasses all steps and calls onComplete", async () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText("Skip to Demos"));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("back button returns to welcome step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getAllByText("Continue")[0]);
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Continue")).toBeInTheDocument();
    expect(screen.getByText("Solo Freelancer")).toBeInTheDocument();
  });

  it("theme selector appears on welcome step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("shows business name input on welcome step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByPlaceholderText("My Business")).toBeInTheDocument();
  });
});
