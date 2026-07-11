// src/features/onboarding/OnboardingScreen.tsx
import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, Circle, Zap } from "lucide-react";
import { ONBOARDING_STEPS, DEFAULT_TOOLS, type OnboardingData } from "./types";
import { WelcomeStep } from "./steps/WelcomeStep";
import { ToolsStep } from "./steps/ToolsStep";
import { AccountSetupStep } from "./steps/AccountSetupStep";
import { CompletionStep } from "./steps/CompletionStep";
import { useOnboarding } from "./hooks/useOnboarding";

interface OnboardingScreenProps {
  onComplete: () => void;
  onProgress?: (step: number) => void;
}

export function OnboardingScreen({ onComplete, onProgress }: OnboardingScreenProps) {
  const [step, setStep] = useState(() => {
    // Attempt restore from sessionStorage immediately
    try {
      const saved = sessionStorage.getItem("smemaster.onboarding.step");
      if (saved) {
        const n = Number(saved);
        if (n >= 0 && n < ONBOARDING_STEPS.length) return n;
      }
    } catch { /* noop */ }
    return 0;
  });
  const [data, setData] = useState<OnboardingData>({
    businessName: "My Business",
    businessType: "solo",
    tools: DEFAULT_TOOLS,
    demoPreset: null,
    accountSkipped: true,
  });
  const { completeOnboarding } = useOnboarding();

  // Persist step changes to sessionStorage so progress survives tab crash
  useEffect(() => {
    sessionStorage.setItem("smemaster.onboarding.step", String(step));
    onProgress?.(step);
  }, [step, onProgress]);

  // Also listen for restore events from App.tsx (multi-tab safety)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ step: number }>).detail;
      if (detail.step >= 0 && detail.step < ONBOARDING_STEPS.length) {
        setStep(detail.step);
      }
    };
    window.addEventListener("smemaster-restore-onboarding", handler);
    return () => window.removeEventListener("smemaster-restore-onboarding", handler);
  }, []);

  const handleNext = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
    setStep((s) => Math.min(s + 1, ONBOARDING_STEPS.length - 1));
  }, []);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const handleExpressMode = useCallback(async () => {
    setData((prev) => ({
      ...prev,
      businessName: "My Business",
      tools: { mail: true, crm: true, campaigns: false, calendar: false, ai: false, sync: false },
    }));
    sessionStorage.removeItem("smemaster.onboarding.step");
    await completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  const handleFinalize = useCallback(async () => {
    sessionStorage.removeItem("smemaster.onboarding.step");
    await completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex bg-background overflow-hidden">
      {/* Left sidebar - Step progress */}
      <div className="hidden md:flex flex-col w-[260px] shrink-0 border-r border-border bg-card/30 p-8">
        {/* Brand */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">SMEMaster</h2>
          </div>
          <p className="text-xs text-muted-foreground ml-[42px]">Setup wizard</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Progress
            </span>
            <span className="text-[11px] font-semibold text-accent">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step timeline */}
        <div className="relative flex-1">
          <div className="absolute left-[11px] top-2 bottom-8 w-[2px] bg-border rounded-full" />
          <div className="space-y-8 relative">
            {ONBOARDING_STEPS.map((s, i) => {
              const isActive = step === i;
              const isPast = step > i;
              return (
                <div key={s.id} className="flex items-start gap-4 relative">
                  <div className="relative z-10 bg-card/30 py-1">
                    {isPast ? (
                      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent-foreground" />
                      </div>
                    ) : isActive ? (
                      <div className="w-6 h-6 rounded-full border-2 border-accent flex items-center justify-center bg-background shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-border flex items-center justify-center">
                        <Circle className="w-2.5 h-2.5 text-transparent" />
                      </div>
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={`text-sm font-semibold transition-colors duration-300 ${
                      isActive ? "text-foreground" :
                      isPast ? "text-foreground/70" :
                      "text-muted-foreground"
                    }`}>
                      {s.title}
                    </p>
                    <p className={`text-xs mt-0.5 transition-colors duration-300 ${
                      isActive ? "text-foreground/60" :
                      "text-muted-foreground/60"
                    }`}>
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 overflow-y-auto relative">
        {/* Subtle background gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--color-accent) 4%, transparent) 0%, transparent 60%)`,
          }}
        />
        <div className="w-full max-w-2xl relative">
          {step === 0 && <WelcomeStep onNext={handleNext} onExpressMode={handleExpressMode} />}
          {step === 1 && <ToolsStep initial={data.tools} onNext={(tools) => handleNext({ tools })} onBack={handleBack} />}
          {step === 2 && <AccountSetupStep onNext={() => setStep(3)} onBack={handleBack} />}
          {step === 3 && <CompletionStep data={data} onComplete={handleFinalize} onBack={handleBack} />}
        </div>
      </div>
    </div>
  );
}
