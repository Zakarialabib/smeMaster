import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RuleCard } from "./RuleCard";
import type { WorkflowRule } from "@shared/services/db/schema";

function makeRule(overrides: Partial<WorkflowRule> = {}): WorkflowRule {
  return {
    id: "rule-1",
    account_id: "acc-1",
    name: "Auto follow-up",
    trigger_event: "email_received",
    trigger_conditions: null,
    actions: '[{"type":"apply_label"},{"type":"send_template"}]',
    is_active: 1,
    created_at: 1_700_000_000,
    ...overrides,
  };
}

describe("RuleCard", () => {
  it("renders the rule name", () => {
    render(
      <RuleCard
        rule={makeRule({ name: "Daily digest" })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Daily digest")).toBeInTheDocument();
  });

  it("renders the trigger label", () => {
    render(
      <RuleCard
        rule={makeRule()}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Email Received")).toBeInTheDocument();
  });

  it("pluralizes step count correctly (1 step, 2 steps)", () => {
    const { rerender } = render(
      <RuleCard
        rule={makeRule({ actions: '[{"type":"apply_label"}]' })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("1 step")).toBeInTheDocument();

    rerender(
      <RuleCard
        rule={makeRule({ actions: '[{"type":"a"},{"type":"b"}]' })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("2 steps")).toBeInTheDocument();
  });

  it("pluralizes action count correctly (1 action, 2 actions)", () => {
    const { rerender } = render(
      <RuleCard
        rule={makeRule({ actions: '[{"type":"archive"}]' })}
        triggerLabel="Email Received"
        countUnit="action"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("1 action")).toBeInTheDocument();

    rerender(
      <RuleCard
        rule={makeRule({ actions: '[{"type":"a"},{"type":"b"}]' })}
        triggerLabel="Email Received"
        countUnit="action"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("2 actions")).toBeInTheDocument();
  });

  it("omits the count chip when there are no actions", () => {
    render(
      <RuleCard
        rule={makeRule({ actions: "[]" })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/0 steps?/)).not.toBeInTheDocument();
    expect(screen.queryByText(/step/)).not.toBeInTheDocument();
  });

  it("falls back to 0 steps when actions JSON is malformed", () => {
    render(
      <RuleCard
        rule={makeRule({ actions: "not json" })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/step/)).not.toBeInTheDocument();
  });

  it("does not show the 'Disabled' badge when the rule is active", () => {
    render(
      <RuleCard
        rule={makeRule({ is_active: 1 })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });

  it("shows the 'Disabled' badge when the rule is inactive", () => {
    render(
      <RuleCard
        rule={makeRule({ is_active: 0 })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("does not show the created date by default", () => {
    render(
      <RuleCard
        rule={makeRule()}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Created/)).not.toBeInTheDocument();
  });

  it("shows the created date when showCreatedDate is true", () => {
    render(
      <RuleCard
        rule={makeRule({ created_at: Date.UTC(2024, 2, 5) / 1000 })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        showCreatedDate
      />,
    );
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it("calls onToggle with (id, !active) when the toggle is clicked", () => {
    const onToggle = vi.fn();
    render(
      <RuleCard
        rule={makeRule({ id: "abc", is_active: 1 })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={onToggle}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("abc", false);
  });

  it("calls onEdit with the rule when the edit button is clicked", () => {
    const onEdit = vi.fn();
    const rule = makeRule({ id: "x" });
    render(
      <RuleCard
        rule={rule}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit step/i }));
    expect(onEdit).toHaveBeenCalledWith(rule);
  });

  it("calls onDelete with the id when the delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <RuleCard
        rule={makeRule({ id: "del-me" })}
        triggerLabel="Email Received"
        countUnit="step"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /delete step/i }));
    expect(onDelete).toHaveBeenCalledWith("del-me");
  });
});
