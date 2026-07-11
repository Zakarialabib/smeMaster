import { type ReactNode, useCallback } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@shared/components/ui/Button";

export interface RuleEditorShellProps {
  isEditing: boolean;
  title: string;
  name: string;
  onNameChange: (v: string) => void;
  namePlaceholder: string;
  error: string | null;
  loading: boolean;
  saveLabel: string;
  onSave: () => void;
  onCancel: () => void;
  /** The trigger picker (e.g. AutomationTriggerPicker, WorkflowTriggerPicker). */
  triggerSlot: ReactNode;
  /** The steps/actions editor body. */
  bodySlot: ReactNode;
}

/**
 * RuleEditorShell - form-card wrapper for workflow / automation rule editors.
 *
 * Consolidates the outer chrome of `WorkflowEditor` (workflows/) and
 * `AutomationRuleEditor` (automation/). Per-step and per-action editor bodies
 * are passed in via `bodySlot` because they are genuinely different per domain.
 *
 * Responsibilities:
 * - Header (title + close button)
 * - Error banner
 * - Name input
 * - Trigger slot
 * - Body slot (steps / actions)
 * - Save / Cancel footer
 * - Escape keydown on the form root
 */
export function RuleEditorShell({
  isEditing,
  title,
  name,
  onNameChange,
  namePlaceholder,
  error,
  loading,
  saveLabel,
  onSave,
  onCancel,
  triggerSlot,
  bodySlot,
}: RuleEditorShellProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <div
      className="rounded-xl border border-border-primary bg-bg-secondary p-4 space-y-3"
      onKeyDown={handleKeyDown}
      role="form"
      aria-label={title}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <button
          type="button"
          onClick={onCancel}
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
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={namePlaceholder}
        className="w-full bg-bg-tertiary text-text-primary text-sm px-3 py-1.5 rounded border border-border-primary outline-none focus:border-accent transition-colors"
        autoFocus
      />

      {/* Trigger */}
      {triggerSlot}

      {/* Body */}
      {bodySlot}

      {/* Save / Cancel */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          onClick={onSave}
          disabled={!name.trim() || loading}
          loading={loading}
        >
          {saveLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* isEditing is exposed to consumers via prop but is not used in the shell itself. */}
      {/* Keeping it in the interface preserves the existing public API. */}
      <span data-is-editing={isEditing ? "true" : "false"} hidden />
    </div>
  );
}

export default RuleEditorShell;
