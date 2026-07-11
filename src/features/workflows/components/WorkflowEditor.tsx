/**
 * @deprecated This feature has been merged into @features/automation.
 * Import from @features/automation instead. Will be removed in a future version.
 */
import { useCallback, useState } from "react";
import { Save, X, Plus } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { AutomationTriggerPicker } from "@features/automation/components/AutomationTriggerPicker";
import { useWorkflowStore } from "@features/workflows/stores/workflowStore";
import { WorkflowStepCard } from "./WorkflowStepCard";
import type { WorkflowStep } from "@features/workflows/stores/workflowStore";

const STEP_TYPES = [
  { value: "apply_label", label: "Apply Label" },
  { value: "send_template", label: "Send Template" },
  { value: "create_task", label: "Create Task" },
  { value: "mark_read", label: "Mark Read" },
  { value: "archive", label: "Archive" },
  { value: "star", label: "Star" },
  { value: "forward_to", label: "Forward To" },
  { value: "send_notification", label: "Send Notification" },
  { value: "wait_days", label: "Wait Days" },
];

function createDefaultStep(type: string): WorkflowStep {
  const step: WorkflowStep = { type };
  if (type === "apply_label") step.labelId = "";
  if (type === "send_template") step.templateId = "";
  if (type === "create_task") step.title = "";
  if (type === "forward_to") step.email = "";
  if (type === "wait_days") step.days = 1;
  return step;
}

interface WorkflowEditorProps {
  accountId: string;
  onSaveSuccess?: () => void;
}

export function WorkflowEditor({
  accountId,
  onSaveSuccess,
}: WorkflowEditorProps) {
  const editor = useWorkflowStore((s) => s.editor);
  const setEditorField = useWorkflowStore((s) => s.setEditorField);
  const closeEditor = useWorkflowStore((s) => s.closeEditor);
  const createWorkflow = useWorkflowStore((s) => s.createWorkflow);
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const loading = useWorkflowStore((s) => s.isLoading);
  const error = useWorkflowStore((s) => s.error);

  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [addingStepType, setAddingStepType] = useState("");

  const isEditing = editor.editingId !== null;

  // ── Trigger ──────────────────────────────────────────────────────────

  const handleTriggerChange = useCallback(
    (event: string, conditions: string) => {
      setEditorField("triggerEvent", event);
      setEditorField("triggerConditions", conditions);
    },
    [setEditorField],
  );

  // ── Steps ────────────────────────────────────────────────────────────

  const handleAddStep = useCallback(
    (type: string) => {
      if (!type) return;
      const newStep = createDefaultStep(type);
      setEditorField("steps", [...editor.steps, newStep]);
      setAddingStepType("");
      // Open editing for the newly added step
      setEditingStepIndex(editor.steps.length);
    },
    [editor.steps, setEditorField],
  );

  const handleEditStep = useCallback((index: number) => {
    setEditingStepIndex(index);
  }, []);

  const handleUpdateStep = useCallback(
    (index: number, update: Partial<WorkflowStep>) => {
      const next = editor.steps.map((s, i) =>
        i === index ? { ...s, ...update } : s,
      );
      setEditorField("steps", next);
    },
    [editor.steps, setEditorField],
  );

  const handleDeleteStep = useCallback(
    (index: number) => {
      const next = editor.steps.filter((_, i) => i !== index);
      setEditorField("steps", next);
      if (editingStepIndex === index) {
        setEditingStepIndex(null);
      } else if (editingStepIndex !== null && editingStepIndex > index) {
        setEditingStepIndex(editingStepIndex - 1);
      }
    },
    [editor.steps, setEditorField, editingStepIndex],
  );

  const handleMoveStepUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const next = [...editor.steps];
      const temp = next[index - 1];
      const curr = next[index];
      if (temp === undefined || curr === undefined) return;
      next[index - 1] = curr;
      next[index] = temp;
      setEditorField("steps", next);
      if (editingStepIndex === index) {
        setEditingStepIndex(index - 1);
      } else if (editingStepIndex === index - 1) {
        setEditingStepIndex(index);
      }
    },
    [editor.steps, setEditorField, editingStepIndex],
  );

  const handleMoveStepDown = useCallback(
    (index: number) => {
      if (index >= editor.steps.length - 1) return;
      const next = [...editor.steps];
      const curr = next[index];
      const below = next[index + 1];
      if (curr === undefined || below === undefined) return;
      next[index] = below;
      next[index + 1] = curr;
      setEditorField("steps", next);
      if (editingStepIndex === index) {
        setEditingStepIndex(index + 1);
      } else if (editingStepIndex === index + 1) {
        setEditingStepIndex(index);
      }
    },
    [editor.steps, setEditorField, editingStepIndex],
  );

  // ── Save ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    let success: boolean;
    if (isEditing) {
      success = await updateWorkflow(accountId);
    } else {
      success = await createWorkflow(accountId);
    }
    if (success && onSaveSuccess) {
      onSaveSuccess();
    }
  }, [isEditing, updateWorkflow, createWorkflow, accountId, onSaveSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeEditor();
      }
    },
    [closeEditor],
  );

  const editingStep =
    editingStepIndex !== null ? editor.steps[editingStepIndex] : null;

  return (
    <div
      className="rounded-xl border border-border-primary bg-bg-secondary p-4 space-y-3"
      onKeyDown={handleKeyDown}
      role="form"
      aria-label={isEditing ? "Edit workflow" : "Create workflow"}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary">
          {isEditing ? "Edit Workflow" : "New Workflow"}
        </h3>
        <button
          type="button"
          onClick={closeEditor}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Close editor"
        >
          <X size={14} />
        </button>
      </div>

      {error && (
        <div
          className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Name */}
      <input
        type="text"
        value={editor.name}
        onChange={(e) => setEditorField("name", e.target.value)}
        placeholder="Workflow name (e.g. Auto-follow-up sequence)"
        className="w-full bg-bg-tertiary text-text-primary text-sm px-3 py-1.5 rounded border border-border-primary outline-none focus:border-accent transition-colors"
        autoFocus
      />

      {/* Trigger */}
      <AutomationTriggerPicker
        event={editor.triggerEvent}
        conditions={editor.triggerConditions}
        onChange={handleTriggerChange}
      />

      {/* Steps */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-text-secondary">
          Steps ({editor.steps.length})
        </div>

        {editor.steps.length === 0 && (
          <p className="text-xs text-text-tertiary italic">
            No steps configured. Add a step below.
          </p>
        )}

        {editor.steps.map((step, index) => (
          <div key={index}>
            <WorkflowStepCard
              step={step}
              index={index}
              total={editor.steps.length}
              onEdit={handleEditStep}
              onDelete={handleDeleteStep}
              onMoveUp={handleMoveStepUp}
              onMoveDown={handleMoveStepDown}
            />

            {/* Inline step editor */}
            {editingStepIndex === index && editingStep && (
              <div className="mt-1.5 ml-8 p-2 bg-bg-primary rounded border border-border-secondary space-y-1.5">
                <div className="text-[0.625rem] font-medium text-text-secondary mb-1">
                  Edit Step {index + 1}
                </div>

                {/* Step type */}
                <select
                  value={editingStep.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const updated = createDefaultStep(newType);
                    handleUpdateStep(index, updated);
                  }}
                  className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {/* Step-specific fields */}
                {editingStep.type === "apply_label" && (
                  <input
                    type="text"
                    value={(editingStep.labelId as string) ?? ""}
                    onChange={(e) =>
                      handleUpdateStep(index, { labelId: e.target.value })
                    }
                    placeholder="Label ID"
                    className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary outline-none focus:border-accent"
                  />
                )}
                {editingStep.type === "send_template" && (
                  <input
                    type="text"
                    value={(editingStep.templateId as string) ?? ""}
                    onChange={(e) =>
                      handleUpdateStep(index, { templateId: e.target.value })
                    }
                    placeholder="Template ID"
                    className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary outline-none focus:border-accent"
                  />
                )}
                {editingStep.type === "create_task" && (
                  <input
                    type="text"
                    value={(editingStep.title as string) ?? ""}
                    onChange={(e) =>
                      handleUpdateStep(index, { title: e.target.value })
                    }
                    placeholder="Task title"
                    className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary outline-none focus:border-accent"
                  />
                )}
                {editingStep.type === "forward_to" && (
                  <input
                    type="email"
                    value={(editingStep.email as string) ?? ""}
                    onChange={(e) =>
                      handleUpdateStep(index, { email: e.target.value })
                    }
                    placeholder="forward@example.com"
                    className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary outline-none focus:border-accent"
                  />
                )}
                {editingStep.type === "wait_days" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={(editingStep.days as number) ?? 1}
                      onChange={(e) =>
                        handleUpdateStep(index, {
                          days: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-20 bg-bg-tertiary text-text-primary text-xs px-2 py-1 rounded border border-border-primary outline-none focus:border-accent"
                    />
                    <span className="text-[0.625rem] text-text-tertiary">
                      day(s)
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setEditingStepIndex(null)}
                  className="text-[0.625rem] text-accent hover:text-accent-hover transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add step */}
        <div className="relative">
          <select
            value={addingStepType}
            onChange={(e) => {
              handleAddStep(e.target.value);
              // Reset the select value after adding
              e.target.value = "";
            }}
            className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary appearance-none cursor-pointer"
          >
            <option value="">+ Add Step</option>
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <Plus
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={!editor.name.trim() || loading}
          loading={loading}
        >
          {isEditing ? "Update Workflow" : "Save Workflow"}
        </Button>
        <Button variant="secondary" size="sm" onClick={closeEditor}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
