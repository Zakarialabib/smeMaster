import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Check, GitBranch, Archive, Star, Tag, Forward, FileText, Bell } from "lucide-react";
import { AiGenerationFlow } from "@shared/components/ai/AiGenerationFlow";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { generateWorkflowPreset } from "@shared/services/ai/workflowGenerator";
import type { WorkflowPreset } from "@/constants/workflowPresets";
import { useAiGenerationModal } from "@features/settings/hooks/useAiGenerationModal";

const TRIGGER_LABELS: Record<string, string> = {
  email_received: "modals.aiWorkflow.emailReceived",
  no_reply_after_days: "modals.aiWorkflow.noReplyAfterDays",
  time_based: "modals.aiWorkflow.timeBased",
  label_applied: "modals.aiWorkflow.labelApplied",
  starred: "modals.aiWorkflow.starred",
};

const ACTION_ICONS: Record<string, typeof Archive> = {
  archive: Archive,
  star: Star,
  apply_label: Tag,
  forward_to: Forward,
  create_task: FileText,
  send_template: FileText,
  send_notification: Bell,
};

interface AiWorkflowGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (preset: WorkflowPreset) => void;
}

export function AiWorkflowGenerateModal({
  isOpen,
  onClose,
  onCreate,
}: AiWorkflowGenerateModalProps) {
  const { t } = useTranslation();
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [category, setCategory] = useState<"automation" | "ai_enhanced">("automation");

  const generator = async (prompt: string) => {
    return generateWorkflowPreset(`${prompt}. Category: ${category}`);
  };

  const state = useAiGenerationModal<WorkflowPreset>(generator);

  const handleClose = () => {
    state.reset();
    onClose();
  };

  const handleCreate = () => {
    if (state.result) {
      onCreate(state.result);
      handleClose();
    }
  };

  const isLocked = isAiLocked;

  return (
    <AiGenerationFlow<WorkflowPreset>
      state={state}
      isOpen={isOpen}
      onClose={handleClose}
      title={t('modals.aiWorkflow.title')}
      isLocked={isLocked}
      lockFeatureName={t('modals.aiWorkflow.aiWorkflowLocked')}
      lockDescription={t('modals.aiWorkflow.aiWorkflowLockedDesc')}
      generatingLabel={t('modals.aiWorkflow.generatingWorkflow')}
      generatingSubLabel={t('modals.aiWorkflow.designingRules')}
      promptSlot={(generate, canGenerate) => (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              Describe the workflow you want to create
            </label>
            <textarea
              value={state.prompt}
              onChange={(e) => state.setPrompt(e.target.value)}
              placeholder={t('modals.aiWorkflow.describePlaceholder')}
              rows={4}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors resize-none placeholder:text-text-tertiary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">{t('modals.aiWorkflow.type')}</label>
            <div className="inline-flex rounded-lg border border-border-primary overflow-hidden">
              <button
                type="button"
                onClick={() => setCategory("automation")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === "automation"
                    ? "bg-accent text-white"
                    : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {t('modals.aiWorkflow.basicAutomation')}
              </button>
              <button
                type="button"
                onClick={() => setCategory("ai_enhanced")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === "ai_enhanced"
                    ? "bg-accent text-white"
                    : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
                }`}
              >
                {t('modals.aiWorkflow.aiEnhanced')}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} />
              {t('modals.aiWorkflow.generateWorkflow')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
            >
              {t('modals.aiWorkflow.cancel')}
            </button>
          </div>
        </div>
      )}
      previewSlot={(result, regenerate) => {
        const parsedActions = (() => {
          if (!result.actions) return [];
          try {
            return JSON.parse(result.actions) as Array<{ type: string; [key: string]: unknown }>;
          } catch {
            return [];
          }
        })();
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <GitBranch size={14} className="text-accent" />
                  {result.name}
                </h4>
                <p className="text-xs text-text-tertiary mt-0.5">{result.description}</p>
              </div>
              <span className={`text-[0.625rem] px-2 py-0.5 rounded-full border ${
                result.category === "ai_enhanced"
                  ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                  : "bg-accent/10 text-accent border-accent/20"
              }`}>
                {result.category === "ai_enhanced" ? t('modals.aiWorkflow.aiEnhanced') : t('modals.aiWorkflow.basicAutomation')}
              </span>
            </div>

            <div className="rounded-lg border border-border-primary p-3 bg-bg-secondary/50">
              <span className="text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider">{t('modals.aiWorkflow.triggerLabel')}</span>
              <p className="text-sm text-text-primary mt-1 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-medium">
                  {t(TRIGGER_LABELS[result.trigger_event] ?? result.trigger_event)}
                </span>
                {result.trigger_conditions && result.trigger_conditions !== "{}" && (
                  <span className="text-xs text-text-tertiary font-mono">
                    {result.trigger_conditions.slice(0, 80)}
                    {result.trigger_conditions.length > 80 ? "..." : ""}
                  </span>
                )}
              </p>
            </div>

            <div className="rounded-lg border border-border-primary p-3 bg-bg-secondary/50">
              <span className="text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider">
                {t('modals.aiWorkflow.actions')} ({parsedActions.length})
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {parsedActions.map((action, idx) => {
                  const ActionIcon = ACTION_ICONS[action.type] ?? Sparkles;
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-bg-tertiary border border-border-primary text-xs text-text-primary"
                    >
                      <ActionIcon size={10} className="text-accent" />
                      {action.type.replace(/_/g, " ")}
                    </span>
                  );
                })}
              </div>
            </div>

            <details className="group">
              <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary transition-colors select-none">
                {t('modals.aiWorkflow.viewRawConfig')}
              </summary>
              <pre className="mt-2 p-3 bg-bg-tertiary rounded-lg text-[0.625rem] text-text-secondary font-mono overflow-x-auto border border-border-primary">
                {JSON.stringify(
                  {
                    name: result.name,
                    trigger_event: result.trigger_event,
                    trigger_conditions: result.trigger_conditions,
                    actions: result.actions,
                    category: result.category,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>

            <div className="flex items-center gap-2 pt-1 border-t border-border-secondary">
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
              >
                <Check size={14} />
                {t('modals.aiWorkflow.createWorkflow')}
              </button>
              <button
                type="button"
                onClick={regenerate}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors ms-auto"
              >
                <Sparkles size={12} />
                {t('modals.aiWorkflow.regenerate')}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
              >
                {t('modals.aiWorkflow.cancel')}
              </button>
            </div>
          </div>
        );
      }}
    />
  );
}
