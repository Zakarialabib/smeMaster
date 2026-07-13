import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Star,
  Tag,
  Forward,
  FileText,
  Bell,
  Mail,
  Clock,
  RefreshCw,
  Sparkles,
  Check,
  Workflow,
} from "lucide-react";
import { WORKFLOW_PRESETS } from "@/constants/workflowPresets";
import type { WorkflowPreset } from "@/constants/workflowPresets";
import { GlassPanel } from "@shared/components/ui";
import { Button } from "@shared/components/ui/Button";

// ── Action icons ─────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  archive: Archive,
  star: Star,
  apply_label: Tag,
  forward_to: Forward,
  create_task: FileText,
  send_template: FileText,
  send_notification: Bell,
  mark_read: Mail,
  add_note: FileText,
  tag: Tag,
  flag: Star,
};

function getActionIcon(actionType: string): React.ComponentType<{ size?: number; className?: string }> {
  return ACTION_ICONS[actionType] ?? Workflow;
}

function parseActions(actionsJson: string): { type: string }[] {
  try {
    return JSON.parse(actionsJson) as { type: string }[];
  } catch {
    return [];
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface WorkflowTemplatesGalleryProps {
  onCreate: (preset: WorkflowPreset) => Promise<void>;
  onCancel: () => void;
  creating: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkflowTemplatesGallery({
  onCreate,
  onCancel,
  creating,
}: WorkflowTemplatesGalleryProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState<"automation" | "ai_enhanced">("automation");

  const filteredPresets = useMemo(
    () => WORKFLOW_PRESETS.filter((p) => p.category === category),
    [category],
  );

  const handleUse = async (preset: WorkflowPreset) => {
    setSelectedId(preset.id);
    await onCreate(preset);
    setSelectedId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <LayoutTemplate size={16} className="text-accent" />
            {t("automation.templatesTitle", "Workflow Templates")}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {t("automation.templatesSubtitle", "Pre-built workflows — one click to activate")}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setCategory("automation")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              category === "automation"
                ? "bg-accent text-white"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            {t("automation.templatesAutomation", "Automation")}
          </button>
          <button
            type="button"
            onClick={() => setCategory("ai_enhanced")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              category === "ai_enhanced"
                ? "bg-accent text-white"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Sparkles size={12} className="inline mr-1" />
            {t("automation.templatesAiEnhanced", "AI Enhanced")}
          </button>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPresets.map((preset) => {
          const actions = parseActions(preset.actions);
          const isApplying = selectedId === preset.id && creating;

          return (
            <GlassPanel
              key={preset.id}
              variant="card"
              className={`p-3.5 transition-all duration-200 ${
                isApplying ? "opacity-60" : "hover:shadow-md hover:border-accent/30"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {preset.name}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                    {preset.description}
                  </p>
                </div>
              </div>

              {/* Trigger badge */}
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={12} className="text-accent shrink-0" />
                <span className="text-xs text-text-secondary capitalize">
                  {preset.trigger_event.replace(/_/g, " ")}
                </span>
              </div>

              {/* Action icons */}
              <div className="flex items-center gap-1.5 mb-3">
                {actions.map((action, i) => {
                  const Icon = getActionIcon(action.type);
                  return (
                    <span
                      key={i}
                      className="w-6 h-6 rounded-md bg-bg-tertiary flex items-center justify-center"
                      title={action.type}
                    >
                      <Icon size={12} className="text-text-secondary" />
                    </span>
                  );
                })}
              </div>

              {/* Use button */}
              <Button
                variant={isApplying ? "glass" : "primary"}
                size="xs"
                className="w-full"
                icon={isApplying ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                onClick={() => handleUse(preset)}
                disabled={isApplying}
              >
                {isApplying
                  ? t("automation.applying", "Applying...")
                  : t("automation.useTemplate", "Use Template")}
              </Button>
            </GlassPanel>
          );
        })}
      </div>

      {/* Cancel */}
      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

// Local icon for the header
function LayoutTemplate(props: { size?: number; className?: string }) {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <rect width="18" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
    </svg>
  );
}
