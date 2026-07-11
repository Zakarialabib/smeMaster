/**
 * @deprecated This feature has been merged into @features/automation.
 * Import from @features/automation instead. Will be removed in a future version.
 */
import { create } from "zustand";
import {
  getWorkflowRules,
  saveWorkflowRule,
  removeWorkflowRule,
  setWorkflowRuleActive,
} from "@features/workflows/db/workflows";
import type { WorkflowRule } from "@features/workflows/db/workflows";
import { createAsyncActions } from "@shared/stores/createAsyncStore";
import { createDeleteConfirmation, type DeleteConfirmationSlice } from "@shared/stores/createDeleteConfirmation";
import { createEditorSlice, type EditorSlice, type EditorSliceOptions } from "@shared/stores/createEditorSlice";

// ── Step type matching the actions JSON structure ────────────────────────────

export interface WorkflowStep {
  type: string;
  label?: string;
  [key: string]: unknown;
}

// ── Editor form state ──────────────────────────────────────────────────────

export interface WorkflowEditorState {
  /** Null = creating new, string = editing existing */
  editingId: string | null;
  name: string;
  triggerEvent: string;
  triggerConditions: string;
  steps: WorkflowStep[];
}

// ── Store ──────────────────────────────────────────────────────────────────

interface WorkflowState extends AsyncSlice, EditorSlice<WorkflowEditorState, WorkflowRule>, DeleteConfirmationSlice {
  /** All workflow rules for the active account */
  workflows: WorkflowRule[];

  /** Currently selected workflow (for detail view) */
  selectedWorkflow: WorkflowRule | null;

  // ── Data actions ───────────────────────────────────────────────────────
  loadWorkflows: (companyId: string) => Promise<void>;
  createWorkflow: (companyId: string) => Promise<boolean>;
  updateWorkflow: (companyId: string) => Promise<boolean>;
  deleteWorkflow: (id: string) => Promise<void>;
  toggleWorkflow: (id: string, isActive: boolean) => Promise<void>;
  selectWorkflow: (workflow: WorkflowRule | null) => void;
}

interface AsyncSlice {
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_EDITOR: WorkflowEditorState = {
  editingId: null,
  name: "",
  triggerEvent: "email_received",
  triggerConditions: "",
  steps: [],
};

const editorOptions: EditorSliceOptions<WorkflowEditorState, WorkflowRule> = {
  defaultEditor: DEFAULT_EDITOR,
  onItemSelect: (workflow) => {
    let parsedSteps: WorkflowStep[] = [];
    try {
      const raw = JSON.parse(workflow.actions);
      if (Array.isArray(raw)) parsedSteps = raw;
    } catch {
      parsedSteps = [];
    }
    return {
      editingId: workflow.id,
      name: workflow.name,
      triggerEvent: workflow.trigger_event,
      triggerConditions: workflow.trigger_conditions ?? "",
      steps: parsedSteps,
    };
  },
};

export const useWorkflowStore = create<WorkflowState>((set, get) => {
  const { withLoading } = createAsyncActions(set);
  const editorSlice = createEditorSlice<WorkflowEditorState, WorkflowRule>(set, get, editorOptions);
  const deleteSlice = createDeleteConfirmation(set, get, {
    onDelete: async (id) => { await get().deleteWorkflow(id); },
  });

  return {
    workflows: [],
    isLoading: false,
    error: null,

    selectedWorkflow: null,

    ...editorSlice,
    ...deleteSlice,

    // ── Data actions ───────────────────────────────────────────────────────
    loadWorkflows: async (companyId) => {
      await withLoading(async () => {
        const rows = await getWorkflowRules(companyId);
        set({ workflows: rows });
      });
    },

    createWorkflow: async (companyId) => {
      const { editor } = get();
      if (!editor.name.trim()) return false;

      const result = await withLoading(async () => {
        await saveWorkflowRule({
          companyId,
          name: editor.name.trim(),
          triggerEvent: editor.triggerEvent,
          triggerConditions: editor.triggerConditions || undefined,
          actions: JSON.stringify(editor.steps),
        });
        get().closeEditor();
        await get().loadWorkflows(companyId);
      });
      return result !== undefined;
    },

    updateWorkflow: async (companyId) => {
      const { editor } = get();
      if (!editor.name.trim() || !editor.editingId) return false;

      const result = await withLoading(async () => {
        await saveWorkflowRule({
          id: editor.editingId ?? undefined,
          companyId,
          name: editor.name.trim(),
          triggerEvent: editor.triggerEvent,
          triggerConditions: editor.triggerConditions || undefined,
          actions: JSON.stringify(editor.steps),
        });
        get().closeEditor();
        await get().loadWorkflows(companyId);
      });
      return result !== undefined;
    },

    deleteWorkflow: async (id) => {
      try {
        await removeWorkflowRule(id);
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          selectedWorkflow:
            state.selectedWorkflow?.id === id ? null : state.selectedWorkflow,
        }));
      } catch (err) {
        console.error("Failed to delete workflow:", err);
      }
    },

    toggleWorkflow: async (id, isActive) => {
      try {
        await setWorkflowRuleActive(id, isActive);
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, is_active: isActive ? 1 : 0 } : w,
          ),
        }));
      } catch (err) {
        console.error("Failed to toggle workflow:", err);
      }
    },

    selectWorkflow: (workflow) => {
      set({ selectedWorkflow: workflow });
    },
  };
});