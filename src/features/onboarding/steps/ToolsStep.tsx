// src/features/onboarding/steps/ToolsStep.tsx
import { useState, useCallback } from "react";
import { Mail, Users, Send, Calendar, Brain, ArrowRight, ArrowLeft, Check, Crown } from "lucide-react";
import type { ToolSelections } from "../types";

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
  { key: "mail", label: "Mail", description: "Multi-account inbox with smart threading", sub: "Gmail, IMAP, Exchange · Email setup in next step", icon: Mail, pro: true },
  { key: "crm", label: "CRM", description: "Contact management with engagement scoring", sub: "Tags, segments, pipeline", icon: Users, pro: false },
  { key: "campaigns", label: "Campaigns", description: "Email campaigns with templates and tracking", sub: "Templates, analytics, A/B test", icon: Send, pro: true },
  { key: "calendar", label: "Calendar", description: "Calendar sync and event management", sub: "Sync, invites, scheduling", icon: Calendar, pro: false },
  { key: "ai", label: "AI Features", description: "Smart replies, auto-labeling, task extraction", sub: "Compose, search, extract", icon: Brain, pro: false },
];

export function ToolsStep({ initial, onNext, onBack }: ToolsStepProps) {
  const [tools, setTools] = useState<ToolSelections>(initial);

  const toggle = useCallback((key: keyof ToolSelections) => {
    setTools((prev) => {
      // Prevent disabling the last enabled tool
      const count = Object.values(prev).filter(Boolean).length;
      if (prev[key] && count <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  const enabledCount = Object.values(tools).filter(Boolean).length;

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
      style={{ animation: "fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Choose Your Features</h2>
        <p className="text-muted-foreground">
          Enable the tools you need — you can always change later
        </p>
        <p className="text-xs text-muted-foreground/60">
          {enabledCount} of {TOOL_OPTIONS.length} selected
        </p>
      </div>

      {/* Pro info banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-2.5">
        <Crown className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-amber-500">PRO</span> features marked with a crown — Mail and Campaigns include advanced capabilities
        </p>
      </div>

      {/* Tool Cards */}
      <div className="grid gap-3">
        {TOOL_OPTIONS.map((opt, idx) => {
          const Icon = opt.icon;
          const enabled = tools[opt.key];
          return (
            <button
              key={opt.key}
              onClick={() => toggle(opt.key)}
              className="group relative w-full text-start"
              style={{
                animation: `slideUp 350ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                animationDelay: `${idx * 50}ms`,
              }}
            >
              <div
                className={`relative flex items-center gap-4 rounded-xl border p-4 transition-all duration-300 ${
                  enabled
                    ? "border-accent/60 bg-accent/[0.04] shadow-[0_0_16px_color-mix(in_srgb,var(--color-accent)_8%,transparent)]"
                    : "border-border hover:border-accent/30 hover:bg-accent/[0.02]"
                }`}
              >
                {/* Icon */}
                <div className="relative">
                  <div className={`rounded-lg p-2.5 transition-all duration-300 ${
                    enabled ? "bg-accent/12" : "bg-muted group-hover:bg-accent/6"
                  }`}>
                    <Icon className={`h-5 w-5 transition-colors duration-300 ${
                      enabled ? "text-accent" : "text-muted-foreground group-hover:text-accent/70"
                    }`} />
                  </div>
                  {/* PRO badge */}
                  {opt.pro && (
                    <div className="absolute -top-1.5 -end-1.5 flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 shadow-sm">
                      <Crown className="h-2.5 w-2.5 text-amber-500" />
                      <span className="text-[9px] font-bold text-amber-500 leading-none">PRO</span>
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{opt.description}</p>
                  <p className="text-[11px] text-muted-foreground/40 mt-0.5">{opt.sub}</p>
                </div>

                {/* Checkbox */}
                <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                  enabled
                    ? "border-accent bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
                    : "border-muted-foreground/30 group-hover:border-muted-foreground/50"
                }`}>
                  {enabled && <Check className="h-3 w-3 text-accent-foreground" strokeWidth={3} />}
                </div>

                {/* Bottom accent line on hover */}
                {enabled && (
                  <div className="absolute bottom-0 start-4 end-4 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Action */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="group rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back
        </button>
        <button
          onClick={() => onNext(tools)}
          className="group flex-1 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200 flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
