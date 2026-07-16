import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, Circle, Zap } from "lucide-react";
import { ONBOARDING_STEPS, DEFAULT_TOOLS, type OnboardingData } from "./types";
import { WelcomeStep } from "./steps/WelcomeStep";
import { ToolsStep } from "./steps/ToolsStep";
import { AccountSetupStep } from "./steps/AccountSetupStep";
import { CompletionStep } from "./steps/CompletionStep";
import { useOnboarding } from "./hooks/useOnboarding";
import { seedDemoPreset, finalizeOnboarding } from "@shared/services/db/invoke/onboarding";
import { useTranslation } from "react-i18next";

interface OnboardingScreenProps {
  onComplete: () => void;
  onProgress?: (step: number) => void;
}

const DEFAULT_DATA: OnboardingData = {
  businessName: "My Business",
  tools: DEFAULT_TOOLS,
  demoPreset: null,
  accountSkipped: true,
  theme: "system",
  emailConnected: false,
  acknowledgedPro: false,
  step: 0,
};

export function OnboardingScreen({ onComplete, onProgress }: OnboardingScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem("smemaster.onboarding.step");
      if (saved) {
        const n = Number(saved);
        if (n >= 0 && n < ONBOARDING_STEPS.length) return n;
      }
    } catch { /* noop */ }
    return 0;
  });
  const [data, setData] = useState<OnboardingData>({ ...DEFAULT_DATA });
  const { completeOnboarding } = useOnboarding();

  useEffect(() => {
    sessionStorage.setItem("smemaster.onboarding.step", String(step));
    onProgress?.(step);
  }, [step, onProgress]);

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
      tools: { mail: true, crm: true, campaigns: false, calendar: false, ai: false },
    }));
    sessionStorage.removeItem("smemaster.onboarding.step");
    try {
      await completeOnboarding();
    } catch {
      /* backend may be unavailable (browser/dev server) */
    }
    onComplete();
  }, [completeOnboarding, onComplete]);

  const handleSkipToDemos = useCallback(async () => {
    sessionStorage.removeItem("smemaster.onboarding.step");
    try {
      await seedDemoPreset("solo_freelancer", data.businessName || "SME Master Demo", data.theme);
    } catch {
      /* backend seeding may be unavailable (browser/dev server) */
    }
    try {
      await completeOnboarding();
    } catch {
      /* backend may be unavailable (browser/dev server) */
    }
    onComplete();
  }, [completeOnboarding, onComplete, data.businessName, data.theme]);

  const handleFinalize = useCallback(async () => {
    sessionStorage.removeItem("smemaster.onboarding.step");
    try {
      await finalizeOnboarding({
        businessName: data.businessName || "My Business",
        theme: data.theme || "system",
        enableMail: data.tools.mail,
        enableCrm: data.tools.crm,
        enableCampaigns: data.tools.campaigns,
        enableCalendar: data.tools.calendar,
        enableAi: data.tools.ai,
        hasConnectedEmail: data.emailConnected || false,
      });
    } catch {
      await completeOnboarding();
    }
    onComplete();
  }, [completeOnboarding, onComplete, data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-bg-primary/30 backdrop-blur-[3px]" />
      <div className="relative w-full max-w-3xl overflow-hidden frost-surface rounded-[--frost-radius-lg] border border-[var(--color-border-primary)]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-accent) 6%, transparent) 0%, transparent 50%)" }}
        />

        <div className="relative px-6 py-5 md:px-10 md:py-6 border-b border-[var(--color-border-primary)]/60">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <Zap className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">SMEMaster</p>
                <p className="text-[11px] text-muted-foreground -mt-0.5">{t("onboarding.setupWizard")}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExpressMode}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/[0.04] px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/[0.07] transition-all duration-200"
            >
              <Zap className="h-3.5 w-3.5" />
              {t("onboarding.quickStart")}
            </button>
          </div>

          <Stepper step={step} />
        </div>

        <div className="relative px-6 py-6 md:px-10 md:py-8 max-h-[68vh] overflow-y-auto">
          {step === 0 && (
            <WelcomeStep
              onNext={handleNext}
              onExpressMode={handleExpressMode}
              onSkipToDemos={handleSkipToDemos}
            />
          )}
          {step === 1 && (
            <ToolsStep
              initial={data.tools}
              onNext={(tools) => handleNext({ tools })}
              onBack={handleBack}
            />
          )}
          {step === 2 && (
            <AccountSetupStep
              onNext={(partial) => handleNext(partial)}
              onBack={handleBack}
              mailSelected={data.tools.mail}
            />
          )}
          {step === 3 && (
            <CompletionStep
              data={data}
              onComplete={handleFinalize}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      {ONBOARDING_STEPS.map((s, i) => {
        const isActive = step === i;
        const isPast = step > i;
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                isPast
                  ? "border-accent bg-accent text-accent-foreground"
                  : isActive
                    ? "border-accent bg-background text-accent"
                    : "border-border text-transparent",
              ].join(" ")}>
                {isPast ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <div className="h-2 w-2 rounded-full bg-accent" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="leading-none">
                <p className={[
                  "text-[11px] font-semibold transition-colors duration-300",
                  isActive ? "text-foreground" : isPast ? "text-foreground/80" : "text-muted-foreground",
                ].join(" ")}>
                  {t(`onboarding.steps.${s.id}`)}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {t(`onboarding.steps.${s.id}Desc`)}
                </p>
              </div>
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <div className="mx-2 h-px flex-1 bg-border/70" />
            )}
          </div>
        );
      })}
    </div>
  );
}
