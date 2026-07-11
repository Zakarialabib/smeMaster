import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeStep } from "../steps/WelcomeStep";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Sun: () => <div data-testid="sun-icon" />,
  Moon: () => <div data-testid="moon-icon" />,
  Monitor: () => <div data-testid="monitor-icon" />,
  User: () => <div data-testid="user-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Target: () => <div data-testid="target-icon" />,
  SlidersHorizontal: () => <div data-testid="sliders-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Rocket: () => <div data-testid="rocket-icon" />,
}));

describe("WelcomeStep", () => {
  const onNext = vi.fn();
  const onExpressMode = vi.fn();
  const onSkipToDemos = vi.fn();

  it("renders welcome heading and description", () => {
    render(<WelcomeStep onNext={onNext} />);
    expect(screen.getByText("Welcome to SMEMaster")).toBeInTheDocument();
    expect(screen.getByText(/All-in-one mail, CRM, and campaign management/)).toBeInTheDocument();
  });

  it("renders business name input with placeholder", () => {
    render(<WelcomeStep onNext={onNext} />);
    const input = screen.getByPlaceholderText("My Business");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("renders 3 theme options", () => {
    render(<WelcomeStep onNext={onNext} />);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders all 4 demo presets", () => {
    render(<WelcomeStep onNext={onNext} />);
    expect(screen.getByText("Solo Freelancer")).toBeInTheDocument();
    expect(screen.getByText("Small Team")).toBeInTheDocument();
    expect(screen.getByText("Sales Focused")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("disables Continue until a preset is selected", () => {
    render(<WelcomeStep onNext={onNext} />);
    expect(screen.getByText("Continue")).toBeDisabled();
  });

  it("enables Continue after selecting a preset", () => {
    render(<WelcomeStep onNext={onNext} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    expect(screen.getByText("Continue")).not.toBeDisabled();
  });

  it("calls onNext with correct data when Continue is clicked", () => {
    render(<WelcomeStep onNext={onNext} />);
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    expect(onNext).toHaveBeenCalledWith({
      businessName: "My Business",
      theme: "system",
      demoPreset: "solo_freelancer",
      tools: { mail: true, crm: true, campaigns: false, calendar: true, ai: false },
    });
  });

  it("includes custom business name in onNext payload", () => {
    render(<WelcomeStep onNext={onNext} />);
    fireEvent.change(screen.getByPlaceholderText("My Business"), { target: { value: "Acme Corp" } });
    fireEvent.click(screen.getByText("Solo Freelancer"));
    fireEvent.click(screen.getByText("Continue"));
    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ businessName: "Acme Corp" })
    );
  });

  it("calls onExpressMode when Quick Start is clicked", () => {
    render(<WelcomeStep onNext={onNext} onExpressMode={onExpressMode} />);
    fireEvent.click(screen.getByText("Quick Start"));
    expect(onExpressMode).toHaveBeenCalledTimes(1);
  });

  it("calls onSkipToDemos when Skip to Demos is clicked", () => {
    render(<WelcomeStep onNext={onNext} onSkipToDemos={onSkipToDemos} />);
    fireEvent.click(screen.getByText("Skip to Demos"));
    expect(onSkipToDemos).toHaveBeenCalledTimes(1);
  });

  it("renders Quick Start button only when onExpressMode is provided", () => {
    const { rerender } = render(<WelcomeStep onNext={onNext} />);
    expect(screen.queryByText("Quick Start")).not.toBeInTheDocument();

    rerender(<WelcomeStep onNext={onNext} onExpressMode={onExpressMode} />);
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
  });

  it("system theme is selected by default", () => {
    render(<WelcomeStep onNext={onNext} />);
    // System should show a check mark indicator
    const systemBtn = screen.getByText("System").closest("button");
    expect(systemBtn).toHaveClass("ring-2", "ring-accent/30");
  });

  it("theme selection changes when clicked", () => {
    render(<WelcomeStep onNext={onNext} />);
    fireEvent.click(screen.getByText("Dark"));
    const darkBtn = screen.getByText("Dark").closest("button");
    expect(darkBtn).toHaveClass("ring-2", "ring-accent/30");
    const systemBtn = screen.getByText("System").closest("button");
    expect(systemBtn).not.toHaveClass("ring-2");
  });
});
