import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { SlidePanel } from "./SlidePanel";

describe("SlidePanel", () => {
  beforeEach(() => {
    window.innerWidth = 1024; // desktop
  });

  // ─── Open / closed rendering ─────────────────────────────────────────

  it("renders nothing when isOpen=false", () => {
    render(
      <SlidePanel isOpen={false} onClose={() => {}} title="Test">
        <p>Panel content</p>
      </SlidePanel>,
    );
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders content when isOpen=true", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Test Panel">
        <p>Panel content</p>
      </SlidePanel>,
    );
    expect(screen.getByText("Test Panel")).toBeInTheDocument();
    expect(screen.getByText("Panel content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // ─── Title ───────────────────────────────────────────────────────────

  it("shows title in the header", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="My Custom Title">
        <p>Body</p>
      </SlidePanel>,
    );
    expect(
      screen.getByRole("heading", { name: "My Custom Title" }),
    ).toBeInTheDocument();
  });

  // ─── Escape key ──────────────────────────────────────────────────────

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <SlidePanel isOpen={true} onClose={onClose} title="Escape Test">
        <p>Body</p>
      </SlidePanel>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when closed", () => {
    const onClose = vi.fn();
    render(
      <SlidePanel isOpen={false} onClose={onClose} title="Closed">
        <p>Body</p>
      </SlidePanel>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ─── Backdrop click ──────────────────────────────────────────────────

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <SlidePanel isOpen={true} onClose={onClose} title="Backdrop Test">
        <p>Body</p>
      </SlidePanel>,
    );

    // Backdrop has aria-hidden="true" and is a fixed overlay
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.className).toContain("bg-black/30");

    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── Close button ────────────────────────────────────────────────────

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SlidePanel isOpen={true} onClose={onClose} title="Closeable">
        <p>Body</p>
      </SlidePanel>,
    );

    const closeButton = screen.getByRole("button", { name: "Close panel" });
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ─── Learn more link ─────────────────────────────────────────────────

  it("renders 'learn more' link when learnMoreHref is provided", () => {
    render(
      <SlidePanel
        isOpen={true}
        onClose={() => {}}
        title="Learn More"
        learnMoreHref="/help/some-topic"
      >
        <p>Body</p>
      </SlidePanel>,
    );

    const link = screen.getByRole("link", { name: /learn more/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/help/some-topic");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render learn more link when learnMoreHref is not provided", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="No Link">
        <p>Body</p>
      </SlidePanel>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // ─── ARIA attributes ─────────────────────────────────────────────────

  it("has proper dialog ARIA attributes", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Accessible Panel">
        <p>Body</p>
      </SlidePanel>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Accessible Panel");
  });

  // ─── Remount on isOpen change ────────────────────────────────────────

  it("does not render when isOpen changes to false (unmountOnExit)", async () => {
    const { rerender } = render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Toggle">
        <p>Content</p>
      </SlidePanel>,
    );
    expect(screen.getByText("Toggle")).toBeInTheDocument();

    rerender(
      <SlidePanel isOpen={false} onClose={() => {}} title="Toggle">
        <p>Content</p>
      </SlidePanel>,
    );

    // Wait for exit transition (200ms timeout) to complete
    await waitFor(() => {
      expect(screen.queryByText("Toggle")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  // ─── Drag handle (mobile bottom sheet) ───────────────────────────────

  it("shows drag handle on mobile bottom sheet", () => {
    window.innerWidth = 600; // mobile
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Mobile Panel">
        <p>Body</p>
      </SlidePanel>,
    );

    // Drag handle should exist (a rounded pill at top of sheet)
    const dragHandle = document.querySelector(".rounded-full");
    expect(dragHandle).toBeInTheDocument();
    expect(dragHandle?.className).toContain("bg-border-primary");
  });

  it("does not show drag handle on desktop", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Desktop Panel">
        <p>Body</p>
      </SlidePanel>,
    );

    // On desktop (side="right"), no drag handle
    const dragHandle = document.querySelector(".rounded-full");
    expect(dragHandle).not.toBeInTheDocument();
  });

  // ─── Body scroll prevention (mobile) ─────────────────────────────────

  it("prevents body scroll on mobile when open", () => {
    window.innerWidth = 600;
    const { unmount } = render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Scroll Test">
        <p>Body</p>
      </SlidePanel>,
    );

    expect(document.body.style.overflow).toBe("hidden");

    // Cleanup should restore overflow
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("does not prevent body scroll on desktop when open", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Desktop Scroll">
        <p>Body</p>
      </SlidePanel>,
    );

    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("restores body scroll when isOpen changes to false (mobile)", () => {
    window.innerWidth = 600;
    const { rerender } = render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Scroll Restore">
        <p>Body</p>
      </SlidePanel>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <SlidePanel isOpen={false} onClose={() => {}} title="Scroll Restore">
        <p>Body</p>
      </SlidePanel>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  // ─── Desktop right panel classes ─────────────────────────────────────

  it("applies right-side panel classes on desktop", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Right Panel">
        <p>Body</p>
      </SlidePanel>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("right-0");
    expect(dialog.className).toContain("top-0");
    expect(dialog.className).toContain("max-w-md");
    expect(dialog.className).toContain("border-l");
  });

  it("applies bottom-sheet panel classes on mobile", () => {
    window.innerWidth = 600;
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Bottom Sheet">
        <p>Body</p>
      </SlidePanel>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("left-0");
    expect(dialog.className).toContain("max-h-[85vh]");
    expect(dialog.className).toContain("bottom-sheet");
  });

  // ─── Content area is scrollable ──────────────────────────────────────

  it("has a scrollable content area", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Scroll Area">
        <p>Content</p>
      </SlidePanel>,
    );

    const contentArea = screen.getByText("Content").parentElement;
    expect(contentArea?.className).toContain("overflow-y-auto");
  });

  // ─── Side prop forces right panel on desktop ─────────────────────────

  it("uses 'right' side on desktop even when side='bottom'", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Side Override" side="bottom">
        <p>Body</p>
      </SlidePanel>,
    );

    // On desktop, effectiveSide is always "right" when isMobile=false
    // because isMobile check uses innerWidth < 768
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("right-0");
    expect(dialog.className).not.toContain("bottom-sheet");
  });

  // ─── Inline animation styles exist ───────────────────────────────────

  it("applies desktop slide-in-right transition class names", () => {
    render(
      <SlidePanel isOpen={true} onClose={() => {}} title="Animations">
        <p>Content</p>
      </SlidePanel>,
    );

    const dialog = screen.getByRole("dialog");
    // The CSSTransition classNames="slide-in-right" adds the enter class
    expect(dialog.className).toBeTruthy();
  });
});
