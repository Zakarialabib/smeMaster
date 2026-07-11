// src/features/onboarding/steps/AccountSetupStep.tsx
import { useState } from "react";
import { Mail, Globe, Shield, CheckCircle, ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import { AddAccount } from "@features/accounts/components/AddAccount";

interface AccountSetupStepProps {
  onNext: (data: { accountSkipped: boolean; emailConnected: boolean }) => void;
  onBack: () => void;
  mailSelected?: boolean;
}

const PROVIDER_BUTTONS = [
  { icon: Globe, label: "Gmail / Google Workspace", desc: "OAuth 2.0 with auto-sync", provider: "gmail" },
  { icon: Shield, label: "Microsoft Outlook / Office365", desc: "OAuth or app password", provider: "outlook" },
  { icon: Mail, label: "Other (IMAP / SMTP)", desc: "Manual configuration", provider: "imap" },
];

export function AccountSetupStep({ onNext, onBack, mailSelected = false }: AccountSetupStepProps) {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountCount, setAccountCount] = useState(0);

  const handleSkip = () => {
    onNext({ accountSkipped: true, emailConnected: false });
  };

  const handleConnect = () => {
    setShowAddAccount(true);
  };

  const handleAccountSuccess = () => {
    setAccountCount((c) => c + 1);
    setShowAddAccount(false);
  };

  const handleContinueConnected = () => {
    onNext({ accountSkipped: false, emailConnected: true });
  };

  // After connecting, show acknowledgment
  if (accountCount > 0 && !showAddAccount) {
    return (
      <div
        className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
        style={{ animation: "fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20 shadow-[0_0_20px_color-mix(in_srgb,var(--color-green-500)_12%,transparent)]">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Email Connected!</h2>
          <p className="text-muted-foreground">
            {accountCount} account{accountCount > 1 ? "s" : ""} configured successfully
          </p>
        </div>

        <GlassPanel variant="card" className="p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>
              Smart recommendations and mail features are now enabled based on your connected account{accountCount > 1 ? "s" : ""}
            </span>
          </div>
        </GlassPanel>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onBack}
            className="group rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back
          </button>
          <button
            onClick={handleContinueConnected}
            className="group flex-1 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
          >
            Continue
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
      style={{ animation: "fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Connect Your Email</h2>
        <p className="text-muted-foreground">
          Connect email for smart recommendations and mail features
        </p>
      </div>

      {/* Provider buttons */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Choose your provider
        </p>
        <div className="grid gap-2.5">
          {PROVIDER_BUTTONS.map((p, i) => {
            const Icon = p.icon;
            return (
              <button
                key={p.provider}
                onClick={handleConnect}
                className="flex items-center gap-4 rounded-xl border border-border/60 bg-background/50 hover:bg-accent/[0.03] hover:border-accent/30 px-4 py-3.5 text-left transition-all duration-200 group"
                style={{
                  animation: `slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="rounded-lg p-2.5 bg-muted group-hover:bg-accent/8 transition-colors duration-200">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-accent/70 transition-colors duration-200" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{p.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent/60 transition-all duration-200 group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Reminder for mail users */}
      {mailSelected && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            You selected <span className="font-medium text-foreground">Mail</span> as a feature. Connecting an email account unlocks the full inbox experience with smart threading and recommendations.
          </p>
        </div>
      )}

      {/* Skip for now */}
      <div className="text-center pt-1">
        <button
          onClick={handleSkip}
          className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-200 underline underline-offset-2 decoration-muted-foreground/20 hover:decoration-muted-foreground/40"
        >
          Skip for now
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="group rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back
        </button>
      </div>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ animation: "fadeIn 200ms ease-out both" }}
        >
          <div className="relative rounded-2xl border border-border bg-card p-6 shadow-2xl w-full max-w-md">
            <button
              onClick={() => setShowAddAccount(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
            >
              <X className="h-4 w-4" />
            </button>
            <AddAccount
              onSuccess={handleAccountSuccess}
              onClose={() => setShowAddAccount(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
