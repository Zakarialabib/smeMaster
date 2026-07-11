import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InfoTooltip } from "./InfoTooltip";

describe("InfoTooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default viewport width is 1024 (desktop)
    window.innerWidth = 1024;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Icon trigger ─────────────────────────────────────────────────────

  it("renders with icon trigger when icon=true and no children", () => {
    render(<InfoTooltip content="Help text" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("?");
  });

  it("does not render trigger when icon=false and no children", () => {
    render(<InfoTooltip content="Help text" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // ─── Children trigger ─────────────────────────────────────────────────

  it("renders with children when provided", () => {
    render(
      <InfoTooltip content="Help text">
        <span data-testid="custom-trigger">Hover me</span>
      </InfoTooltip>,
    );
    expect(screen.getByTestId("custom-trigger")).toBeInTheDocument();
    expect(screen.getByText("Hover me")).toBeInTheDocument();
    // Should NOT have the "?" icon
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  // ─── Desktop hover behavior ──────────────────────────────────────────

  it("shows tooltip content on mouse enter (desktop)", () => {
    render(
      <InfoTooltip content="Tooltip body" icon />,
    );
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(300); });

    expect(screen.getByText("Tooltip body")).toBeInTheDocument();
  });

  it("hides tooltip content on mouse leave (desktop)", () => {
    render(<InfoTooltip content="Tooltip body" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    // Show
    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText("Tooltip body")).toBeInTheDocument();

    // Hide
    fireEvent.mouseLeave(trigger);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.queryByText("Tooltip body")).not.toBeInTheDocument();
  });

  // ─── Mobile tap behavior ─────────────────────────────────────────────

  it("shows tooltip on click (mobile)", () => {
    window.innerWidth = 600; // < 768 → mobile
    render(<InfoTooltip content="Mobile tooltip" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.click(trigger);

    expect(screen.getByText("Mobile tooltip")).toBeInTheDocument();
  });

  it("toggles tooltip on second click (mobile)", () => {
    window.innerWidth = 600;
    render(<InfoTooltip content="Toggle me" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    // First click — show
    fireEvent.click(trigger);
    expect(screen.getByText("Toggle me")).toBeInTheDocument();

    // Second click — hide
    fireEvent.click(trigger);
    expect(screen.queryByText("Toggle me")).not.toBeInTheDocument();
  });

  // ─── Backdrop dismiss (mobile) ───────────────────────────────────────

  it("hides tooltip when clicking backdrop (mobile)", () => {
    window.innerWidth = 600;
    render(<InfoTooltip content="Backdrop test" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    // Show tooltip
    fireEvent.click(trigger);
    expect(screen.getByText("Backdrop test")).toBeInTheDocument();

    // Backdrop is the fixed inset-0 div with aria-hidden=true
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute("aria-hidden", "true");

    // Click backdrop
    fireEvent.click(backdrop!);
    expect(screen.queryByText("Backdrop test")).not.toBeInTheDocument();
  });

  it("does not render backdrop on desktop", () => {
    render(<InfoTooltip content="No backdrop" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText("No backdrop")).toBeInTheDocument();

    // No backdrop should be rendered (only on mobile)
    expect(document.querySelector(".fixed.inset-0")).not.toBeInTheDocument();
  });

  // ─── Side prop ───────────────────────────────────────────────────────

  it.each(["top", "bottom", "left", "right"] as const)(
    "respects side=%s for positioning",
    (side) => {
      render(<InfoTooltip content={`${side} tooltip`} icon side={side} />);
      const trigger = screen.getByRole("button", { name: "More information" });

      fireEvent.mouseEnter(trigger);
      act(() => { vi.advanceTimersByTime(300); });

      const tooltip = screen.getByText(`${side} tooltip`);
      // The tooltip content is inside a positioned div — verify it's rendered
      expect(tooltip).toBeInTheDocument();

      // Verify the tooltip content div has absolute positioning
      expect(tooltip.className).toContain("absolute");
    },
  );

  // ─── Animation classes (reduce motion) ───────────────────────────────

  it("renders tooltip content with proper base classes", () => {
    render(<InfoTooltip content="Animated" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(300); });

    // The tooltip content is inside a div positioned with absolute
    const tooltipText = screen.getByText("Animated");
    expect(tooltipText).toBeInTheDocument();
    const tooltipDiv = tooltipText.closest(".absolute");
    expect(tooltipDiv?.className).toContain("rounded-lg");
  });

  // ─── Keyboard accessibility ──────────────────────────────────────────

  it("toggles on Enter key press (mobile)", () => {
    window.innerWidth = 600;
    render(<InfoTooltip content="Keyboard test" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    // Show with Enter
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByText("Keyboard test")).toBeInTheDocument();

    // Hide with Enter
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.queryByText("Keyboard test")).not.toBeInTheDocument();
  });

  it("toggles on Space key press (mobile)", () => {
    window.innerWidth = 600;
    render(<InfoTooltip content="Space test" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.keyDown(trigger, { key: " " });
    expect(screen.getByText("Space test")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: " " });
    expect(screen.queryByText("Space test")).not.toBeInTheDocument();
  });

  // ─── ARIA attributes ─────────────────────────────────────────────────

  it("has proper aria and role attributes", () => {
    render(<InfoTooltip content="ARIA test" icon />);

    // Outer wrapper
    const wrapper = screen.getByRole("tooltip");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.className).toContain("relative");

    // Trigger button
    const trigger = screen.getByRole("button", { name: "More information" });
    expect(trigger).toHaveAttribute("aria-label", "More information");
    expect(trigger).toHaveAttribute("tabindex", "0");

    // Desktop: no aria-expanded until hover
    expect(trigger).not.toHaveAttribute("aria-expanded");
  });

  it("sets aria-expanded when visible on mobile", () => {
    window.innerWidth = 600;
    render(<InfoTooltip content="ARIA expanded" icon />);
    const trigger = screen.getByRole("button", { name: "More information" });

    // Click to open
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Click to close
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  // ─── Delay prop ──────────────────────────────────────────────────────

  it("respects delay prop before showing tooltip", () => {
    render(<InfoTooltip content="Delayed" icon delay={500} />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.mouseEnter(trigger);

    // Should not be visible before delay
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByText("Delayed")).not.toBeInTheDocument();

    // Should appear after full delay
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText("Delayed")).toBeInTheDocument();
  });

  it("cancels show timer on mouse leave before delay expires", () => {
    render(<InfoTooltip content="Cancelled" icon delay={300} />);
    const trigger = screen.getByRole("button", { name: "More information" });

    fireEvent.mouseEnter(trigger);
    act(() => { vi.advanceTimersByTime(150); });

    // Leave before delay completes
    fireEvent.mouseLeave(trigger);
    act(() => { vi.advanceTimersByTime(300); });

    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
  });

  // ─── Children with icon=false (no icon, no children) ─────────────────

  it("renders nothing when icon=false and no children", () => {
    const { container } = render(<InfoTooltip content="Hidden" />);
    // Only the outer span with role="tooltip" should exist
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    // No trigger should be rendered inside
    expect(tooltip.children.length).toBe(0);
  });
});
