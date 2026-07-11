import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAutomationStore } from "./automationStore";

vi.mock("@features/settings/db/workflowRules", () => ({
  getWorkflowRules: vi.fn(),
  upsertWorkflowRule: vi.fn(),
  deleteWorkflowRule: vi.fn(),
  toggleWorkflowRule: vi.fn(),
}));

import { getWorkflowRules, upsertWorkflowRule } from "@features/settings/db/workflowRules";

beforeEach(() => {
  useAutomationStore.setState({
    rules: [],
    isLoading: false,
    error: null,
    showEditor: false,
    editor: {
      editingId: null,
      name: "",
      triggerEvent: "email_received",
      triggerConditions: "",
      actions: [],
      steps: [],
      editorMode: "simple",
    },
    deleteTargetId: null,
    deleting: false,
    showAiModal: false,
    viewMode: "cards",
    showBuilder: false,
  });
  vi.clearAllMocks();
});

describe("automationStore — withMutation wiring", () => {
  it("isLoading is true while loadRules is pending", async () => {
    let resolveFn: (v: unknown[]) => void = () => {};
    vi.mocked(getWorkflowRules).mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveFn = resolve;
      }) as never,
    );

    const p = useAutomationStore.getState().loadRules("acc-1");
    expect(useAutomationStore.getState().isLoading).toBe(true);

    resolveFn([]);
    await p;
    expect(useAutomationStore.getState().isLoading).toBe(false);
  });

  it("isLoading is false and error is set after loadRules failure", async () => {
    vi.mocked(getWorkflowRules).mockRejectedValue(new Error("DB down"));

    await useAutomationStore.getState().loadRules("acc-1");

    const s = useAutomationStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("DB down");
  });

  it("saveRule returns false (and toggles isLoading) when upsert throws", async () => {
    useAutomationStore.setState({
      editor: {
        editingId: null,
        name: "My Rule",
        triggerEvent: "email_received",
        triggerConditions: "",
        actions: [],
      },
    });
    vi.mocked(upsertWorkflowRule).mockRejectedValue(new Error("Save failed"));

    const ok = await useAutomationStore.getState().saveRule("acc-1");

    expect(ok).toBe(false);
    const s = useAutomationStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("Save failed");
  });
});
