import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RuleSummaryCard, type RuleSummaryCardRule } from "./RuleSummaryCard";

function makeRule(overrides: Partial<RuleSummaryCardRule> = {}): RuleSummaryCardRule {
  return {
    id: "rule-1",
    name: "Auto follow-up",
    trigger_event: "email_received",
    actions: '[{"type":"apply_label"}]',
    is_active: 1,
    ...overrides,
  };
}

describe("RuleSummaryCard", () => {
  it("renders with active state — toggle shows checked, no 'Disabled' badge", () => {
    render(
      <RuleSummaryCard
        rule={makeRule({ is_active: 1 })}
        isActive
        itemCount={2}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });

  it("renders with inactive state — toggle shows unchecked, 'Disabled' badge appears", () => {
    render(
      <RuleSummaryCard
        rule={makeRule({ is_active: 0 })}
        isActive={false}
        itemCount={2}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders with createdAt provided — 'Created …' line appears", () => {
    // Use a fixed epoch ms that Intl.DateTimeFormat will render as "Mar 5, 2024"
    // in every locale-resolved test environment (en is the test fallback).
    const createdAt = Date.UTC(2024, 2, 5);
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={2}
        countNoun="action"
        entityName="rule"
        createdAt={createdAt}
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it("renders without createdAt — 'Created …' line does NOT appear", () => {
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={2}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Created/)).not.toBeInTheDocument();
  });

  it("uses 'Disable workflow' / 'Enable workflow' ARIA labels when entityName='workflow'", () => {
    const { rerender } = render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={2}
        countNoun="step"
        entityName="workflow"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Disable workflow");

    rerender(
      <RuleSummaryCard
        rule={makeRule()}
        isActive={false}
        itemCount={2}
        countNoun="step"
        entityName="workflow"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Enable workflow");
  });

  it("uses 'Disable rule' / 'Enable rule' ARIA labels when entityName='rule'", () => {
    const { rerender } = render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={2}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Disable rule");

    rerender(
      <RuleSummaryCard
        rule={makeRule()}
        isActive={false}
        itemCount={2}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-label", "Enable rule");
  });

  it("click on toggle → calls onToggle(rule.id, !isActive) exactly once", () => {
    const onToggle = vi.fn();
    render(
      <RuleSummaryCard
        rule={makeRule({ id: "abc", is_active: 1 })}
        isActive
        itemCount={0}
        countNoun="action"
        entityName="rule"
        onToggle={onToggle}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("abc", false);
  });

  it("click on edit button → calls onEdit(rule) with the full rule", () => {
    const onEdit = vi.fn();
    const rule = makeRule({ id: "x", name: "Edit me" });
    render(
      <RuleSummaryCard
        rule={rule}
        isActive
        itemCount={0}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit rule/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(rule);
  });

  it("click on delete button → calls onDelete(rule.id)", () => {
    const onDelete = vi.fn();
    render(
      <RuleSummaryCard
        rule={makeRule({ id: "del-me" })}
        isActive
        itemCount={0}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /delete rule/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("del-me");
  });

  it("itemCount=0 — does not show the count text", () => {
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={0}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/action/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/step/i)).not.toBeInTheDocument();
  });

  it("itemCount=3 with countNoun='action' — shows '3 actions' (plural)", () => {
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={3}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("3 actions")).toBeInTheDocument();
  });

  it("itemCount=3 with countNoun='step' — shows '3 steps' (plural)", () => {
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={3}
        countNoun="step"
        entityName="workflow"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("3 steps")).toBeInTheDocument();
  });

  it("itemCount=1 with countNoun='action' — shows '1 action' (singular)", () => {
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={1}
        countNoun="action"
        entityName="rule"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("1 action")).toBeInTheDocument();
  });

  it("itemCount=1 with countNoun='step' — shows '1 step' (singular)", () => {
    render(
      <RuleSummaryCard
        rule={makeRule()}
        isActive
        itemCount={1}
        countNoun="step"
        entityName="workflow"
        onToggle={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("1 step")).toBeInTheDocument();
  });
});
