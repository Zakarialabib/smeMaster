import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Check, Eye, FileText } from "lucide-react";
import { AiGenerationFlow } from "@shared/components/ai/AiGenerationFlow";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { generateTemplate, type GeneratedTemplate } from "@shared/services/ai/templateGenerator";
import { useAiGenerationModal } from "@features/settings/hooks/useAiGenerationModal";
import type { CampaignTemplate } from "@/constants/campaignTemplates";

const CATEGORIES: { value: CampaignTemplate["category"]; labelKey: string }[] = [
  { value: "announcement", labelKey: "modals.aiTemplate.announcement" },
  { value: "newsletter", labelKey: "modals.aiTemplate.newsletter" },
  { value: "promotion", labelKey: "modals.aiTemplate.promotion" },
  { value: "follow-up", labelKey: "modals.aiTemplate.followUp" },
  { value: "event", labelKey: "modals.aiTemplate.event" },
  { value: "welcome", labelKey: "modals.aiTemplate.welcome" },
  { value: "feedback", labelKey: "modals.aiTemplate.feedback" },
  { value: "invoice", labelKey: "modals.aiTemplate.invoice" },
  { value: "meeting", labelKey: "modals.aiTemplate.meeting" },
  { value: "holiday", labelKey: "modals.aiTemplate.holiday" },
];

interface AiTemplateGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (template: GeneratedTemplate) => void;
  onSave?: (template: GeneratedTemplate) => void;
}

export function AiTemplateGenerateModal({
  isOpen,
  onClose,
  onInsert,
  onSave,
}: AiTemplateGenerateModalProps) {
  const { t } = useTranslation();
  const isLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [category, setCategory] = useState<CampaignTemplate["category"] | "">("");

  const generator = async (prompt: string) =>
    generateTemplate(prompt, category || undefined);

  const state = useAiGenerationModal<GeneratedTemplate>(generator);

  const handleClose = () => {
    state.reset();
    onClose();
  };

  const handleInsert = () => {
    if (state.result) {
      onInsert(state.result);
      handleClose();
    }
  };

  const handleSave = () => {
    if (state.result && onSave) {
      onSave(state.result);
      handleClose();
    }
  };

  return (
    <AiGenerationFlow<GeneratedTemplate>
      state={state}
      isOpen={isOpen}
      onClose={onClose}
      title={t("modals.aiTemplate.title")}
      isLocked={isLocked}
      lockFeatureName={t("modals.aiTemplate.aiTemplateLocked")}
      lockDescription={t("modals.aiTemplate.aiTemplateLockedDesc")}
      generatingLabel={t("modals.aiTemplate.generatingTemplate")}
      generatingSubLabel={t("modals.aiTemplate.craftingHtml")}
      promptSlot={(generate, canGenerate) => (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              Describe the template you want
            </label>
            <textarea
              value={state.prompt}
              onChange={(e) => state.setPrompt(e.target.value)}
              placeholder={t("modals.aiTemplate.describePlaceholder")}
              rows={4}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors resize-none placeholder:text-text-tertiary"
              disabled={isLocked}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {t("modals.aiTemplate.categoryOptional")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(category === cat.value ? "" : cat.value)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    category === cat.value
                      ? "bg-accent/15 text-accent border-accent/30 font-medium"
                      : "bg-bg-tertiary text-text-tertiary border-border-primary hover:text-text-secondary hover:border-border-secondary"
                  }`}
                >
                  {t(cat.labelKey)}
                </button>
              ))}
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
              {t("modals.aiTemplate.generateTemplate")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
            >
              {t("modals.aiTemplate.cancel")}
            </button>
          </div>
        </div>
      )}
      previewSlot={(result, regenerate) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText size={14} className="text-accent" />
                {result.name}
              </h4>
              <p className="text-xs text-text-tertiary mt-0.5">{result.description}</p>
            </div>
            <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 capitalize">
              {result.category}
            </span>
          </div>

          <div className="border border-border-primary rounded-lg overflow-hidden bg-bg-primary">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-secondary bg-bg-tertiary/50">
              <Eye size={12} className="text-text-tertiary" />
              <span className="text-[0.625rem] text-text-tertiary font-medium">{t("modals.aiTemplate.preview")}</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <iframe
                srcDoc={result.html}
                sandbox="allow-same-origin"
                className="w-full border-0 bg-white"
                style={{ height: 280 }}
                title="Template preview"
              />
            </div>
          </div>

          {result.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[0.625rem] text-text-tertiary mr-1 self-center">{t("modals.aiTemplate.variables")}</span>
              {result.variables.map((v) => (
                <code
                  key={v}
                  className="text-[0.625rem] px-1.5 py-0.5 rounded bg-accent/5 text-accent border border-accent/10"
                >
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-border-secondary">
            <button
              type="button"
              onClick={handleInsert}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Check size={14} />
              {t("modals.aiTemplate.insertTemplate")}
            </button>
            {onSave && (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover border border-border-primary transition-colors"
              >
                <FileText size={14} />
                {t("modals.aiTemplate.saveTemplate")}
              </button>
            )}
            <button
              type="button"
              onClick={regenerate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors ml-auto"
            >
              <Sparkles size={12} />
              {t("modals.aiTemplate.regenerate")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
            >
              {t("modals.aiTemplate.cancel")}
            </button>
          </div>
        </div>
      )}
    />
  );
}
