import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutomationActionPicker } from "./AutomationActionPicker";

describe("AutomationActionPicker", () => {
  const defaultActions = [
    { type: "mark_read" },
    { type: "archive" },
  ];

  it("renders empty state when no actions configured", () => {
    render(
      <AutomationActionPicker actions={[]} onChange={() => {}} />,
    );

    expect(
      screen.getByText("No actions configured. Add an action below."),
    ).toBeInTheDocument();
  });

  it("renders the Actions heading label", () => {
    render(
      <AutomationActionPicker actions={[]} onChange={() => {}} />,
    );

    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders existing actions with select dropdowns", () => {
    render(
      <AutomationActionPicker
        actions={defaultActions}
        onChange={() => {}}
      />,
    );

    const selects = screen.getAllByRole("combobox");
    // One select per action + the "Add Action" select
    expect(selects.length).toBe(3);
  });

  it("renders remove button for each action", () => {
    render(
      <AutomationActionPicker
        actions={defaultActions}
        onChange={() => {}}
      />,
    );

    const removeButtons = screen.getAllByLabelText(/Remove action/);
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toHaveAttribute("aria-label", "Remove action 1");
    expect(removeButtons[1]).toHaveAttribute("aria-label", "Remove action 2");
  });

  it("does not show empty state when actions exist", () => {
    render(
      <AutomationActionPicker
        actions={defaultActions}
        onChange={() => {}}
      />,
    );

    expect(
      screen.queryByText("No actions configured. Add an action below."),
    ).not.toBeInTheDocument();
  });

  it("calls onChange with action removed when remove button is clicked", () => {
    const handleChange = vi.fn();

    render(
      <AutomationActionPicker
        actions={defaultActions}
        onChange={handleChange}
      />,
    );

    const removeButtons = screen.getAllByLabelText(/Remove action/);
    fireEvent.click(removeButtons[0]);

    expect(handleChange).toHaveBeenCalledWith([{ type: "archive" }]);
  });

  it("shows Add Action select with unused action types", () => {
    const actions = [{ type: "mark_read" }];
    render(
      <AutomationActionPicker actions={actions} onChange={() => {}} />,
    );

    // The "Add Action" select should not include "Mark Read" since it's already used
    const addSelect = screen.getByDisplayValue("+ Add Action");
    const options = Array.from(addSelect.querySelectorAll("option"));
    const optionValues = options.map((o) => o.value);

    expect(optionValues).toContain("apply_label");
    expect(optionValues).toContain("send_template");
    expect(optionValues).toContain("create_task");
    expect(optionValues).toContain("archive");
    expect(optionValues).toContain("star");
    expect(optionValues).toContain("forward_to");
    expect(optionValues).toContain("send_notification");
    // "mark_read" should NOT be in the add dropdown since it's already used
    expect(optionValues).not.toContain("mark_read");
  });

  it("Add Action select shows all types when no actions used", () => {
    render(
      <AutomationActionPicker actions={[]} onChange={() => {}} />,
    );

    const addSelect = screen.getByDisplayValue("+ Add Action");
    const options = Array.from(addSelect.querySelectorAll("option"));
    const optionValues = options.map((o) => o.value);

    expect(optionValues).toContain("apply_label");
    expect(optionValues).toContain("send_template");
    expect(optionValues).toContain("create_task");
    expect(optionValues).toContain("mark_read");
    expect(optionValues).toContain("archive");
    expect(optionValues).toContain("star");
    expect(optionValues).toContain("forward_to");
    expect(optionValues).toContain("send_notification");
  });

  it("calls onChange with new action when an action type is selected from Add Action", () => {
    const handleChange = vi.fn();

    render(
      <AutomationActionPicker actions={[]} onChange={handleChange} />,
    );

    const addSelect = screen.getByDisplayValue("+ Add Action");
    fireEvent.change(addSelect, { target: { value: "star" } });

    expect(handleChange).toHaveBeenCalledWith([{ type: "star" }]);
  });

  it("shows labelId input when action type is apply_label", () => {
    const actions = [{ type: "apply_label", labelId: "" }];

    render(
      <AutomationActionPicker actions={actions} onChange={() => {}} />,
    );

    expect(screen.getByPlaceholderText("Label ID")).toBeInTheDocument();
  });

  it("shows templateId input when action type is send_template", () => {
    const actions = [{ type: "send_template", templateId: "" }];

    render(
      <AutomationActionPicker actions={actions} onChange={() => {}} />,
    );

    expect(screen.getByPlaceholderText("Template ID")).toBeInTheDocument();
  });

  it("shows task title and due days inputs when action type is create_task", () => {
    const actions = [{ type: "create_task", title: "", dueDays: 0 }];

    render(
      <AutomationActionPicker actions={actions} onChange={() => {}} />,
    );

    expect(screen.getByPlaceholderText("Task title")).toBeInTheDocument();
    // "Due in" label should be present
    expect(screen.getByText("Due in")).toBeInTheDocument();
    // days input should be present
    const daysInput = screen.getByDisplayValue("0");
    expect(daysInput).toBeInTheDocument();
  });

  it("shows email input when action type is forward_to", () => {
    const actions = [{ type: "forward_to", email: "" }];

    render(
      <AutomationActionPicker actions={actions} onChange={() => {}} />,
    );

    expect(
      screen.getByPlaceholderText("forward@example.com"),
    ).toBeInTheDocument();
  });

  it("does not show configuration inputs for actions without extra params", () => {
    const actions = [{ type: "mark_read" }, { type: "archive" }, { type: "star" }];

    render(
      <AutomationActionPicker actions={actions} onChange={() => {}} />,
    );

    expect(screen.queryByPlaceholderText("Label ID")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Template ID")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("forward@example.com")).not.toBeInTheDocument();
  });

  it("updates the action type and resets extra fields when type changes", () => {
    const handleChange = vi.fn();
    const actions = [{ type: "mark_read" }];

    render(
      <AutomationActionPicker actions={actions} onChange={handleChange} />,
    );

    const select = screen.getByDisplayValue("Mark Read");
    fireEvent.change(select, { target: { value: "apply_label" } });

    expect(handleChange).toHaveBeenCalledWith([
      { type: "apply_label", labelId: "" },
    ]);
  });

  it("updates labelId when input changes", () => {
    const handleChange = vi.fn();
    const actions = [{ type: "apply_label", labelId: "" }];

    render(
      <AutomationActionPicker actions={actions} onChange={handleChange} />,
    );

    const input = screen.getByPlaceholderText("Label ID");
    fireEvent.change(input, { target: { value: "INBOX" } });

    expect(handleChange).toHaveBeenCalledWith([
      { type: "apply_label", labelId: "INBOX" },
    ]);
  });

  it("updates task title when input changes", () => {
    const handleChange = vi.fn();
    const actions = [{ type: "create_task", title: "", dueDays: 0 }];

    render(
      <AutomationActionPicker actions={actions} onChange={handleChange} />,
    );

    const input = screen.getByPlaceholderText("Task title");
    fireEvent.change(input, { target: { value: "Follow up" } });

    expect(handleChange).toHaveBeenCalledWith([
      { type: "create_task", title: "Follow up", dueDays: 0 },
    ]);
  });

  it("updates due days when number input changes", () => {
    const handleChange = vi.fn();
    const actions = [{ type: "create_task", title: "", dueDays: 0 }];

    render(
      <AutomationActionPicker actions={actions} onChange={handleChange} />,
    );

    // Get the number input (second input in the create_task block)
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(1);
    fireEvent.change(inputs[0], { target: { value: "3" } });

    expect(handleChange).toHaveBeenCalledWith([
      { type: "create_task", title: "", dueDays: 3 },
    ]);
  });

  it("updates forward email when input changes", () => {
    const handleChange = vi.fn();
    const actions = [{ type: "forward_to", email: "" }];

    render(
      <AutomationActionPicker actions={actions} onChange={handleChange} />,
    );

    const input = screen.getByPlaceholderText("forward@example.com");
    fireEvent.change(input, { target: { value: "test@test.com" } });

    expect(handleChange).toHaveBeenCalledWith([
      { type: "forward_to", email: "test@test.com" },
    ]);
  });

  it("renders notice when all 8 action types are used", () => {
    const allTypes = [
      { type: "apply_label", labelId: "1" },
      { type: "send_template", templateId: "2" },
      { type: "create_task", title: "task" },
      { type: "mark_read" },
      { type: "archive" },
      { type: "star" },
      { type: "forward_to", email: "a@b.com" },
      { type: "send_notification" },
    ];

    render(
      <AutomationActionPicker
        actions={allTypes}
        onChange={() => {}}
      />,
    );

    // Add Action dropdown should not be rendered since all types are used
    expect(screen.queryByText("+ Add Action")).not.toBeInTheDocument();
  });
});
