import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders title and children when open", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Title">
        <p>Modal content</p>
      </Modal>,
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        <p>Should not show</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
    expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Closeable">
        <p>Content</p>
      </Modal>,
    );
    // The close button contains the multiplication sign character
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Backdrop Test">
        <p>Content</p>
      </Modal>,
    );
    // The backdrop is the first child with the fixed overlay class
    const container = document.querySelector(".fixed.inset-0");
    const backdrop = container?.children[0] as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Escape Test">
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when closed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={false} onClose={onClose} title="Closed">
        <p>Content</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies custom width", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Wide" width="w-full max-w-md">
        <p>Content</p>
      </Modal>,
    );
    const panel = document.querySelector(".modal-panel");
    expect(panel?.className).toContain("max-w-md");
  });

  it("applies custom zIndex", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Z" zIndex="z-[200]">
        <p>Content</p>
      </Modal>,
    );
    const overlay = document.querySelector(".fixed");
    expect(overlay?.className).toContain("z-[200]");
  });

  it("applies panelClassName", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Panel" panelClassName="shadow-xl">
        <p>Content</p>
      </Modal>,
    );
    const panel = document.querySelector(".modal-panel");
    expect(panel?.className).toContain("shadow-xl");
  });

  it("renders custom header via renderHeader prop", () => {
    const customHeader = <div data-testid="custom-header">Custom Header</div>;
    render(
      <Modal isOpen={true} onClose={() => {}} title="Ignored" renderHeader={customHeader}>
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByTestId("custom-header")).toBeInTheDocument();
    expect(screen.getByText("Custom Header")).toBeInTheDocument();
    // Default header title should NOT be rendered
    expect(screen.queryByText("Ignored")).not.toBeInTheDocument();
  });
});
