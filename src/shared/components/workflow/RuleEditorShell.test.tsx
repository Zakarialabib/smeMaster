import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RuleEditorShell } from "./RuleEditorShell";

describe("RuleEditorShell", () => {
  const baseProps = {
    isEditing: false,
    title: "New Workflow",
    name: "",
    onNameChange: vi.fn(),
    namePlaceholder: "Workflow name",
    error: null,
    loading: false,
    saveLabel: "Save Workflow",
    onSave: vi.fn(),
    onCancel: vi.fn(),
    triggerSlot: <div data-testid="trigger-slot" />,
    bodySlot: <div data-testid="body-slot" />,
  };

  it("renders the title in the header", () => {
    render(<RuleEditorShell {...baseProps} title="Edit Workflow" />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Edit Workflow",
    );
  });

  it("uses the title as the form's aria-label", () => {
    render(<RuleEditorShell {...baseProps} title="Edit Rule" />);
    expect(screen.getByRole("form", { name: "Edit Rule" })).toBeInTheDocument();
  });

  it("renders the trigger and body slots", () => {
    render(<RuleEditorShell {...baseProps} />);
    expect(screen.getByTestId("trigger-slot")).toBeInTheDocument();
    expect(screen.getByTestId("body-slot")).toBeInTheDocument();
  });

  it("renders the name input bound to the name prop", () => {
    render(<RuleEditorShell {...baseProps} name="My Rule" />);
    const input = screen.getByPlaceholderText("Workflow name") as HTMLInputElement;
    expect(input.value).toBe("My Rule");
  });

  it("calls onNameChange when the user types in the name input", () => {
    const onNameChange = vi.fn();
    render(<RuleEditorShell {...baseProps} onNameChange={onNameChange} />);
    fireEvent.change(screen.getByPlaceholderText("Workflow name"), {
      target: { value: "New name" },
    });
    expect(onNameChange).toHaveBeenCalledWith("New name");
  });

  it("renders the error banner when error is non-null", () => {
    render(
      <RuleEditorShell
        {...baseProps}
        error="Save failed: network down"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Save failed: network down",
    );
  });

  it("does not render the error banner when error is null", () => {
    render(<RuleEditorShell {...baseProps} error={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the save button with the given saveLabel", () => {
    render(<RuleEditorShell {...baseProps} saveLabel="Update Workflow" />);
    expect(
      screen.getByRole("button", { name: "Update Workflow" }),
    ).toBeInTheDocument();
  });

  it("calls onSave when the save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <RuleEditorShell
        {...baseProps}
        name="Valid name"
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Workflow" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("disables the save button when name is empty", () => {
    render(<RuleEditorShell {...baseProps} name="" />);
    const saveBtn = screen.getByRole("button", { name: "Save Workflow" });
    expect(saveBtn).toBeDisabled();
  });

  it("disables the save button when name is whitespace only", () => {
    render(<RuleEditorShell {...baseProps} name="   " />);
    const saveBtn = screen.getByRole("button", { name: "Save Workflow" });
    expect(saveBtn).toBeDisabled();
  });

  it("disables the save button when loading is true", () => {
    render(
      <RuleEditorShell
        {...baseProps}
        name="Valid name"
        loading
      />,
    );
    // When loading, the Button component replaces the children with a Spinner
    // and sets aria-label="Loading...". Locate the save button via that label.
    const saveBtn = screen.getByRole("button", { name: /loading/i });
    expect(saveBtn).toBeDisabled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<RuleEditorShell {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the close (X) button is clicked", () => {
    const onCancel = vi.fn();
    render(<RuleEditorShell {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape is pressed on the form", () => {
    const onCancel = vi.fn();
    render(<RuleEditorShell {...baseProps} onCancel={onCancel} />);
    const form = screen.getByRole("form");
    fireEvent.keyDown(form, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel on non-Escape keys", () => {
    const onCancel = vi.fn();
    render(<RuleEditorShell {...baseProps} onCancel={onCancel} />);
    const form = screen.getByRole("form");
    fireEvent.keyDown(form, { key: "Enter" });
    fireEvent.keyDown(form, { key: "a" });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
