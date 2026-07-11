// src/features/onboarding/steps/WelcomeStep.tsx
import { useState, useCallback } from "react";
import { Sun, Moon, Monitor, User, Users, Target, SlidersHorizontal, Zap, ArrowRight, Rocket } from "lucide-react";
import { DEMO_PRESETS } from "./demoPresets";
import type { DemoPresetId, ThemeMode, OnboardingData } from "../types";

interface WelcomeStepProps {
  onNext: (data: Partial<OnboardingData>) => void;
  onExpressMode: () => void;
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

export function WelcomeStep({ onNext, onSkipToDemos }: WelcomeStepProps) {
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
      // Fallback: use onNext directly
      onNext({
        businessName: businessName || "My Business",
        theme,
        demoPreset: "skip",
        tools: { mail: true, crm: true, campaigns: false, calendar: false, ai: false },
      });
    }
  }, [businessName, theme, onNext, onSkipToDemos]);

  return (
    <div
      className="flex flex-col gap-8 w-full max-w-2xl mx-auto"
      style={{ animation: "fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-4 shadow-[0_0_20px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]">
          <Zap className="h-7 w-7 text-accent" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          Welcome to SMEMaster
        </h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto leading-relaxed">
          All-in-one mail, CRM, and campaign management for your business
        </p>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Business Name</label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="My Business"
          className="w-full rounded-xl border border-border bg-background/80 backdrop-blur-sm px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {/* Theme Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80">Theme Preference</label>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt, idx) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={`group relative rounded-xl border p-4 text-center transition-all duration-300 ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-accent/[0.04]"
                    : "border-border hover:border-accent/40 hover:bg-accent/[0.02]"
                }`}
                style={{
                  animation: `scalePop 350ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-accent-foreground text-xs font-bold">✓</span>
                  </div>
                )}
                <div className={`rounded-lg p-2.5 w-fit mx-auto mb-2 transition-all duration-300 ${
                  isSelected ? "bg-accent/15" : "bg-muted group-hover:bg-accent/8"
                }`}>
                  <Icon className={`h-5 w-5 transition-colors duration-300 ${
                    isSelected ? "text-accent" : "text-muted-foreground group-hover:text-accent/70"
                  }`} />
                </div>
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Demo Presets */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80">Choose your profile</label>
        <div className="grid grid-cols-2 gap-3">
          {DEMO_PRESETS.map((p, idx) => {
            const Icon = ICON_MAP[p.icon] || User;
            const isSelected = selectedPreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                className={`group relative rounded-xl border p-4 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30 bg-accent/[0.04]"
                    : "border-border hover:border-accent/40 hover:bg-accent/[0.02]"
                }`}
                style={{
                  animation: `scalePop 350ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-accent-foreground text-xs font-bold">✓</span>
                  </div>
                )}
                <div className={`rounded-lg p-2.5 w-fit mb-3 transition-all duration-300 ${
                  isSelected ? "bg-accent/15" : "bg-muted group-hover:bg-accent/8"
                }`}>
                  <Icon className={`h-5 w-5 transition-colors duration-300 ${
                    isSelected ? "text-accent" : "text-muted-foreground group-hover:text-accent/70"
                  }`} />
                </div>
                <p className="font-semibold text-sm">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSkipToDemos}
          className="group rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-accent/5 hover:text-foreground transition-all duration-200 flex items-center gap-2"
        >
          <Rocket className="h-4 w-4" />
          Skip to Demos
        </button>
        <button
          onClick={handleNext}
          disabled={!selectedPreset}
          className="group flex-1 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
