import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingScreen } from "../OnboardingScreen";

// Mock Tauri invoke for the useOnboarding hook
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock lucide-react with the real module so every icon export resolves
// (the onboarding subtree renders several icons not worth stubbing individually).
vi.mock("lucide-react", async (importOriginal) => {
  return (await importOriginal()) as any;
});

describe("OnboardingScreen", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // OnboardingScreen persists the active step in sessionStorage; clear it
    // so every test starts on the welcome step (step 0).
    sessionStorage.clear();
  });

  it("renders the welcome step by default", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText("Welcome to SMEMaster")).toBeInTheDocument();
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
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
    const continueBtn = screen.getByText("Continue");
    expect(continueBtn).toBeDisabled();
  });

  it("enables Continue after selecting a preset", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    const continueBtn = screen.getByText("Continue");
    expect(continueBtn).not.toBeDisabled();
  });

  it("navigates to tools step after clicking Continue", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText("Choose Your Features")).toBeInTheDocument();
  });

  it("shows 6 tool toggle options", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("AI Features")).toBeInTheDocument();
    expect(screen.getByText("Device Sync")).toBeInTheDocument();
  });

  it("navigates to account setup step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText("Connect Your Email")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("navigates to completion step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Skip for now"));
    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    expect(screen.getByText("Start Using SMEMaster")).toBeInTheDocument();
    expect(screen.getByText("Pro Tips")).toBeInTheDocument();
  });

  it("shows 4 pro tips on completion step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Skip for now"));
    expect(screen.getByText(/Use ` to open the command palette/)).toBeInTheDocument();
    expect(screen.getByText(/Tag your contacts/)).toBeInTheDocument();
    expect(screen.getByText(/Configure auto-labeling rules/)).toBeInTheDocument();
    expect(screen.getByText(/AI features can draft replies/)).toBeInTheDocument();
  });

  it("calls onComplete when clicking Start Using SMEMaster", async () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Skip for now"));
    await waitFor(() => {
      fireEvent.click(screen.getByText("Start Using SMEMaster"));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("quick start bypasses all steps and calls onComplete", async () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText("Quick Start"));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("back button works on tools step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Back"));
    expect(screen.getByText("Welcome to SMEMaster")).toBeInTheDocument();
  });

  it("shows progress sidebar on desktop", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText("Setup wizard")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("preserves selected preset data through all steps", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Sales Focused"));
    fireEvent.click(screen.getByText("Continue"));
    // Tools step - click Continue to accept preset tools
    fireEvent.click(screen.getByText("Continue"));
    // Account step - skip
    fireEvent.click(screen.getByText("Skip for now"));
    // Completion step should show sales_focused features as chips
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("AI Features")).toBeInTheDocument();
    expect(screen.getByText("Device Sync")).toBeInTheDocument();
  });
});
