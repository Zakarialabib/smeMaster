// src/features/onboarding/steps/CompletionStep.tsx
import { CheckCircle2, Inbox, Mail, Zap, ArrowLeft, Crown, Shield, Brain } from "lucide-react";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import type { OnboardingData } from "../types";

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
  { icon: Inbox, text: "Smart inbox with priority sorting and automated folders" },
  { icon: Brain, text: "AI writing assistant for composing and replying" },
  { icon: Zap, text: "Campaign analytics with open/click tracking" },
  { icon: Shield, text: "GDPR/CCPA compliance tools and data protection" },
  { icon: Crown, text: "Priority support with dedicated onboarding" },
];

export function CompletionStep({ data, onComplete, onBack }: CompletionStepProps) {
  const enabledTools = Object.entries(data.tools)
    .filter(([, v]) => v)
    .map(([k]) => toolLabels[k] || k);

  const hasEmail = data.emailConnected;
  const isSkippedDemo = data.demoPreset === "skip";

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
      style={{ animation: "fadeIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="text-center space-y-3">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20 mb-4"
          style={{ animation: "scalePop 500ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both" }}
        >
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">You're All Set!</h1>
        <p className="text-muted-foreground text-lg">
          Your workspace is ready for <span className="font-semibold text-foreground">{data.businessName}</span>
        </p>
      </div>

      {/* Summary card */}
      <GlassPanel variant="card" className="p-5 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</p>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg p-2 bg-accent/10">
            <Zap className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="font-medium">{data.businessName}</p>
            <p className="text-xs text-muted-foreground/70">
              {data.theme === "light" ? "Light" : data.theme === "dark" ? "Dark" : "System"} theme
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
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              hasEmail
                ? "border-green-500/20 bg-green-500/5 text-green-500"
                : "border-muted-foreground/20 bg-muted/5 text-muted-foreground"
            }`}
          >
            <Mail className="h-3 w-3" />
            {hasEmail ? "Email connected" : "Email not connected"}
          </span>
        </div>
      </GlassPanel>

      {/* Pro Benefits */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
            Pro Benefits
          </p>
        </div>
        <p className="text-sm text-muted-foreground -mt-1">
          Connect your email to unlock:
        </p>
        <div className="grid gap-2">
          {PRO_BENEFITS.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm p-3.5"
                style={{
                  animation: `slideUp 350ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${(i + 1) * 80}ms`,
                }}
              >
                <div className="rounded-lg p-1.5 bg-amber-500/8 mt-0.5">
                  <Icon className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="group rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back
        </button>
        <button
          onClick={onComplete}
          className="group flex-1 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
        >
          Start Using SMEMaster
          <Zap className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
        </button>
      </div>
    </div>
  );
}
