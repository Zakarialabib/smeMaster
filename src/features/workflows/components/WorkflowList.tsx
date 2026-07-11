/**
 * @deprecated This feature has been merged into @features/automation.
 * Import from @features/automation instead. Will be removed in a future version.
 */
import { Workflow } from "lucide-react";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Button } from "@shared/components/ui/Button";
import { WorkflowCard } from "./WorkflowCard";
import type { WorkflowRule } from "@features/workflows/db/workflows";

interface WorkflowListProps {
  workflows: WorkflowRule[];
  onToggle: (id: string, active: boolean) => void;
  onEdit: (workflow: WorkflowRule) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

export function WorkflowList({
  workflows,
  onToggle,
  onEdit,
  onDelete,
  onCreate,
}: WorkflowListProps) {
  if (workflows.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No workflows yet"
        subtitle="Create your first workflow to automate multi-step email sequences."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={onCreate}
          >
            Create Workflow
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {workflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
