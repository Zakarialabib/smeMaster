// src/features/onboarding/steps/CompletionStep.tsx
import { CheckCircle2, Sparkles, Inbox, Users, Settings, ArrowLeft, Zap } from "lucide-react";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import type { OnboardingData } from "../types";

interface CompletionStepProps {
  data: OnboardingData;
  onComplete: () => void;
  onBack: () => void;
}

const TIPS = [
  { icon: Inbox, text: "Use ` to open the command palette and control everything from your keyboard" },
  { icon: Users, text: "Tag your contacts and set up segments for targeted campaigns" },
  { icon: Settings, text: "Configure auto-labeling rules in Settings to organize emails automatically" },
  { icon: Sparkles, text: "AI features can draft replies, extract tasks, and suggest labels" },
];

const toolLabels: Record<string, string> = {
  mail: "Email",
  crm: "CRM",
  campaigns: "Campaigns",
  calendar: "Calendar",
  ai: "AI Features",
  sync: "Device Sync",
};

export function CompletionStep({ data, onComplete, onBack }: CompletionStepProps) {
  const enabledTools = Object.entries(data.tools)
    .filter(([, v]) => v)
    .map(([k]) => toolLabels[k] || k);

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
              {data.businessType === "solo" ? "Solo Freelancer" :
               data.businessType === "small_team" ? "Small Team" :
               data.businessType === "sales" ? "Sales Focused" : "Custom"} profile
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
        </div>
      </GlassPanel>

      {/* Pro Tips */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pro Tips</p>
        <div className="grid gap-2">
          {TIPS.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm p-3.5"
                style={{
                  animation: `slideUp 350ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${(i + 1) * 80}ms`,
                }}
              >
                <div className="rounded-lg p-1.5 bg-accent/8 mt-0.5">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{tip.text}</p>
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
