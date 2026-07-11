import { RuleSummaryCard } from "@shared/components/rule";
import { safeParseJson } from "@shared/utils/safeParseJson";
import type { WorkflowRule } from "@features/settings/db/workflowRules";

interface AutomationRuleCardProps {
  rule: WorkflowRule;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (rule: WorkflowRule) => void;
  onDelete: (id: string) => void;
}

export function AutomationRuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: AutomationRuleCardProps) {
  const itemCount = safeParseJson<unknown[]>(rule.actions, []).length;
  return (
    <RuleSummaryCard
      rule={rule}
      isActive={rule.is_active === 1}
      itemCount={itemCount}
      countNoun="action"
      entityName="rule"
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

