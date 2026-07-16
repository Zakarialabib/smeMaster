import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountSetupStep } from "../steps/AccountSetupStep";

vi.mock("@features/accounts/components/AddAccount", () => ({
  AddAccount: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="add-account">
      <button onClick={onSuccess} data-testid="mock-add-success">
        Mock Add Account
      </button>
    </div>
  ),
}));

vi.mock("@shared/components/ui/glass-panel", () => ({
  GlassPanel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="glass-panel">
      {children}
    </div>
  ),
}));

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
    expect(screen.getByText(/connect your email/i)).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("renders provider options", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    expect(screen.getByText(/Gmail|Google/)).toBeInTheDocument();
    expect(screen.getByText(/Outlook|Office/i)).toBeInTheDocument();
    expect(screen.getByText(/IMAP|SMTP/i)).toBeInTheDocument();
  });

  it("shows reminder banner when mailSelected is true", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} mailSelected />);
    expect(screen.getAllByText(/you selected mail/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/feature/i).length).toBeGreaterThan(0);
  });

  it("hides reminder banner when mailSelected is false", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} mailSelected={false} />);
    expect(screen.queryByText(/You selected mail/i)).not.toBeInTheDocument();
  });

  it("opens AddAccount modal when a provider is clicked", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText(/Gmail|Google/));
    expect(screen.getByTestId("add-account")).toBeInTheDocument();
  });

  it("shows success view after account is connected", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText(/Gmail|Google/));
    fireEvent.click(screen.getByTestId("mock-add-success"));
    expect(screen.getAllByText(/connected/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/configured successfully/i).length).toBeGreaterThan(0);
  });

  it("calls onNext with connected status when continuing after connect", () => {
    render(<AccountSetupStep onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText(/Gmail|Google/));
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
    fireEvent.click(screen.getByText(/Gmail|Google/));
    expect(screen.getByTestId("add-account")).toBeInTheDocument();
    const closeBtn = screen.getByTestId("x-icon").closest("button");
    fireEvent.click(closeBtn!);
    expect(screen.queryByTestId("add-account")).not.toBeInTheDocument();
  });
});
