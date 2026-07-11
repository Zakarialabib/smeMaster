import { Trash2, Pencil } from "lucide-react";
import { Toggle } from "@shared/components/ui/Toggle";
import type { DbWorkflowRule } from "@features/settings/db/workflowRules";

const TRIGGER_LABELS: Record<string, string> = {
  email_received: "Email Received",
  no_reply_after_days: "No Reply After Days",
  time_based: "Time Based",
};

interface WorkflowRuleCardProps {
  rule: DbWorkflowRule;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (rule: DbWorkflowRule) => void;
  onDelete: (id: string) => void;
}

export function WorkflowRuleCard({ rule, onToggle, onEdit, onDelete }: WorkflowRuleCardProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-bg-secondary rounded-md">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary flex items-center gap-2">
          {rule.name}
          {rule.is_active !== 1 && (
            <span className="text-[0.625rem] bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded">
              Disabled
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.625rem] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
            {TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Toggle
          size="sm"
          checked={rule.is_active === 1}
          onChange={(next) => onToggle(rule.id, next)}
          aria-label={rule.is_active === 1 ? `Disable workflow rule "${rule.name}"` : `Enable workflow rule "${rule.name}"`}
        />
        <button
          onClick={() => onEdit(rule)}
          className="p-1 text-text-tertiary hover:text-text-primary"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(rule.id)}
          className="p-1 text-text-tertiary hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
