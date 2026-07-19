import { Trash2, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import type { WorkflowStep } from "@features/automation/stores/automationStore";

const STEP_TYPE_LABELS: Record<string, string> = {
  apply_label: "Apply Label",
  send_template: "Send Template",
  create_task: "Create Task",
  mark_read: "Mark Read",
  archive: "Archive",
  star: "Star",
  forward_to: "Forward To",
  send_notification: "Send Notification",
  wait_days: "Wait Days",
};

function getStepDetail(step: WorkflowStep): string {
  switch (step.type) {
    case "apply_label":
      return typeof step.labelId === "string" ? step.labelId : "";
    case "send_template":
      return typeof step.templateId === "string" ? step.templateId : "";
    case "create_task":
      return typeof step.title === "string" ? step.title : "";
    case "forward_to":
      return typeof step.email === "string" ? step.email : "";
    case "wait_days":
      return typeof step.days === "number" ? `${step.days} day(s)` : "";
    default:
      return "";
  }
}

interface WorkflowStepCardProps {
  step: WorkflowStep;
  index: number;
  total: number;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export function WorkflowStepCard({
  step,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: WorkflowStepCardProps) {
  const detail = getStepDetail(step);

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-bg-tertiary rounded-lg border border-border-primary">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Reorder handles */}
        <div className="flex flex-col shrink-0">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={`Move step ${index + 1} up`}
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label={`Move step ${index + 1} down`}
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Step number */}
        <span className="text-[0.625rem] font-medium text-text-tertiary bg-bg-secondary w-5 h-5 rounded-full flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {step.label || (STEP_TYPE_LABELS[step.type] ?? step.type)}
          </div>
          {detail && (
            <div className="text-[0.625rem] text-text-tertiary truncate mt-0.5">
              {detail}
            </div>
          )}
        </div>

        {/* Type badge */}
        <span className="text-[0.625rem] bg-accent/10 text-accent px-1.5 py-0.5 rounded shrink-0">
          {STEP_TYPE_LABELS[step.type] ?? step.type}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button
          type="button"
          onClick={() => onEdit(index)}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label={`Edit step ${index + 1}`}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="p-1 text-text-tertiary hover:text-danger transition-colors"
          aria-label={`Delete step ${index + 1}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
