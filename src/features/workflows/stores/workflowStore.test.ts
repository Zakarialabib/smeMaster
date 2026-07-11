/**
 * @deprecated This feature has been merged into @features/automation.
 * Import from @features/automation instead. Will be removed in a future version.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWorkflowStore } from "./workflowStore";

vi.mock("@features/workflows/db/workflows", () => ({
  getWorkflowRules: vi.fn(),
  saveWorkflowRule: vi.fn(),
  removeWorkflowRule: vi.fn(),
  setWorkflowRuleActive: vi.fn(),
}));

import { getWorkflowRules, saveWorkflowRule } from "@features/workflows/db/workflows";

beforeEach(() => {
  useWorkflowStore.setState({
    workflows: [],
    isLoading: false,
    error: null,
    selectedWorkflow: null,
    showEditor: false,
    editor: {
      editingId: null,
      name: "",
      triggerEvent: "email_received",
      triggerConditions: "",
      steps: [],
    },
    deleteTargetId: null,
    deleting: false,
  });
  vi.clearAllMocks();
});

describe("workflowStore — withMutation wiring", () => {
  it("isLoading is true while loadWorkflows is pending", async () => {
    let resolveFn: (v: unknown[]) => void = () => {};
    vi.mocked(getWorkflowRules).mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveFn = resolve;
      }) as never,
    );

    const p = useWorkflowStore.getState().loadWorkflows("acc-1");
    expect(useWorkflowStore.getState().isLoading).toBe(true);

    resolveFn([]);
    await p;
    expect(useWorkflowStore.getState().isLoading).toBe(false);
  });

  it("isLoading is false and error is set after loadWorkflows failure", async () => {
    vi.mocked(getWorkflowRules).mockRejectedValue(new Error("DB error"));

    await useWorkflowStore.getState().loadWorkflows("acc-1");

    const s = useWorkflowStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("DB error");
  });

  it("createWorkflow returns false and toggles isLoading on failure", async () => {
    useWorkflowStore.setState({
      editor: {
        editingId: null,
        name: "My Workflow",
        triggerEvent: "email_received",
        triggerConditions: "",
        steps: [],
      },
    });
    vi.mocked(saveWorkflowRule).mockRejectedValue(new Error("Save failed"));

    const ok = await useWorkflowStore.getState().createWorkflow("acc-1");

    expect(ok).toBe(false);
    const s = useWorkflowStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("Save failed");
  });
});
