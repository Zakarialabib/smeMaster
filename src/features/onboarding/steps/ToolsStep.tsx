import { useState, useCallback } from "react";
import { Mail, Users, Send, Calendar, Brain, ArrowRight, ArrowLeft, Check, Crown } from "lucide-react";
import type { ToolSelections } from "../types";
import { useTranslation } from "react-i18next";

interface ToolsStepProps {
  initial: ToolSelections;
  onNext: (tools: ToolSelections) => void;
  onBack: () => void;
}

interface ToolOption {
  key: keyof ToolSelections;
  label: string;
  description: string;
  sub: string;
  icon: typeof Mail;
  pro: boolean;
}

const TOOL_OPTIONS: ToolOption[] = [
  { key: "mail", label: "Mail", description: "Multi-account inbox with smart threading", sub: "Gmail, IMAP, Exchange", icon: Mail, pro: true },
  { key: "crm", label: "CRM", description: "Contact management with engagement scoring", sub: "Tags, segments, pipeline", icon: Users, pro: false },
  { key: "campaigns", label: "Campaigns", description: "Email campaigns with templates and tracking", sub: "Templates, analytics, A/B test", icon: Send, pro: true },
  { key: "calendar", label: "Calendar", description: "Calendar sync and event management", sub: "Sync, invites, scheduling", icon: Calendar, pro: false },
  { key: "ai", label: "AI Features", description: "Smart replies, auto-labeling, task extraction", sub: "Compose, search, extract", icon: Brain, pro: false },
];

export function ToolsStep({ initial, onNext, onBack }: ToolsStepProps) {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ToolSelections>(initial);

  const toggle = useCallback((key: keyof ToolSelections) => {
    setTools((prev) => {
      const count = Object.values(prev).filter(Boolean).length;
      if (prev[key] && count <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  const enabledCount = Object.values(tools).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight">{t("onboarding.featuresTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("onboarding.featuresDesc")}</p>
        <p className="text-[11px] text-muted-foreground/60">
          {t("onboarding.featuresSelected", { count: enabledCount, total: TOOL_OPTIONS.length })}
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3 flex items-center gap-2.5">
        <Crown className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-amber-500">{t("onboarding.proLabel")}</span> {t("onboarding.proBanner")}
        </p>
      </div>

      <div className="grid gap-2.5">
        {TOOL_OPTIONS.map((opt, idx) => {
          const Icon = opt.icon;
          const enabled = tools[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className="group relative w-full text-start"
              style={{
                animation: "slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both",
                animationDelay: `${idx * 40}ms`,
              }}
            >
              <div
                className={[
                  "relative flex items-center gap-4 rounded-xl border p-4 transition-all duration-200",
                  enabled
                    ? "border-accent/60 bg-accent/[0.04]"
                    : "border-border hover:border-accent/30 hover:bg-accent/[0.02]",
                ].join(" ")}
              >
                <div className="relative">
                  <div className={`rounded-lg p-2.5 transition-colors duration-200 ${enabled ? "bg-accent/12" : "bg-muted group-hover:bg-accent/6"}`}>
                    <Icon className={`h-4 w-4 transition-colors duration-200 ${enabled ? "text-accent" : "text-muted-foreground group-hover:text-accent/70"}`} />
                  </div>
                  {opt.pro && (
                    <span className="absolute -top-1.5 -end-1.5 inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
                      {t("onboarding.proLabel")}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t(`onboarding.tools.${opt.key}`)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{t(`onboarding.tools.${opt.key}Desc`)}</p>
                </div>

                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all duration-200 ${
                  enabled ? "border-accent bg-accent" : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                }`}>
                  {enabled && <Check className="h-2.5 w-2.5 text-accent-foreground" strokeWidth={3} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2.5 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.back")}
        </button>
        <button
          type="button"
          onClick={() => onNext(tools)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200"
        >
          {t("onboarding.continue")} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
