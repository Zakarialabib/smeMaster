import { useCallback } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { AutomationTriggerPicker } from "./AutomationTriggerPicker";
import { AutomationActionPicker } from "./AutomationActionPicker";
import { useAutomationStore } from "@features/automation/stores/automationStore";

interface AutomationRuleEditorProps {
  accountId: string;
  onSaveSuccess?: () => void;
}

export function AutomationRuleEditor({
  accountId,
  onSaveSuccess,
}: AutomationRuleEditorProps) {
  const editor = useAutomationStore((s) => s.editor);
  const setEditorField = useAutomationStore((s) => s.setEditorField);
  const closeEditor = useAutomationStore((s) => s.closeEditor);
  const saveRule = useAutomationStore((s) => s.saveRule);
  const loading = useAutomationStore((s) => s.isLoading);
  const error = useAutomationStore((s) => s.error);

  const isEditing = editor.editingId !== null;

  const handleTriggerChange = useCallback(
    (event: string, conditions: string) => {
      setEditorField("triggerEvent", event);
      setEditorField("triggerConditions", conditions);
    },
    [setEditorField],
  );

  const handleSave = useCallback(async () => {
    const success = await saveRule(accountId);
    if (success && onSaveSuccess) {
      onSaveSuccess();
    }
  }, [saveRule, accountId, onSaveSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeEditor();
      }
    },
    [closeEditor],
  );

  return (
    <div
      className="rounded-xl border border-border-primary bg-bg-secondary p-4 space-y-3"
      onKeyDown={handleKeyDown}
      role="form"
      aria-label={isEditing ? "Edit automation rule" : "Create automation rule"}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary">
          {isEditing ? "Edit Rule" : "New Rule"}
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

      <input
        type="text"
        value={editor.name}
        onChange={(e) => setEditorField("name", e.target.value)}
        placeholder="Rule name (e.g. Auto-archive newsletters)"
        className="w-full bg-bg-tertiary text-text-primary text-sm px-3 py-1.5 rounded border border-border-primary outline-none focus:border-accent transition-colors"
        autoFocus
      />

      <AutomationTriggerPicker
        event={editor.triggerEvent}
        conditions={editor.triggerConditions}
        onChange={handleTriggerChange}
      />

      <AutomationActionPicker
        actions={editor.actions}
        onChange={(actions) => setEditorField("actions", actions)}
      />

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          size="sm"
          icon={<Save size={14} />}
          onClick={handleSave}
          disabled={!editor.name.trim() || loading}
          loading={loading}
        >
          {isEditing ? "Update Rule" : "Save Rule"}
        </Button>
        <Button variant="secondary" size="sm" onClick={closeEditor}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
