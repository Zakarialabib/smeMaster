import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdaptiveBottomSheet } from "./AdaptiveBottomSheet";

describe("AdaptiveBottomSheet", () => {
  it("renders title when open", () => {
    render(
      <AdaptiveBottomSheet isOpen={true} onClose={vi.fn()} title="Test Sheet">
        Content
      </AdaptiveBottomSheet>,
    );
    expect(screen.getByText("Test Sheet")).toBeDefined();
  });

  it("renders children when open", () => {
    render(
      <AdaptiveBottomSheet isOpen={true} onClose={vi.fn()} title="Test">
        Hello World
      </AdaptiveBottomSheet>,
    );
    expect(screen.getByText("Hello World")).toBeDefined();
  });

  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(
      <AdaptiveBottomSheet isOpen={true} onClose={onClose} title="Test">
        Content
      </AdaptiveBottomSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("is hidden when isOpen is false", () => {
    render(
      <AdaptiveBottomSheet isOpen={false} onClose={vi.fn()} title="Test">
        Content
      </AdaptiveBottomSheet>,
    );
    const container = screen.getByText("Test").closest("[aria-hidden]");
    expect(container?.getAttribute("aria-hidden")).toBe("true");
  });
});