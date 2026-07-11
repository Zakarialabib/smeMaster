// src/features/onboarding/steps/AccountSetupStep.tsx
import { useState } from "react";
import { Mail, Plus, ArrowLeft, ArrowRight, CheckCircle, Globe, Shield } from "lucide-react";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import { AddAccount } from "@features/accounts/components/AddAccount";

interface AccountSetupStepProps {
  onNext: () => void;
  onBack: () => void;
}

const PROVIDERS = [
  { icon: Globe, label: "Gmail / Google Workspace", desc: "OAuth 2.0 with auto-sync" },
  { icon: Shield, label: "Microsoft Exchange / Outlook", desc: "OAuth or app password" },
  { icon: Mail, label: "IMAP / SMTP", desc: "Manual configuration" },
];

export function AccountSetupStep({ onNext, onBack }: AccountSetupStepProps) {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountCount, setAccountCount] = useState(0);

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-2xl mx-auto"
      style={{ animation: "fadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Connect Your Email</h2>
        <p className="text-muted-foreground">Add your first email account to get started</p>
      </div>

      {/* Main card */}
      <GlassPanel variant="card" className="p-6 md:p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-5 shadow-[0_0_20px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]">
          {accountCount > 0 ? (
            <CheckCircle className="h-8 w-8 text-accent" />
          ) : (
            <Mail className="h-8 w-8 text-accent" />
          )}
        </div>

        <p className="font-semibold text-lg">
          {accountCount > 0
            ? `${accountCount} account${accountCount > 1 ? "s" : ""} configured`
            : "No accounts yet"}
        </p>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Connect Gmail, IMAP, or Microsoft Exchange
        </p>

        {/* Provider info cards */}
        <div className="grid gap-2 mb-6 text-left max-w-sm mx-auto">
          {PROVIDERS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3.5 py-2.5"
                style={{
                  animation: `slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both`,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="rounded-md p-1.5 bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground/60">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowAddAccount(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </GlassPanel>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="group rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back
        </button>
        <button
          onClick={onNext}
          className="group flex-1 rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground hover:border-accent/30 hover:text-foreground hover:bg-accent/5 transition-all duration-200 flex items-center justify-center gap-2"
        >
          Skip for now
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
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
              ✕
            </button>
            <AddAccount
              onSuccess={() => {
                setAccountCount((c) => c + 1);
                setShowAddAccount(false);
              }}
              onClose={() => setShowAddAccount(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
