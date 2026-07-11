import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("renders with role='switch' and aria-checked='true' when checked", () => {
    render(<Toggle checked onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("renders with role='switch' and aria-checked='false' when unchecked", () => {
    render(<Toggle checked={false} onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("click on unchecked toggle calls onChange(true) exactly once", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("click on checked toggle calls onChange(false) exactly once", () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("forwards the aria-label to the switch button", () => {
    render(<Toggle checked={false} onChange={() => {}} aria-label="Enable filter" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Enable filter");
  });

  it("clicking a disabled toggle does NOT call onChange", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the optional label text next to the switch", () => {
    render(<Toggle checked={false} onChange={() => {}} label="Receive notifications" />);
    expect(screen.getByText("Receive notifications")).toBeInTheDocument();
  });

  it("applies md size (w-11 h-6) by default", () => {
    render(<Toggle checked={false} onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle.className).toContain("w-11");
    expect(toggle.className).toContain("h-6");
  });

  it("applies sm size (w-8 h-4) when size='sm' is requested — matches the inline pattern being replaced", () => {
    render(<Toggle checked={false} onChange={() => {}} size="sm" />);
    const toggle = screen.getByRole("switch");
    expect(toggle.className).toContain("w-8");
    expect(toggle.className).toContain("h-4");
  });

  it("applies md size (w-11 h-6) when size='md' is requested", () => {
    render(<Toggle checked={false} onChange={() => {}} size="md" />);
    const toggle = screen.getByRole("switch");
    expect(toggle.className).toContain("w-11");
    expect(toggle.className).toContain("h-6");
  });

  it("keyboard Enter on focused toggle calls onChange once", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch");
    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
