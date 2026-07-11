import { parseWorkflowActions } from "../workflowEngine";

describe("parseWorkflowActions", () => {
  it("parses send_template action", () => {
    const actions = parseWorkflowActions(
      JSON.stringify([{ type: "send_template", templateId: "tmpl-123", delayHours: 2 }]),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "send_template",
      templateId: "tmpl-123",
      delayHours: 2,
    });
  });

  it("parses forward_to action", () => {
    const actions = parseWorkflowActions(
      JSON.stringify([{ type: "forward_to", email: "user@example.com", forwardTo: "fwd@other.com" }]),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "forward_to",
      email: "user@example.com",
      forwardTo: "fwd@other.com",
    });
  });

  it("parses create_task action", () => {
    const actions = parseWorkflowActions(
      JSON.stringify([{ type: "create_task", title: "Follow up", dueDays: 3, priority: "high" }]),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "create_task",
      title: "Follow up",
      dueDays: 3,
      priority: "high",
    });
  });

  it("parses create_task with explicit dueDate", () => {
    const actions = parseWorkflowActions(
      JSON.stringify([{ type: "create_task", title: "Meeting prep", dueDate: "2026-06-01", priority: "urgent" }]),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      type: "create_task",
      title: "Meeting prep",
      dueDate: "2026-06-01",
      priority: "urgent",
    });
  });

  it("parses multiple actions together", () => {
    const actions = parseWorkflowActions(
      JSON.stringify([
        { type: "apply_label", labelId: "label-1" },
        { type: "send_template", templateId: "tmpl-1" },
        { type: "create_task", dueDays: 1 },
        { type: "forward_to", email: "a@b.com" },
      ]),
    );
    expect(actions).toHaveLength(4);
    expect(actions[0].type).toBe("apply_label");
    expect(actions[1].type).toBe("send_template");
    expect(actions[2].type).toBe("create_task");
    expect(actions[3].type).toBe("forward_to");
  });
});
