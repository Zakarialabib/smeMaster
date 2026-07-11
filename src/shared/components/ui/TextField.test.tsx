import { render, screen, fireEvent } from "@testing-library/react";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("renders an input element", () => {
    render(<TextField placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("renders a label when provided", () => {
    render(<TextField label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("derives the id from the label text", () => {
    render(<TextField label="Client ID" />);
    const input = screen.getByLabelText("Client ID");
    expect(input).toHaveAttribute("id", "client-id");
  });

  it("uses a custom id when provided", () => {
    render(<TextField label="Name" id="custom-id" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("id", "custom-id");
  });

  it("renders without a label", () => {
    render(<TextField placeholder="No label" />);
    const input = screen.getByPlaceholderText("No label");
    expect(input).toBeInTheDocument();
    expect(input.parentElement?.querySelector("label")).toBeNull();
  });

  it("applies sm size classes by default", () => {
    render(<TextField placeholder="sm" />);
    const input = screen.getByPlaceholderText("sm");
    expect(input.className).toContain("py-1.5");
  });

  it("applies md size classes", () => {
    render(<TextField size="md" placeholder="md" />);
    const input = screen.getByPlaceholderText("md");
    expect(input.className).toContain("py-2");
  });

  it("displays an error message", () => {
    render(<TextField error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("applies border-danger class when error is present", () => {
    render(<TextField error="Invalid" placeholder="err" />);
    const input = screen.getByPlaceholderText("err");
    expect(input.className).toContain("border-danger");
  });

  it("applies base input class when no error", () => {
    render(<TextField placeholder="ok" />);
    const input = screen.getByPlaceholderText("ok");
    expect(input.className).toContain("glass-input");
    expect(input.className).not.toContain("border-danger");
  });

  it("passes through value and onChange", () => {
    const onChange = vi.fn();
    render(<TextField value="hello" onChange={onChange} />);
    const input = screen.getByDisplayValue("hello");
    fireEvent.change(input, { target: { value: "world" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("passes through type, placeholder, and disabled props", () => {
    render(<TextField type="password" placeholder="secret" disabled />);
    const input = screen.getByPlaceholderText("secret");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toBeDisabled();
  });

  it("merges custom className on the wrapper div", () => {
    const { container } = render(<TextField className="mt-4" placeholder="wrap" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("mt-4");
  });

  it("forwards ref to the input element", () => {
    const ref = { current: null } as React.RefObject<HTMLInputElement | null>;
    render(<TextField ref={ref} placeholder="ref-test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through additional HTML attributes", () => {
    render(<TextField data-testid="my-input" autoFocus required />);
    const input = screen.getByTestId("my-input");
    expect(input).toBeRequired();
  });
});
