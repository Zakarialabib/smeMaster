import { useState, useCallback } from "react";
import { Sun, Moon, Monitor, User, Users, Target, SlidersHorizontal, Zap, ArrowRight, Rocket } from "lucide-react";
import { DEMO_PRESETS } from "./demoPresets";
import type { DemoPresetId, ThemeMode, OnboardingData } from "../types";
import { useTranslation } from "react-i18next";

interface WelcomeStepProps {
  onNext: (data: Partial<OnboardingData>) => void;
  onExpressMode?: () => void;
  onSkipToDemos?: () => void;
}

const ICON_MAP: Record<string, typeof User> = {
  User,
  Users,
  Target,
  SlidersHorizontal,
};

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: typeof Sun; description: string }[] = [
  { id: "light", label: "Light", icon: Sun, description: "Bright and airy" },
  { id: "dark", label: "Dark", icon: Moon, description: "Easy on the eyes" },
  { id: "system", label: "System", icon: Monitor, description: "Follows your OS" },
];

export function WelcomeStep({ onNext, onExpressMode, onSkipToDemos }: WelcomeStepProps) {
  const { t } = useTranslation();
  const [businessName, setBusinessName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<DemoPresetId | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("system");

  const preset = selectedPreset ? DEMO_PRESETS.find((p) => p.id === selectedPreset) : null;

  const handleNext = useCallback(() => {
    onNext({
      businessName: businessName || "My Business",
      theme,
      demoPreset: selectedPreset ?? "custom",
      tools: preset?.tools ?? { mail: true, crm: true, campaigns: false, calendar: false, ai: false },
    });
  }, [businessName, theme, selectedPreset, preset, onNext]);

  const handleSkipToDemos = useCallback(() => {
    if (onSkipToDemos) {
      onSkipToDemos();
    } else {
      onNext({
        businessName: businessName || "My Business",
        theme,
        demoPreset: "skip",
        tools: { mail: true, crm: true, campaigns: false, calendar: false, ai: false },
      });
    }
  }, [businessName, theme, onNext, onSkipToDemos]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
          <Zap className="h-6 w-6 text-accent" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("onboarding.welcomeTitle")}</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{t("onboarding.welcomeDesc")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80">{t("onboarding.businessNameLabel")}</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder={t("onboarding.businessNamePlaceholder")}
            className="w-full rounded-xl border border-border bg-background/80 backdrop-blur-sm px-3.5 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80">{t("onboarding.themeLabel")}</label>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setTheme(opt.id)}
                  aria-pressed={isSelected}
                  className={[
                    "rounded-xl border px-2.5 py-3 text-center transition-all duration-200",
                    isSelected
                      ? "border-accent ring-2 ring-accent/25 bg-accent/[0.04]"
                      : "border-border hover:border-accent/35 hover:bg-accent/[0.02]",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 mx-auto mb-1.5" />
                  <p className="font-semibold text-xs">{t(`onboarding.theme.${opt.id}`)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t(`onboarding.theme.${opt.id}Desc`)}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground/80">{t("onboarding.profileLabel")}</label>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_PRESETS.map((p) => {
            const Icon = ICON_MAP[p.icon] || User;
            const isSelected = selectedPreset === p.id;
            const i18nKey = p.id.replace(/_(.)/g, (_, c) => c.toUpperCase());
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                aria-pressed={isSelected}
                type="button"
                className={[
                  "group relative rounded-xl border p-3 text-start transition-all duration-200",
                  isSelected
                    ? "border-accent ring-2 ring-accent/25 bg-accent/[0.04]"
                    : "border-border hover:border-accent/30 hover:bg-accent/[0.02]",
                ].join(" ")}
              >
                {isSelected && (
                  <span className="absolute top-2 end-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px]">
                    ✓
                  </span>
                )}
                <div className={`rounded-lg p-2 w-fit mb-2 transition-colors duration-200 ${isSelected ? "bg-accent/15" : "bg-muted group-hover:bg-accent/8"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="font-semibold text-xs leading-tight">{t(`onboarding.presets.${i18nKey}`)}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-relaxed">{t(`onboarding.presets.${i18nKey}Desc`)}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleSkipToDemos}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/[0.03] transition-all duration-200"
        >
          <Rocket className="h-3.5 w-3.5" />
          {t("onboarding.skipToDemos")}
        </button>
        {onExpressMode && (
          <button
            type="button"
            onClick={onExpressMode}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/[0.04] px-4 py-2.5 text-xs font-medium text-accent hover:bg-accent/[0.07] transition-all duration-200"
          >
            <Zap className="h-3.5 w-3.5" />
            {t("onboarding.quickStart")}
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedPreset}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        >
          {t("onboarding.continue")}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
