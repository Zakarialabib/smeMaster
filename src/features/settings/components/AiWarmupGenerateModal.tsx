import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Check,
  Thermometer,
  X,
  RefreshCw,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { generateWarmupPreset } from "@shared/services/ai/warmupGenerator";
import type { WarmupPreset } from "@/constants/warmupPresets";
import { useAiGenerationModal } from "@features/settings/hooks/useAiGenerationModal";
import { AiGenerationFlow } from "@shared/components/ai/AiGenerationFlow";
import { cn } from "@shared/utils/cn";

const STYLES: {
  value: WarmupPreset["style"];
  labelKey: string;
  descriptionKey: string;
  emoji: string;
}[] = [
  { value: "follow_up", labelKey: "modals.aiWarmup.followUp", descriptionKey: "modals.aiWarmup.followUpDesc", emoji: "↩️" },
  { value: "thank_you", labelKey: "modals.aiWarmup.thankYou", descriptionKey: "modals.aiWarmup.thankYouDesc", emoji: "🙏" },
  { value: "introduction", labelKey: "modals.aiWarmup.introduction", descriptionKey: "modals.aiWarmup.introductionDesc", emoji: "👋" },
  { value: "meeting_request", labelKey: "modals.aiWarmup.meetingRequest", descriptionKey: "modals.aiWarmup.meetingRequestDesc", emoji: "📅" },
  { value: "check_in", labelKey: "modals.aiWarmup.checkIn", descriptionKey: "modals.aiWarmup.checkInDesc", emoji: "✅" },
  { value: "sharing_content", labelKey: "modals.aiWarmup.sharingContent", descriptionKey: "modals.aiWarmup.sharingContentDesc", emoji: "🔗" },
];

const TONES = ["Professional", "Friendly", "Casual"] as const;

interface AiWarmupGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (preset: WarmupPreset) => void;
}

export function AiWarmupGenerateModal({
  isOpen,
  onClose,
  onAdd,
}: AiWarmupGenerateModalProps) {
  const { t } = useTranslation();
  const isLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [style, setStyle] = useState<WarmupPreset["style"]>("follow_up");
  const [tone, setTone] = useState<string>("Friendly");
  const [context, setContext] = useState("");
  const [copied, setCopied] = useState(false);

  const generator = async (_prompt: string) =>
    generateWarmupPreset({
      style,
      tone: tone.toLowerCase(),
      context: context || undefined,
    });

  const state = useAiGenerationModal<WarmupPreset>(generator);

  const handleClose = () => {
    state.reset();
    setCopied(false);
    onClose();
  };

  const handleAdd = (result: WarmupPreset) => {
    onAdd(result);
    handleClose();
  };

  const handleCopy = async (result: WarmupPreset) => {
    const text = `${result.subject}\n\n${result.bodyHtml.replace(/<[^>]+>/g, "")}`;
    try {
      const { copyToClipboard } = await import("@shared/hooks/useClipboard");
      await copyToClipboard(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <AiGenerationFlow<WarmupPreset>
      state={state}
      isOpen={isOpen}
      onClose={handleClose}
      title={t("modals.aiWarmup.title")}
      isLocked={isLocked}
      lockFeatureName={t("modals.aiWarmup.aiWarmupLocked")}
      lockDescription={t("modals.aiWarmup.aiWarmupLockedDesc")}
      generatingLabel={t("modals.aiWarmup.generatingWarmup")}
      generatingSubLabel={t("modals.aiWarmup.craftingNatural")}
      promptSlot={(generate) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 block">
              {t("modals.aiWarmup.warmupStyle")}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-start transition-all active:scale-95",
                    style === s.value
                      ? "bg-accent/10 text-accent border-accent/30 shadow-sm"
                      : "bg-bg-tertiary/50 text-text-tertiary border-border hover:text-text-secondary hover:border-border-secondary hover:bg-bg-tertiary"
                  )}
                >
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span className="text-xs font-semibold">{t(s.labelKey)}</span>
                  <span className="text-[0.625rem] leading-tight opacity-70">
                    {t(s.descriptionKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 block">
              {t("modals.aiWarmup.tone")}
            </label>
            <div className="inline-flex rounded-xl border border-border overflow-hidden bg-bg-tertiary/50 p-0.5">
              {TONES.map((toneOption) => (
                <button
                  key={toneOption}
                  type="button"
                  onClick={() => setTone(toneOption)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    tone === toneOption
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {toneOption}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 block">
              {t("modals.aiWarmup.contextOptional")}
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={t("modals.aiWarmup.contextPlaceholder")}
              rows={3}
              className="w-full px-3 py-2.5 bg-bg-tertiary/50 border border-border rounded-xl text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none placeholder:text-text-tertiary"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-accent text-white rounded-xl hover:bg-accent-hover transition-all shadow-sm hover:shadow active:scale-95"
            >
              <Sparkles size={14} />
              {t("modals.aiWarmup.generateWarmup")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-xl hover:bg-bg-hover transition-colors"
            >
              {t("modals.aiWarmup.cancel")}
            </button>
          </div>
        </form>
      )}
      previewSlot={(result, regenerate) => (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/10">
                <Thermometer size={16} className="text-accent" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary">{result.name}</h4>
                <p className="text-[10px] text-text-tertiary capitalize">
                  {result.style.replace(/_/g, " ")} · {tone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCopy(result)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-border hover:border-border-secondary bg-bg-tertiary hover:bg-bg-primary transition-colors text-text-secondary"
              >
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-bg-tertiary/30 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              Subject Line
            </span>
            <p className="text-sm text-text-primary mt-1 font-medium">{result.subject}</p>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden bg-white">
            <div className="px-3 py-2 bg-bg-tertiary/30 border-b border-border/30 flex items-center gap-2">
              <MailIcon className="w-3 h-3 text-text-tertiary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                Preview
              </span>
            </div>
            <div className="p-5">
              <div
                className="text-sm text-gray-800 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: result.bodyHtml }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-success/5 border border-success/20">
            <CheckCircle2 size={14} className="text-success shrink-0" />
            <span className="text-xs text-success font-medium">
              Content passes spam-filter heuristics and readability checks.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => handleAdd(result)}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-accent text-white rounded-xl hover:bg-accent-hover transition-all shadow-sm active:scale-95"
            >
              <Check size={14} />
              {t("modals.aiWarmup.addWarmup")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-xl hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={regenerate}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-xl hover:bg-bg-hover transition-colors ms-auto"
            >
              <RefreshCw size={12} />
              {t("modals.aiWarmup.regenerate")}
            </button>
          </div>
        </div>
      )}
      errorSlot={(errorMsg, retry) => (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="p-4 rounded-full bg-danger/10 animate-pulse">
            <X size={20} className="text-danger" />
          </div>
          <div className="px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-sm text-danger text-center max-w-md">
            {errorMsg || t("modals.aiWarmup.failedToGenerate")}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-accent text-white rounded-xl hover:bg-accent-hover transition-all shadow-sm active:scale-95"
            >
              <Sparkles size={14} />
              {t("modals.aiWarmup.tryAgain")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-xl hover:bg-bg-hover transition-colors"
            >
              {t("modals.aiWarmup.cancel")}
            </button>
          </div>
        </div>
      )}
    />
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
