import { CheckCircle2, Inbox, Mail, Zap, ArrowLeft, Crown, Shield, Brain } from "lucide-react";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import type { OnboardingData } from "../types";
import { useTranslation } from "react-i18next";

interface CompletionStepProps {
  data: OnboardingData;
  onComplete: () => void;
  onBack: () => void;
}

const toolLabels: Record<string, string> = {
  mail: "Mail",
  crm: "CRM",
  campaigns: "Campaigns",
  calendar: "Calendar",
  ai: "AI Features",
};

const PRO_BENEFITS = [
  { icon: Inbox, i18n: "inbox" },
  { icon: Brain, i18n: "ai" },
  { icon: Zap, i18n: "campaign" },
  { icon: Shield, i18n: "compliance" },
  { icon: Crown, i18n: "support" },
] as const;

export function CompletionStep({ data, onComplete, onBack }: CompletionStepProps) {
  const { t } = useTranslation();
  const enabledTools = Object.entries(data.tools)
    .filter(([, v]) => v)
    .map(([k]) => toolLabels[k] || k);

  const hasEmail = data.emailConnected;
  const isSkippedDemo = data.demoPreset === "skip";

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20"
          style={{ animation: "scalePop 500ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both" }}
        >
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("onboarding.allSet")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("onboarding.readyDesc")}{" "}
          <span className="font-semibold text-foreground">{data.businessName}</span>
        </p>
      </div>

      <GlassPanel variant="card" className="p-4 space-y-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("onboarding.summaryLabel")}</p>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg p-2 bg-accent/10">
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{data.businessName}</p>
            <p className="text-xs text-muted-foreground/70">
              {t(`onboarding.theme.${data.theme}`)} theme
              {isSkippedDemo ? " · Demo data" : ` · ${(data.demoPreset ?? "custom").replace(/_/g, " ")} profile`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {enabledTools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/5 px-2.5 py-1 text-[11px] font-medium text-accent"
            >
              {tool}
            </span>
          ))}
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              hasEmail
                ? "border-green-500/20 bg-green-500/5 text-green-500"
                : "border-muted-foreground/20 bg-muted/5 text-muted-foreground",
            ].join(" ")}
          >
            <Mail className="h-3 w-3" />
            {hasEmail ? t("onboarding.emailConnected") : t("onboarding.emailNotConnected")}
          </span>
        </div>
      </GlassPanel>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">
            {t("onboarding.proBenefitsTitle")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground -mt-0.5">
          {t("onboarding.proBenefitsHint")}
        </p>
        <div className="grid gap-2">
          {PRO_BENEFITS.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.i18n}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm p-3"
                style={{
                  animation: "slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="rounded-lg p-1.5 bg-amber-500/10 mt-0.5">
                  <Icon className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t(`onboarding.benefits.${benefit.i18n}`)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.back")}
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200"
        >
          {t("onboarding.startUsing")} <Zap className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
