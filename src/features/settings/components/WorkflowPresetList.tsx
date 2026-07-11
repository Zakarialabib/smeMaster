import { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { WORKFLOW_PRESETS, type WorkflowPreset } from "@/constants/workflowPresets";
import { generateWorkflowPreset } from "@shared/services/ai/workflowGenerator";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";

const TRIGGER_LABELS: Record<string, string> = {
  email_received: "Email Received",
  no_reply_after_days: "No Reply After",
  time_based: "Scheduled",
};

interface WorkflowPresetListProps {
  onApply: (preset: WorkflowPreset) => void;
}

export function WorkflowPresetList({ onApply }: WorkflowPresetListProps) {
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPresets, setAiPresets] = useState<WorkflowPreset[]>([]);

  const allPresets = [...aiPresets, ...WORKFLOW_PRESETS];

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateWorkflowPreset(aiPrompt.trim());
      setAiPresets((prev) => [result, ...prev]);
      setAiPrompt("");
      setShowAiPrompt(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* AI Generate section */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Workflow Presets</h3>
        {isAiLocked ? (
          <UpgradeBadge variant="pro-only" size="sm" />
        ) : showAiPrompt ? (
          <div className="flex items-center gap-2 flex-1 ml-4">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerateWithAi();
                }
                if (e.key === "Escape") {
                  setShowAiPrompt(false);
                  setAiPrompt("");
                  setAiError(null);
                }
              }}
              placeholder="Describe the workflow you want..."
              className="flex-1 px-2.5 py-1.5 text-xs bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
              disabled={aiLoading}
              autoFocus
            />
            <button
              onClick={handleGenerateWithAi}
              disabled={aiLoading || !aiPrompt.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {aiLoading ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={() => { setShowAiPrompt(false); setAiPrompt(""); setAiError(null); }}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAiPrompt(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            <Sparkles size={14} />
            Generate with AI
          </button>
        )}
      </div>
      {aiError && (
        <p className="text-xs text-danger">{aiError}</p>
      )}

      {/* Preset grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {allPresets.map((preset) => (
          <div
            key={preset.id}
            className={`flex flex-col bg-bg-secondary rounded-md p-3 border ${
              aiPresets.some((p) => p.id === preset.id)
                ? "border-accent/40 bg-accent/[0.03]"
                : "border-border-primary"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {aiPresets.some((p) => p.id === preset.id) ? (
                <Sparkles size={13} className="text-purple-500 shrink-0" />
              ) : (
                <Sparkles size={13} className="text-accent shrink-0" />
              )}
              <span className="text-sm font-medium text-text-primary truncate">
                {preset.name}
              </span>
              {aiPresets.some((p) => p.id === preset.id) && (
                <span className="text-[0.5rem] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 ml-auto">
                  AI
                </span>
              )}
            </div>
            <p className="text-[0.6875rem] text-text-tertiary mb-2 line-clamp-2">
              {preset.description}
            </p>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-[0.625rem] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                {TRIGGER_LABELS[preset.trigger_event] ?? preset.trigger_event}
              </span>
              <button
                onClick={() => onApply(preset)}
                className="text-[0.625rem] font-medium text-white bg-accent hover:bg-accent-hover px-2 py-1 rounded transition-colors"
              >
                Apply Preset
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
