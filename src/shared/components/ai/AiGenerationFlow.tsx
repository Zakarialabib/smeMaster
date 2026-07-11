import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@shared/components/ui/Modal";
import { UpgradeBanner } from "@shared/components/ui/UpgradeBadge";

/**
 * Step state of an AI generation flow. Mirrors the `step` field returned by
 * `useAiGenerationModal` (in `@features/settings/hooks/useAiGenerationModal`).
 *
 * Re-declared locally to avoid a shared → features import cycle. The
 * consumer's hook return must match this shape.
 */
export type AiStep = "prompt" | "generating" | "preview" | "error";

/**
 * State portion of `useAiGenerationModal`. Re-declared locally to avoid a
 * shared → features import cycle.
 */
export interface AiState<T> {
  step: AiStep;
  prompt: string;
  result: T | null;
  error: string | null;
}

/**
 * Actions portion of `useAiGenerationModal`. Re-declared locally to avoid a
 * shared → features import cycle.
 */
export interface AiActions<T> {
  setPrompt: (prompt: string) => void;
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  reset: () => void;
  setResult: (result: T) => void;
}

export type AiGenerationStateReturn<T> = AiState<T> & AiActions<T>;

export interface AiGenerationFlowProps<T> {
  /** Full return value of `useAiGenerationModal`. */
  state: AiGenerationStateReturn<T>;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** When true, renders the locked banner and hides the flow. */
  isLocked: boolean;
  /** Custom override for the default `<UpgradeBanner>`. */
  lockedBanner?: ReactNode;
  /** Name of the feature for the default locked banner. */
  lockFeatureName?: string;
  /** Description for the default locked banner. */
  lockDescription?: string;
  /** Renders the prompt form. Receives `generate` and `canGenerate`. */
  promptSlot: (generate: () => void, canGenerate: boolean) => ReactNode;
  /** Renders the result preview. Receives `result`, `regenerate`, `reset`. */
  previewSlot: (result: T, regenerate: () => void, reset: () => void) => ReactNode;
  /** Optional custom error UI. Falls back to a default banner + retry. */
  errorSlot?: (error: string, retry: () => void) => ReactNode;
  /** Label shown while the model is generating (already translated). */
  generatingLabel: string;
  /** Optional sub-caption shown under the generating label. */
  generatingSubLabel?: string;
  /** Label for the default error retry button. */
  retryLabel?: string;
  /** Label for the default error cancel button. */
  cancelLabel?: string;
}

/**
 * AiGenerationFlow — shared scaffolding for the 4 AI generation modals in
 * settings/ (workflow, warmup, template, signature).
 *
 * Replaces ~150 lines of identical Modal + step-render boilerplate per modal.
 * The per-feature `promptSlot` and `previewSlot` stay in the caller.
 *
 * @example
 * ```tsx
 * const { state, ... } = useAiGenerationModal(generator);
 *
 * <AiGenerationFlow<MyResult>
 *   state={state}
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title={t("modals.workflow.title")}
 *   isLocked={isLocked}
 *   lockFeatureName={t("modals.workflow.locked")}
 *   lockDescription={t("modals.workflow.lockedDesc")}
 *   promptSlot={(generate, canGenerate) => <MyPromptForm ... />}
 *   previewSlot={(result, regenerate, reset) => <MyResultView ... />}
 *   generatingLabel={t("modals.workflow.generating")}
 *   generatingSubLabel={t("modals.workflow.designing")}
 * />
 * ```
 */
export function AiGenerationFlow<T>({
  state,
  isOpen,
  onClose,
  title,
  isLocked,
  lockedBanner,
  lockFeatureName,
  lockDescription,
  promptSlot,
  previewSlot,
  errorSlot,
  generatingLabel,
  generatingSubLabel,
  retryLabel = "Try again",
  cancelLabel = "Cancel",
}: AiGenerationFlowProps<T>) {
  const handleClose = () => {
    state.reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="xl"
      panelClassName="max-h-[85vh] flex flex-col"
    >
      <div className="flex flex-col gap-4 p-1">
        {/* Locked state */}
        {isLocked && (
          lockedBanner ?? (
            <UpgradeBanner
              featureName={lockFeatureName ?? title}
              description={lockDescription}
            />
          )
        )}

        {/* PROMPT STEP */}
        {state.step === "prompt" && !isLocked && promptSlot(state.generate, state.prompt.trim().length > 0)}

        {/* GENERATING STEP */}
        {state.step === "generating" && !isLocked && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 size={24} className="text-accent animate-spin" />
            <p className="text-sm text-text-secondary">{generatingLabel}</p>
            {generatingSubLabel && (
              <p className="text-xs text-text-tertiary">{generatingSubLabel}</p>
            )}
          </div>
        )}

        {/* PREVIEW STEP */}
        {state.step === "preview" && state.result && !isLocked &&
          previewSlot(state.result, state.regenerate, state.reset)}

        {/* ERROR STEP */}
        {state.step === "error" && !isLocked &&
          (errorSlot ? (
            errorSlot(state.error ?? "Generation failed", state.generate)
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger text-center max-w-md">
                {state.error ?? "Generation failed"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={state.generate}
                  className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                >
                  {retryLabel}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
                >
                  {cancelLabel}
                </button>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  );
}

