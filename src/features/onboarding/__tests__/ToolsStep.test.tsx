import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ToolsStep } from "../steps/ToolsStep";
import { DEFAULT_TOOLS } from "../types";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Mail: () => <div data-testid="mail-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Send: () => <div data-testid="send-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  Brain: () => <div data-testid="brain-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

describe("ToolsStep", () => {
  const onNext = vi.fn();
  const onBack = vi.fn();

  it("renders all 6 tool options", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("AI Features")).toBeInTheDocument();
    expect(screen.getByText("Device Sync")).toBeInTheDocument();
  });

  it("mail and crm are enabled by default (from DEFAULT_TOOLS)", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    // All tools are togglable buttons — the checked state is indicated by styling
    // We verify by clicking Continue and checking what's passed
    fireEvent.click(screen.getByText("Continue"));
    expect(onNext).toHaveBeenCalledWith({
      mail: true,
      crm: true,
      campaigns: false,
      calendar: false,
      ai: false,
      sync: false,
    });
  });

  it("toggling a tool off then on passes correct state", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    // Toggle Campaigns on
    fireEvent.click(screen.getByText("Campaigns"));
    // Toggle CRM off
    fireEvent.click(screen.getByText("CRM"));
    fireEvent.click(screen.getByText("Continue"));
    expect(onNext).toHaveBeenCalledWith({
      mail: true,
      crm: false,
      campaigns: true,
      calendar: false,
      ai: false,
      sync: false,
    });
  });

  it("calls onBack when Back is clicked", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows description text for all tools", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    expect(screen.getByText("Multi-account inbox with smart threading")).toBeInTheDocument();
    expect(screen.getByText("Contact management with engagement scoring")).toBeInTheDocument();
    expect(screen.getByText("Sync across devices with offline support")).toBeInTheDocument();
  });
});
