import { Workflow, Trash2, Pencil } from "lucide-react";
import { Toggle } from "@shared/components/ui/Toggle";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Button } from "@shared/components/ui/Button";
import { safeParseJson } from "@shared/utils/safeParseJson";
import type { WorkflowRule } from "@features/settings/db/workflowRules";

const TRIGGER_LABELS: Record<string, string> = {
  email_received: "Email Received",
  no_reply_after_days: "No Reply After Days",
  time_based: "Time Based",
  label_applied: "Label Applied",
  starred: "Email Starred",
};

interface AutomationRuleListProps {
  rules: WorkflowRule[];
  onToggle: (id: string, active: boolean) => void;
  onEdit: (rule: WorkflowRule) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export function AutomationRuleList({
  rules,
  onToggle,
  onEdit,
  onDelete,
  onCreate,
}: AutomationRuleListProps) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No automation rules yet"
        subtitle="Create your first rule to automate email actions."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Workflow size={14} />}
            onClick={onCreate}
          >
            Create Rule
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-primary">
      <table className="w-full text-sm" role="grid" aria-label="Automation rules">
        <thead>
          <tr className="bg-bg-tertiary text-text-secondary text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-2.5 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 font-medium">Trigger</th>
            <th className="text-left px-4 py-2.5 font-medium">Actions</th>
            <th className="text-center px-4 py-2.5 font-medium w-20">Active</th>
            <th className="text-right px-4 py-2.5 font-medium w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {rules.map((rule) => {
            const itemCount = safeParseJson<unknown[]>(rule.actions, []).length;
            const triggerLabel =
              TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event;
            return (
              <tr
                key={rule.id}
                className="bg-bg-secondary hover:bg-bg-hover transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {rule.name}
                    </span>
                    {!rule.is_active && (
                      <span className="text-[0.625rem] bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[0.625rem] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                    {triggerLabel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-text-secondary">
                    {itemCount} {itemCount === 1 ? "action" : "actions"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Toggle
                    size="sm"
                    checked={rule.is_active === 1}
                    onChange={(next) => onToggle(rule.id, next)}
                    aria-label={
                      rule.is_active
                        ? `Disable ${rule.name}`
                        : `Enable ${rule.name}`
                    }
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(rule)}
                      className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                      aria-label={`Edit ${rule.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(rule.id)}
                      className="p-1 text-text-tertiary hover:text-danger transition-colors"
                      aria-label={`Delete ${rule.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
