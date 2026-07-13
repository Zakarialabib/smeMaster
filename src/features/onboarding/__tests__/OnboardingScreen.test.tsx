import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingScreen } from "../OnboardingScreen";

// Mock Tauri invoke for the useOnboarding hook
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock the onboarding invoke wrappers
vi.mock("@shared/services/db/invoke/onboarding", () => ({
  seedDemoPreset: vi.fn().mockResolvedValue(undefined),
  finalizeOnboarding: vi.fn().mockResolvedValue(undefined),
}));

// Mock lucide-react icons
vi.mock("lucide-react", async (importOriginal) => {
  return (await importOriginal()) as any;
});

describe("OnboardingScreen", () => {
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the welcome step by default", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText("Welcome to SMEMaster")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
    expect(screen.getByText("Skip to Demos")).toBeInTheDocument();
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
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

  it("shows 5 tool toggle options", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText("Mail")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("AI Features")).toBeInTheDocument();
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
    expect(screen.getByText("Pro Benefits")).toBeInTheDocument();
  });

  it("shows 5 pro benefits on completion step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.click(screen.getByText("Skip for now"));
    expect(screen.getByText(/Smart inbox with priority sorting/)).toBeInTheDocument();
    expect(screen.getByText(/AI writing assistant for composing/)).toBeInTheDocument();
    expect(screen.getByText(/Campaign analytics with open\/click tracking/)).toBeInTheDocument();
    expect(screen.getByText(/GDPR\/CCPA compliance tools/)).toBeInTheDocument();
    expect(screen.getByText(/Priority support with dedicated onboarding/)).toBeInTheDocument();
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

  it("skip to demos bypasses all steps and calls onComplete", async () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    await waitFor(() => {
      fireEvent.click(screen.getByText("Skip to Demos"));
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
    expect(screen.getByText("Mail")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument(); // sales_focused has calendar: false
    expect(screen.getByText("AI Features")).toBeInTheDocument();
  });

  it("theme selector appears on welcome step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByText("Theme Preference")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("shows business name input on welcome step", () => {
    render(<OnboardingScreen onComplete={onComplete} />);
    expect(screen.getByPlaceholderText("My Business")).toBeInTheDocument();
  });
});
