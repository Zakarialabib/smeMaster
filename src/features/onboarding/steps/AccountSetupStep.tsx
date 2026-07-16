import { useState } from "react";
import { Mail, Globe, Shield, CheckCircle, ArrowLeft, Sparkles, X } from "lucide-react";
import { GlassPanel } from "@shared/components/ui/glass-panel";
import { AddAccount } from "@features/accounts/components/AddAccount";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
      <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-7 w-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{t("onboarding.connectedTitle")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("onboarding.connectedDesc", { count: accountCount })}
          </p>
        </div>

        <GlassPanel variant="card" className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>{t("onboarding.connectedNote")}</span>
          </div>
        </GlassPanel>

        <div className="flex gap-2.5 pt-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.back")}
          </button>
          <button
            type="button"
            onClick={handleContinueConnected}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-all duration-200"
          >
            {t("onboarding.continue")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold tracking-tight">{t("onboarding.connectTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("onboarding.connectDesc")}</p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("onboarding.providerLabel")}
        </p>
        <div className="grid gap-2">
          {PROVIDER_BUTTONS.map((p, i) => {
            const Icon = p.icon;
            return (
              <button
                key={p.provider}
                type="button"
                onClick={handleConnect}
                className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-background/50 hover:border-accent/30 px-4 py-3 text-start transition-all duration-200 group"
                style={{
                  animation: "slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1) both",
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div className="rounded-lg p-2 bg-muted group-hover:bg-accent/8 transition-colors duration-200">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-accent/70 transition-colors duration-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t(`onboarding.providers.${p.provider}`)}</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{t(`onboarding.providers.${p.provider}Desc`)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {mailSelected && (
        <GlassPanel variant="card" className="p-3 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{t("onboarding.mailReminder")}</p>
        </GlassPanel>
      )}

      <div className="text-center pt-0.5">
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 decoration-muted-foreground/20 hover:decoration-muted-foreground/40 transition-colors duration-200"
        >
          {t("onboarding.skipForNow")}
        </button>
      </div>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-all duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("onboarding.back")}
        </button>
      </div>

      {showAddAccount && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ animation: "fadeIn 200ms ease-out both" }}
        >
          <div className="relative rounded-2xl border border-border bg-card p-6 shadow-2xl w-full max-w-md">
            <button
              type="button"
              onClick={() => setShowAddAccount(false)}
              className="absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
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
