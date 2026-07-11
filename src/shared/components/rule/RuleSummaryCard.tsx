import { Trash2, Pencil } from "lucide-react";
import { Toggle } from "@shared/components/ui/Toggle";
import { TRIGGER_LABELS } from "./triggerLabels";

/** Minimum shape every rule-like object passed to the card must satisfy. */
export interface RuleSummaryCardRule {
  id: string;
  name: string;
  trigger_event: string;
  actions: string;
  is_active: number;
}

export type RuleSummaryEntityName = "rule" | "workflow";
export type RuleSummaryCountNoun = "action" | "step";

export interface RuleSummaryCardProps<TRule extends RuleSummaryCardRule> {
  /** The full rule object — id/name/trigger_event are read from here. */
  rule: TRule;
  /** Pre-computed active state (wrappers derive this from `rule.is_active`). */
  isActive: boolean;
  /** Pre-computed count of items (steps or actions) to show in the meta line. */
  itemCount: number;
  /** Singular noun for the count — "1 action" vs "1 step". */
  countNoun: RuleSummaryCountNoun;
  /** Used to build ARIA labels: "Disable rule" / "Enable workflow" / etc. */
  entityName: RuleSummaryEntityName;
  /** Unix epoch seconds. When provided, renders a "Created <date>" line. */
  createdAt?: number;
  onToggle: (id: string, next: boolean) => void;
  onEdit: (rule: TRule) => void;
  onDelete: (id: string) => void;
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatCreatedAt(ts: number): string {
  // `created_at` is a millisecond-precision unix epoch (per schema + WorkflowCard).
  return DATE_FORMATTER.format(new Date(ts));
}

/**
 * RuleSummaryCard — single-row summary for an automation rule or workflow.
 *
 * Consolidates `AutomationRuleCard` (automation/) and `WorkflowCard`
 * (workflows/) into one presentational component. The wrappers are
 * responsible for domain-level concerns (JSON parsing, is_active derivation)
 * and pass derived values (`isActive`, `itemCount`, optional `createdAt`)
 * into this card.
 *
 * Uses the shared `<Toggle size="sm" />` for the active switch.
 *
 * @example
 * ```tsx
 * <RuleSummaryCard
 *   rule={workflow}
 *   isActive={workflow.is_active === 1}
 *   itemCount={stepCount}
 *   countNoun="step"
 *   entityName="workflow"
 *   createdAt={workflow.created_at}
 *   onToggle={handleToggle}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export function RuleSummaryCard<TRule extends RuleSummaryCardRule>({
  rule,
  isActive,
  itemCount,
  countNoun,
  entityName,
  createdAt,
  onToggle,
  onEdit,
  onDelete,
}: RuleSummaryCardProps<TRule>) {
  const triggerLabel = TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event;
  const countLabel = itemCount === 1 ? countNoun : `${countNoun}s`;

  return (
    <div className="flex items-center justify-between py-2.5 px-3 bg-bg-secondary rounded-lg border border-border-primary hover:border-border-secondary transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary flex items-center gap-2">
          <span className="truncate">{rule.name}</span>
          {!isActive && (
            <span className="text-[0.625rem] bg-bg-tertiary text-text-tertiary px-1.5 py-0.5 rounded shrink-0">
              Disabled
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.625rem] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
            {triggerLabel}
          </span>
          {itemCount > 0 && (
            <span className="text-[0.625rem] text-text-tertiary">
              {itemCount} {countLabel}
            </span>
          )}
          {createdAt !== undefined && (
            <span className="text-[0.625rem] text-text-tertiary">
              Created {formatCreatedAt(createdAt)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Toggle
          size="sm"
          checked={isActive}
          onChange={(next) => onToggle(rule.id, next)}
          aria-label={isActive ? `Disable ${entityName}` : `Enable ${entityName}`}
        />
        <button
          type="button"
          onClick={() => onEdit(rule)}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label={`Edit ${entityName}`}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(rule.id)}
          className="p-1 text-text-tertiary hover:text-danger transition-colors"
          aria-label={`Delete ${entityName}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

