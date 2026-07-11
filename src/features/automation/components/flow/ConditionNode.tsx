import { memo, useCallback, type ChangeEvent } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Filter } from "lucide-react";
import { useAutomationStore } from "@features/automation/stores/automationStore";

export type ConditionNodeData = Node<
  {
    conditions: string;
  },
  "condition"
>;

export const ConditionNode = memo(function ConditionNode({
  data,
}: NodeProps<ConditionNodeData>) {
  const setEditorField = useAutomationStore((s) => s.setEditorField);

  const conditions = (() => {
    try {
      return JSON.parse(data.conditions || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const field = e.target.name;
      const value = e.target.value;
      const parsed = { ...conditions, [field]: value };
      setEditorField("triggerConditions", JSON.stringify(parsed));
    },
    [data.conditions, setEditorField],
  );

  return (
    <div className="rounded-xl border-2 border-warning bg-bg-secondary shadow-lg min-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-warning" />
      <Handle type="source" position={Position.Bottom} className="!bg-warning" />
      <div className="flex items-center gap-2 p-3 border-b border-border-primary">
        <div className="w-6 h-6 rounded-lg bg-warning/15 flex items-center justify-center">
          <Filter size={14} className="text-warning" />
        </div>
        <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Condition
        </span>
      </div>
      <div className="p-3 space-y-2">
        <input
          type="text"
          name="from_domain"
          value={(conditions.from_domain as string) ?? ""}
          onChange={handleChange}
          placeholder="From domain"
          className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-warning"
        />
        <input
          type="text"
          name="subject_contains"
          value={(conditions.subject_contains as string) ?? ""}
          onChange={handleChange}
          placeholder="Subject contains"
          className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 rounded border border-border-primary outline-none focus:border-warning"
        />
      </div>
    </div>
  );
});
