import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountSetupStep } from "../steps/AccountSetupStep";

// Mock the AddAccount component
vi.mock("@features/accounts/components/AddAccount", () => ({
  AddAccount: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="add-account">
      <button onClick={onSuccess} data-testid="mock-add-success">
        Mock Add Account
      </button>
    </div>
  ),
}));

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
  Mail: () => <div data-testid="mail-icon" />,
  Globe: () => <div data-testid="globe-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

describe("AccountSetupStep", () => {
  const onNext = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the connect email view by default", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    expect(screen.getByText("Connect Your Email")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("renders 3 provider options", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    expect(screen.getByText("Gmail / Google Workspace")).toBeInTheDocument();
    expect(screen.getByText("Microsoft Outlook / Office365")).toBeInTheDocument();
    expect(screen.getByText("Other (IMAP / SMTP)")).toBeInTheDocument();
  });

  it("shows reminder banner when mailSelected is true", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} mailSelected={true} />);
    // Text is split across elements: "You selected " <span>Mail</span> " as a feature..."
    expect(screen.getByText((content) => content.includes("You selected") && content.includes("as a feature"))).toBeInTheDocument();
  });

  it("hides reminder banner when mailSelected is false", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} mailSelected={false} />);
    expect(screen.queryByText(/You selected Mail as a feature/)).not.toBeInTheDocument();
  });

  it("opens AddAccount modal when a provider is clicked", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Gmail / Google Workspace"));
    expect(screen.getByTestId("add-account")).toBeInTheDocument();
  });

  it("shows success view after account is connected", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Gmail / Google Workspace"));
    // Simulate successful account creation
    fireEvent.click(screen.getByTestId("mock-add-success"));
    expect(screen.getByText("Email Connected!")).toBeInTheDocument();
    expect(screen.getByText("1 account configured successfully")).toBeInTheDocument();
  });

  it("calls onNext with connected status when continuing after connect", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Gmail / Google Workspace"));
    fireEvent.click(screen.getByTestId("mock-add-success"));
    fireEvent.click(screen.getByText("Continue"));
    expect(onNext).toHaveBeenCalledWith({ accountSkipped: false, emailConnected: true });
  });

  it("calls onNext with skipped status when Skip for now is clicked", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Skip for now"));
    expect(onNext).toHaveBeenCalledWith({ accountSkipped: true, emailConnected: false });
  });

  it("calls onBack when Back is clicked", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("closes modal when X is clicked", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Gmail / Google Workspace"));
    expect(screen.getByTestId("add-account")).toBeInTheDocument();
    // Click the close button
    const closeBtn = screen.getByTestId("x-icon").closest("button");
    fireEvent.click(closeBtn!);
    expect(screen.queryByTestId("add-account")).not.toBeInTheDocument();
  });
});
