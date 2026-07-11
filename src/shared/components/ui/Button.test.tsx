import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("renders with an icon and children", () => {
    render(
      <Button icon={<span data-testid="icon">I</span>}>
        Save
      </Button>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("applies primary variant classes", () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-accent");
    expect(btn.className).toContain("text-white");
  });

  it("applies secondary variant classes by default", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("text-text-secondary");
    expect(btn.className).toContain("hover:bg-bg-hover");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("text-text-tertiary");
  });

  it("applies danger variant classes", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-danger");
  });

  it("applies iconOnly sizing", () => {
    render(<Button iconOnly size="md" icon={<span>X</span>} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("p-2");
    // Should NOT contain px- classes for non-iconOnly
    expect(btn.className).not.toContain("px-4");
  });

  it("applies standard sizing for non-iconOnly", () => {
    render(<Button size="md">Medium</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-4");
    expect(btn.className).toContain("text-sm");
  });

  it("applies xs size", () => {
    render(<Button size="xs">Tiny</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-2");
    expect(btn.className).toContain("py-1");
  });

  it("handles disabled state", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clickable</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("custom-class");
  });

  it("passes through additional HTML attributes", () => {
    render(<Button title="tooltip" data-testid="my-btn">Attrs</Button>);
    const btn = screen.getByTestId("my-btn");
    expect(btn).toHaveAttribute("title", "tooltip");
  });

  it("forwards ref to the button element", () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
