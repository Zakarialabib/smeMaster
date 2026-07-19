import { RuleSummaryCard } from "@shared/components/rule";
import { safeParseJson } from "@shared/utils/safeParseJson";
import type { WorkflowRule } from "@features/workflows/db/workflows";

interface WorkflowCardProps {
  workflow: WorkflowRule;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (workflow: WorkflowRule) => void;
  onDelete: (id: string) => void;
}

export function WorkflowCard({
  workflow,
  onToggle,
  onEdit,
  onDelete,
}: WorkflowCardProps) {
  const itemCount = safeParseJson<unknown[]>(workflow.actions, []).length;
  return (
    <RuleSummaryCard
      rule={workflow}
      isActive={workflow.is_active === 1}
      itemCount={itemCount}
      countNoun="step"
      entityName="workflow"
      createdAt={workflow.created_at}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
