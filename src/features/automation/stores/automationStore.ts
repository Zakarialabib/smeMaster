import { create } from "zustand";
import {
  getWorkflowRules,
  upsertWorkflowRule,
  deleteWorkflowRule,
  toggleWorkflowRule,
} from "@features/settings/db/workflowRules";
import type { WorkflowRule } from "@features/settings/db/workflowRules";
import { createAsyncActions } from "@shared/stores/createAsyncStore";
import { createDeleteConfirmation, type DeleteConfirmationSlice } from "@shared/stores/createDeleteConfirmation";
import { createEditorSlice, type EditorSlice, type EditorSliceOptions } from "@shared/stores/createEditorSlice";

// ── Action type matching the inline form structure ─────────────────────────

export interface AutomationAction {
  type: string;
  [key: string]: unknown;
}

// ── Step type (from workflows feature, for multi-step sequences) ───────────

export interface WorkflowStep {
  type: string;
  label?: string;
  [key: string]: unknown;
}

// ── Editor mode ────────────────────────────────────────────────────────────

export type EditorMode = "simple" | "steps" | "builder";

// ── Editor form state ──────────────────────────────────────────────────────

export interface AutomationEditorState {
  /** Null = creating new, string = editing existing */
  editingId: string | null;
  name: string;
  triggerEvent: string;
  triggerConditions: string;
  /** Flat action list (simple editor mode) */
  actions: AutomationAction[];
  /** Ordered step list (steps editor mode) */
  steps: WorkflowStep[];
  /** Which editor UI to show */
  editorMode: EditorMode;
}

// ── View mode for the rules list ───────────────────────────────────────────

export type ViewMode = "cards" | "list";

// ── Store ──────────────────────────────────────────────────────────────────

interface AutomationState extends AsyncSlice, EditorSlice<AutomationEditorState, WorkflowRule>, DeleteConfirmationSlice {
  /** All rules for the active account */
  rules: WorkflowRule[];

  /** Whether the AI generate modal is open */
  showAiModal: boolean;

  /** Whether the templates gallery is open */
  showTemplates: boolean;

  /** Current view mode for the rules list */
  viewMode: ViewMode;

  /** Whether the visual builder is open */
  showBuilder: boolean;

  /** Undo/redo history stack (past editor states) */
  editorHistory: AutomationEditorState[];
  /** Future editor states for redo */
  editorFuture: AutomationEditorState[];
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Push the current editor state onto the history stack (call before mutations) */
  pushEditorHistory: () => void;
  /** Undo: restore the previous editor state */
  undo: () => void;
  /** Redo: restore the most recently undone editor state */
  redo: () => void;

  // ── Data actions ───────────────────────────────────────────────────────
  loadRules: (companyId: string) => Promise<void>;
  toggleRule: (id: string, isActive: boolean) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  saveRule: (companyId: string) => Promise<boolean>;

  // ── AI modal ───────────────────────────────────────────────────────────
  openAiModal: () => void;
  closeAiModal: () => void;

  // ── Templates gallery ─────────────────────────────────────────────────
  openTemplates: () => void;
  closeTemplates: () => void;

  // ── View mode ──────────────────────────────────────────────────────────
  setViewMode: (mode: ViewMode) => void;

  // ── Builder ────────────────────────────────────────────────────────────
  openBuilder: () => void;
  closeBuilder: () => void;
  /** Open builder with a specific rule's data */
  openBuilderForRule: (rule: WorkflowRule) => void;
}

interface AsyncSlice {
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_EDITOR_BOTH: AutomationEditorState = {
  editingId: null,
  name: "",
  triggerEvent: "email_received",
  triggerConditions: "",
  actions: [],
  steps: [],
  editorMode: "simple",
};

const editorOptions: EditorSliceOptions<AutomationEditorState, WorkflowRule> = {
  defaultEditor: DEFAULT_EDITOR_BOTH,
  onItemSelect: (rule) => {
    let parsedItems: AutomationAction[] = [];
    try {
      const raw = JSON.parse(rule.actions);
      if (Array.isArray(raw)) parsedItems = raw;
    } catch {
      parsedItems = [];
    }
    return {
      editingId: rule.id,
      name: rule.name,
      triggerEvent: rule.trigger_event,
      triggerConditions: rule.trigger_conditions ?? "",
      actions: parsedItems,
      steps: parsedItems.map((a) => ({ ...a })),
      editorMode: "simple",
    };
  },
};

export const useAutomationStore = create<AutomationState>((set, get) => {
  const { withLoading } = createAsyncActions(set);
  const editorSlice = createEditorSlice<AutomationEditorState, WorkflowRule>(set, get, editorOptions);
  const deleteSlice = createDeleteConfirmation(set, get, {
    onDelete: async (id) => { await get().deleteRule(id); },
  });

  return {
    rules: [],
    isLoading: false,
    error: null,

    showAiModal: false,
    showTemplates: false,
    viewMode: "cards" as ViewMode,
    showBuilder: false,

    ...editorSlice,
    ...deleteSlice,

    // ── Undo / Redo ─────────────────────────────────────────────────────────
    editorHistory: [],
    editorFuture: [],
    canUndo: false,
    canRedo: false,

    pushEditorHistory: () => {
      const { editor, editorHistory } = get();
      set({
        editorHistory: [...editorHistory, { ...editor }],
        editorFuture: [],
        canUndo: true,
        canRedo: false,
      });
    },

    undo: () => {
      const { editor, editorHistory, editorFuture } = get();
      if (editorHistory.length === 0) return;
      const history = [...editorHistory];
      const previous = history.pop()!;
      set({
        editorHistory: history,
        editorFuture: [...editorFuture, { ...editor }],
        editor: previous,
        canUndo: history.length > 0,
        canRedo: true,
      });
    },

    redo: () => {
      const { editor, editorHistory, editorFuture } = get();
      if (editorFuture.length === 0) return;
      const future = [...editorFuture];
      const next = future.pop()!;
      set({
        editorHistory: [...editorHistory, { ...editor }],
        editorFuture: future,
        editor: next,
        canUndo: true,
        canRedo: future.length > 0,
      });
    },

    // ── Data actions ───────────────────────────────────────────────────────
    loadRules: async (companyId) => {
      await withLoading(async () => {
        const rows = await getWorkflowRules(companyId);
        set({ rules: rows });
      });
    },

    toggleRule: async (id, isActive) => {
      try {
        await toggleWorkflowRule(id, isActive);
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, is_active: isActive ? 1 : 0 } : r,
          ),
        }));
      } catch (err) {
        console.error("Failed to toggle automation rule:", err);
      }
    },

    deleteRule: async (id) => {
      try {
        await deleteWorkflowRule(id);
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
        }));
      } catch (err) {
        console.error("Failed to delete automation rule:", err);
      }
    },

    saveRule: async (companyId) => {
      const { editor } = get();

      if (!editor.name.trim()) return false;

      // Serialize whichever data is relevant based on editor mode
      const serializedActions =
        editor.editorMode === "steps" && editor.steps.length > 0
          ? JSON.stringify(editor.steps)
          : JSON.stringify(editor.actions);

      const result = await withLoading(async () => {
        await upsertWorkflowRule({
          id: editor.editingId ?? undefined,
          companyId,
          name: editor.name.trim(),
          triggerEvent: editor.triggerEvent,
          triggerConditions: editor.triggerConditions || undefined,
          actions: serializedActions,
        });
        get().closeEditor();
        await get().loadRules(companyId);
      });
      return result !== undefined;
    },

    // ── AI modal ───────────────────────────────────────────────────────────
    openAiModal: () => set({ showAiModal: true }),
    closeAiModal: () => set({ showAiModal: false }),

    // ── Templates gallery ─────────────────────────────────────────────────
    openTemplates: () => set({ showTemplates: true }),
    closeTemplates: () => set({ showTemplates: false }),

    // ── View mode ──────────────────────────────────────────────────────────
    setViewMode: (mode) => set({ viewMode: mode }),

    // ── Builder ────────────────────────────────────────────────────────────
    openBuilder: () =>
      set({ showBuilder: true, showEditor: false, editorHistory: [], editorFuture: [], canUndo: false, canRedo: false }),
    closeBuilder: () =>
      set({ showBuilder: false, editorHistory: [], editorFuture: [], canUndo: false, canRedo: false }),
    openBuilderForRule: (rule) => {
      let parsedItems: AutomationAction[] = [];
      try {
        const raw = JSON.parse(rule.actions);
        if (Array.isArray(raw)) parsedItems = raw;
      } catch {
        parsedItems = [];
      }
      set({
        showBuilder: true,
        showEditor: false,
        editorHistory: [],
        editorFuture: [],
        canUndo: false,
        canRedo: false,
        editor: {
          editingId: rule.id,
          name: rule.name,
          triggerEvent: rule.trigger_event,
          triggerConditions: rule.trigger_conditions ?? "",
          actions: parsedItems,
          steps: parsedItems.map((a) => ({ ...a })),
          editorMode: "builder",
        },
      });
    },
  };
});