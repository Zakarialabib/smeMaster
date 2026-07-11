import { render, screen, fireEvent } from "@testing-library/react";
import { InputDialog } from "./InputDialog";

describe("InputDialog", () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    title: "New Item",
    fields: [{ key: "name", label: "Name", placeholder: "Enter name" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and fields when open", () => {
    render(<InputDialog {...baseProps} />);
    expect(screen.getByText("New Item")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<InputDialog {...baseProps} isOpen={false} />);
    expect(screen.queryByText("New Item")).not.toBeInTheDocument();
  });

  it("renders multiple fields", () => {
    render(
      <InputDialog
        {...baseProps}
        fields={[
          { key: "name", label: "Name" },
          { key: "query", label: "Query" },
        ]}
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Query")).toBeInTheDocument();
  });

  it("calls onSubmit with field values", () => {
    render(<InputDialog {...baseProps} />);
    const input = screen.getByPlaceholderText("Enter name");
    fireEvent.change(input, { target: { value: "My Folder" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(baseProps.onSubmit).toHaveBeenCalledWith({ name: "My Folder" });
  });

  it("submit button is disabled when required field is empty", () => {
    render(<InputDialog {...baseProps} />);
    const submitBtn = screen.getByRole("button", { name: "Save" });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button enables when required field has value", () => {
    render(<InputDialog {...baseProps} />);
    const input = screen.getByPlaceholderText("Enter name");
    fireEvent.change(input, { target: { value: "test" } });
    const submitBtn = screen.getByRole("button", { name: "Save" });
    expect(submitBtn).not.toBeDisabled();
  });

  it("allows submit when field is not required and empty", () => {
    render(
      <InputDialog
        {...baseProps}
        fields={[{ key: "name", label: "Name", required: false }]}
      />,
    );
    const submitBtn = screen.getByRole("button", { name: "Save" });
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls onClose when Escape key is pressed", () => {
    render(<InputDialog {...baseProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel button is clicked", () => {
    render(<InputDialog {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("populates default values", () => {
    render(
      <InputDialog
        {...baseProps}
        fields={[{ key: "name", label: "Name", defaultValue: "hello" }]}
      />,
    );
    const input = screen.getByDisplayValue("hello");
    expect(input).toBeInTheDocument();
  });

  it("uses custom submit label", () => {
    render(<InputDialog {...baseProps} submitLabel="Create" />);
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("submits on Enter for single field", () => {
    render(<InputDialog {...baseProps} />);
    const input = screen.getByPlaceholderText("Enter name");
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input.closest("div[class]")!, { key: "Enter" });
    expect(baseProps.onSubmit).toHaveBeenCalledWith({ name: "Test" });
  });
});
