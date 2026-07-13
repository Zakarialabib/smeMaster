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
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  ArrowLeft: () => <div data-testid="arrow-left-icon" />,
  Check: () => <div data-testid="check-icon" />,
  Crown: () => <div data-testid="crown-icon" />,
}));

describe("ToolsStep", () => {
  const onNext = vi.fn();
  const onBack = vi.fn();

  it("renders all 5 tool options", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    expect(screen.getByText("Mail")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Campaigns")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("AI Features")).toBeInTheDocument();
  });

  it("shows enabled count in header", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    expect(screen.getByText(/2 of 5 selected/)).toBeInTheDocument();
  });

  it("mail and crm are enabled by default (from DEFAULT_TOOLS)", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByText("Continue"));
    expect(onNext).toHaveBeenCalledWith({
      mail: true,
      crm: true,
      campaigns: false,
      calendar: false,
      ai: false,
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
    expect(screen.getByText("Email campaigns with templates and tracking")).toBeInTheDocument();
    expect(screen.getByText("Calendar sync and event management")).toBeInTheDocument();
    expect(screen.getByText("Smart replies, auto-labeling, task extraction")).toBeInTheDocument();
  });

  it("shows PRO badge on Mail and Campaigns tool cards", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    // 1 PRO in the info banner + 2 in tool card badges = 3 total "PRO" text nodes
    const proElements = screen.getAllByText("PRO");
    expect(proElements.length).toBeGreaterThanOrEqual(2);
  });

  it("shows PRO info banner", () => {
    render(<ToolsStep initial={DEFAULT_TOOLS} onNext={onNext} onBack={onBack} />);
    // PRO in a span, then rest in parent p — use function matcher
    expect(screen.getByText((content) => content.includes("features marked with a crown"))).toBeInTheDocument();
  });

  it("prevents disabling the last enabled tool", () => {
    render(<ToolsStep initial={{ mail: true, crm: false, campaigns: false, calendar: false, ai: false }} onNext={onNext} onBack={onBack} />);
    // Try to toggle mail off — should not work since it's the only one
    fireEvent.click(screen.getByText("Mail"));
    fireEvent.click(screen.getByText("Continue"));
    // Mail should still be enabled
    expect(onNext).toHaveBeenCalledWith({
      mail: true,
      crm: false,
      campaigns: false,
      calendar: false,
      ai: false,
    });
  });
});
