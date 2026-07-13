import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompletionStep } from "../steps/CompletionStep";
import type { OnboardingData } from "../types";

// Mock GlassPanel
vi.mock("@shared/components/ui/glass-panel", () => ({
  GlassPanel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="glass-panel">
      {children}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  CheckCircle2: () => <div data-testid="check-circle-icon" />,
  Inbox: () => <div data-testid="inbox-icon" />,
  Mail: () => <div data-testid="mail-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  Crown: () => <div data-testid="crown-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  Brain: () => <div data-testid="brain-icon" />,
}));

const BASE_DATA: OnboardingData = {
  step: 3,
  businessName: "Acme Corp",
  theme: "dark",
  tools: { mail: true, crm: true, campaigns: false, calendar: true, ai: false },
  demoPreset: "solo_freelancer",
  accountSkipped: true,
  emailConnected: false,
  acknowledgedPro: false,
};

describe("CompletionStep", () => {
  const onComplete = vi.fn();
  const onBack = vi.fn();

  it("renders heading with business name", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    // "Acme Corp" appears in both heading and summary — check it exists at least once
    expect(screen.getAllByText(/Acme Corp/)).toHaveLength(2);
  });

  it("shows summary card with theme and profile info", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getAllByText("Acme Corp")).toHaveLength(2); // heading + summary
    expect(screen.getByText(/Dark theme/)).toBeInTheDocument();
    expect(screen.getByText(/solo freelancer profile/)).toBeInTheDocument();
  });

  it("shows enabled tools as chips", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText("Mail")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Campaigns")).not.toBeInTheDocument();
    expect(screen.queryByText("AI Features")).not.toBeInTheDocument();
  });

  it("shows email connected status when connected", () => {
    const withEmail = { ...BASE_DATA, emailConnected: true };
    render(<CompletionStep data={withEmail} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText("Email connected")).toBeInTheDocument();
  });

  it("shows email not connected when skipped", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText("Email not connected")).toBeInTheDocument();
  });

  it("shows Pro Benefits section heading", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText("Pro Benefits")).toBeInTheDocument();
  });

  it("shows all 5 pro benefits", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText(/Smart inbox with priority sorting/)).toBeInTheDocument();
    expect(screen.getByText(/AI writing assistant for composing/)).toBeInTheDocument();
    expect(screen.getByText(/Campaign analytics with open\/click tracking/)).toBeInTheDocument();
    expect(screen.getByText(/GDPR\/CCPA compliance tools/)).toBeInTheDocument();
    expect(screen.getByText(/Priority support with dedicated onboarding/)).toBeInTheDocument();
  });

  it("calls onComplete when Start Using SMEMaster is clicked", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    fireEvent.click(screen.getByText("Start Using SMEMaster"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Back is clicked", () => {
    render(<CompletionStep data={BASE_DATA} onComplete={onComplete} onBack={onBack} />);
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("displays demo data tag when preset is skip", () => {
    const skipData = { ...BASE_DATA, demoPreset: "skip" as const };
    render(<CompletionStep data={skipData} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText(/Demo data/)).toBeInTheDocument();
  });

  it("displays custom profile when demoPreset is null", () => {
    const nullData = { ...BASE_DATA, demoPreset: null };
    render(<CompletionStep data={nullData} onComplete={onComplete} onBack={onBack} />);
    expect(screen.getByText(/custom profile/)).toBeInTheDocument();
  });
});
