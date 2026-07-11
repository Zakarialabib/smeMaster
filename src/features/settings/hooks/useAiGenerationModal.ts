import { useState, useCallback } from "react";

// ─── Shared state for AI Generation Modals ───

export type ModalStep = "prompt" | "generating" | "preview" | "error";

export interface AiGenerationState<T> {
  step: ModalStep;
  prompt: string;
  result: T | null;
  error: string | null;
}

export interface AiGenerationActions<T> {
  setPrompt: (prompt: string) => void;
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  reset: () => void;
  setResult: (result: T) => void;
}

export function useAiGenerationModal<T>(
  generator: (prompt: string) => Promise<T>,
  initialPrompt = "",
): AiGenerationState<T> & AiGenerationActions<T> {
  const [step, setStep] = useState<ModalStep>("prompt");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("prompt");
    setPrompt(initialPrompt);
    setResult(null);
    setError(null);
  }, [initialPrompt]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setStep("generating");
    setError(null);
    try {
      const res = await generator(prompt.trim());
      setResult(res);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStep("error");
    }
  }, [prompt, generator]);

  const regenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setStep("generating");
    setError(null);
    try {
      const res = await generator(prompt.trim());
      setResult(res);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
      setStep("error");
    }
  }, [prompt, generator]);

  return {
    step,
    prompt,
    result,
    error,
    setPrompt,
    generate,
    regenerate,
    reset,
    setResult,
  };
}
