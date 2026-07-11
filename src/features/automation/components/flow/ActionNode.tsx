import { memo, useCallback, type ChangeEvent } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import type { AutomationAction } from "@features/automation/stores/automationStore";

export type ActionNodeData = Node<
  {
    index: number;
    action: AutomationAction;
    onUpdate: (index: number, action: AutomationAction) => void;
    onDelete: (index: number) => void;
  },
  "action"
>;

const ACTION_OPTIONS = [
  { value: "apply_label", label: "Apply Label", paramKey: "labelId", paramLabel: "Label ID" },
  { value: "send_template", label: "Send Template", paramKey: "templateId", paramLabel: "Template ID" },
  { value: "create_task", label: "Create Task", paramKey: "title", paramLabel: "Task title" },
  { value: "mark_read", label: "Mark Read", paramKey: null, paramLabel: null },
  { value: "archive", label: "Archive", paramKey: null, paramLabel: null },
  { value: "star", label: "Star", paramKey: null, paramLabel: null },
  { value: "forward_to", label: "Forward To", paramKey: "email", paramLabel: "Email address" },
  { value: "send_notification", label: "Send Notification", paramKey: null, paramLabel: null },
];

function getActionMeta(type: string) {
  return ACTION_OPTIONS.find((o) => o.value === type) ?? ACTION_OPTIONS[0]!;
}

export const ActionNode = memo(function ActionNode({
  data,
}: NodeProps<ActionNodeData>) {
  const { index, action, onUpdate, onDelete } = data;
  const meta = getActionMeta(action.type);

  const handleTypeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value;
      const newMeta = getActionMeta(newType);
      const updated: AutomationAction = { type: newType };
      if (newMeta.paramKey) updated[newMeta.paramKey] = "";
      onUpdate(index, updated);
    },
    [index, onUpdate],
  );

  const handleParamChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, { ...action, [e.target.name]: e.target.value });
    },
    [index, action, onUpdate],
  );

  const handleDelete = useCallback(() => {
    onDelete(index);
  }, [index, onDelete]);

  return (
    <div className="rounded-xl border-2 border-success/60 bg-bg-secondary shadow-lg min-w-[220px]">
      <Handle type="target" position={Position.Top} className="!bg-success" />
      <Handle type="source" position={Position.Bottom} className="!bg-success" />
      <div className="flex items-center justify-between p-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-success/15 flex items-center justify-center">
            <span className="text-[10px] font-bold text-success">{index + 1}</span>
          </div>
          <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            Action
          </span>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="p-1 text-text-tertiary hover:text-danger transition-colors"
          aria-label="Remove action"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <select
          value={action.type}
          onChange={handleTypeChange}
          className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-success"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {meta.paramKey && (
          <input
            type="text"
            name={meta.paramKey}
            value={(action[meta.paramKey] as string) ?? ""}
            onChange={handleParamChange}
            placeholder={meta.paramLabel ?? ""}
            className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-success"
          />
        )}
      </div>
    </div>
  );
});
