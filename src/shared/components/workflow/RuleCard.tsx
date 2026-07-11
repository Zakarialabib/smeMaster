import { Trash2, Pencil } from "lucide-react";
import { Toggle } from "@shared/components/ui/Toggle";
import { Badge } from "@shared/components/ui/Badge";
import { safeParseJson } from "@shared/utils/safeParseJson";
import type { WorkflowRule } from "@shared/services/db/schema";

export type RuleCardCountUnit = "step" | "action";

export interface RuleCardProps {
  rule: WorkflowRule;
  /** Pre-resolved label for the rule's trigger event (e.g. "Email Received"). */
  triggerLabel: string;
  /** "step" => "X step(s)", "action" => "X action(s)". */
  countUnit: RuleCardCountUnit;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (rule: WorkflowRule) => void;
  onDelete: (id: string) => void;
  /** When true, renders the "Created <date>" line. Defaults to false. */
  showCreatedDate?: boolean;
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatCreatedAt(ts: number): string {
  return DATE_FORMATTER.format(new Date(ts));
}

/**
 * RuleCard - single-row workflow / automation rule display.
 *
 * Consolidates `WorkflowCard` (workflows/), `AutomationRuleCard` (automation/),
 * and `WorkflowRuleCard` (settings/).
 *
 * - Uses the shared `<Toggle size="sm" />` for the active switch.
 * - Uses `<Badge>` for the "Disabled" state.
 * - Uses `safeParseJson` to count items in the actions JSON.
 *
 * @example
 * ```tsx
 * <RuleCard
 *   rule={workflow}
 *   triggerLabel="Email Received"
 *   countUnit="step"
 *   onToggle={handleToggle}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   showCreatedDate
 * />
 * ```
 */
export function RuleCard({
  rule,
  triggerLabel,
  countUnit,
  onToggle,
  onEdit,
  onDelete,
  showCreatedDate = false,
}: RuleCardProps) {
  const isActive = rule.is_active === 1;
  const count = safeParseJson<unknown[]>(rule.actions, []).length;
  const unitLabel = count === 1 ? countUnit : `${countUnit}s`;
  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-bg-secondary rounded-lg border border-border-primary hover:border-border-secondary transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary flex items-center gap-2">
          <span className="truncate">{rule.name}</span>
          {!isActive && (
            <Badge variant="default" size="sm">
              Disabled
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.625rem] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
            {triggerLabel}
          </span>
          {count > 0 && (
            <span className="text-[0.625rem] text-text-tertiary">
              {count} {unitLabel}
            </span>
          )}
          {showCreatedDate && (
            <span className="text-[0.625rem] text-text-tertiary">
              Created {formatCreatedAt(rule.created_at)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Toggle
          size="sm"
          checked={isActive}
          onChange={(next) => onToggle(rule.id, next)}
          aria-label={isActive ? `Disable ${countUnit}` : `Enable ${countUnit}`}
        />
        <button
          type="button"
          onClick={() => onEdit(rule)}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label={`Edit ${countUnit}`}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(rule.id)}
          className="p-1 text-text-tertiary hover:text-danger transition-colors"
          aria-label={`Delete ${countUnit}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default RuleCard;
