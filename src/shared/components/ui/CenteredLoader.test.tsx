import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CenteredLoader } from "./CenteredLoader";

describe("CenteredLoader", () => {
  it("renders the spinner with the default size (md)", () => {
    const { container } = render(<CenteredLoader />);
    const spinner = container.querySelector("div.w-8.h-8");
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveClass("border-accent/30");
    expect(spinner).toHaveClass("border-t-accent");
  });

  it("renders the spinner with the sm size", () => {
    const { container } = render(<CenteredLoader size="sm" />);
    const spinner = container.querySelector("div.w-4.h-4");
    expect(spinner).not.toBeNull();
  });

  it("renders the spinner with the lg size", () => {
    const { container } = render(<CenteredLoader size="lg" />);
    const spinner = container.querySelector("div.w-10.h-10");
    expect(spinner).not.toBeNull();
  });

  it("renders the label when provided", () => {
    render(<CenteredLoader label="Loading tasks…" />);
    expect(screen.getByText("Loading tasks…")).toBeInTheDocument();
  });

  it("does not render a label node when label is omitted", () => {
    const { container } = render(<CenteredLoader />);
    // The status container is the only <p> in the tree when label is omitted
    expect(container.querySelector("p")).toBeNull();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(<CenteredLoader className="py-12" />);
    expect(container.firstChild).toHaveClass("py-12");
  });

  it("marks the container with role=status and aria-live=polite", () => {
    const { container } = render(<CenteredLoader label="placeholders.loading" />);
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("marks the spinner as aria-hidden so screen readers skip it", () => {
    const { container } = render(<CenteredLoader label="placeholders.loading" />);
    const spinner = container.querySelector('[aria-hidden="true"]');
    expect(spinner).not.toBeNull();
  });

  it("uses a stacked column layout by default (inline=false)", () => {
    const { container } = render(<CenteredLoader label="placeholders.loading" />);
    const status = container.firstChild as HTMLElement;
    expect(status).toHaveClass("flex-col");
    expect(status).toHaveClass("py-6");
    expect(status).not.toHaveClass("inline-flex");
  });

  it("uses an inline row layout when inline=true (no column, no padding)", () => {
    const { container } = render(<CenteredLoader size="sm" inline />);
    const status = container.firstChild as HTMLElement;
    expect(status).toHaveClass("inline-flex");
    expect(status).toHaveClass("items-center");
    expect(status).not.toHaveClass("flex-col");
    expect(status).not.toHaveClass("py-6");
  });

  it("renders the label inline when inline=true (no leading vertical padding on label)", () => {
    const { container } = render(<CenteredLoader label="Generating…" inline />);
    const label = container.querySelector("p");
    expect(label).not.toBeNull();
    expect(label).toHaveClass("leading-none");
  });
});
