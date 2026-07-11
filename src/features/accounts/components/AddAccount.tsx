import { useState, useReducer, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Calendar, ShieldCheck, CheckCircle2, Settings, Plug, Loader2, ArrowLeft, Search } from "lucide-react";
import { AccountImportScanner, type DiscoveredAccount } from "./AccountImportScanner";
import { startOAuthFlow } from "@features/mail/services/gmail/auth";
import { startMicrosoftOAuthFlow } from "@features/mail/services/microsoft/auth";
import { insertAccount, insertMicrosoftAccount } from "@features/accounts/db/accounts";
import { getClientId, getClientSecret } from "@features/mail/services/gmail/tokenManager";
import { getMicrosoftClientId, getMicrosoftClientSecret } from "@features/mail/services/microsoft/tokenManager";
import { useAccountStore, type Account } from "@features/accounts/stores/accountStore";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { SetupClientId } from "./SetupClientId";
import { AddImapAccount } from "./AddImapAccount";
import { AddCalDavAccount } from "./AddCalDavAccount";
import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import { detectProvider, type ProviderInfo } from "@features/accounts/utils/providerDetection";
import { setQueueSchedule, type QueueSchedulePreset } from "@features/settings/db/settings";
import { invokeCommand } from "@shared/services/db/invoke/command";

interface AddAccountProps {
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "select-provider" | "gmail-method" | "gmail-fast-sync" | "gmail-easy" | "microsoft-fast-sync" | "imap" | "caldav" | "import-scanner" | "sync-schedule" | "done";

type AccountSetupState = {
  step: Step;
  status: "idle" | "checking" | "authenticating" | "saving" | "syncing" | "error";
  error: string | null;
};

type Action =
  | { type: "GO_TO"; step: Step }
  | { type: "SET_STATUS"; status: AccountSetupState["status"] }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

function reducer(state: AccountSetupState, action: Action): AccountSetupState {
  switch (action.type) {
    case "GO_TO":
      return { step: action.step, status: "idle", error: null };
    case "SET_STATUS":
      return { ...state, status: action.status, error: action.status === "error" ? state.error : null };
    case "SET_ERROR":
      return { ...state, status: "error", error: action.error };
    case "RESET":
      return { step: "select-provider", status: "idle", error: null };
  }
}

const ONBOARDING_STEPS = [
  { step: 1, label: "Setup", icon: Settings },
  { step: 2, label: "Connect", icon: Plug },
  { step: 3, label: "Verify", icon: ShieldCheck },
  { step: 4, label: "Sync", icon: Calendar },
  { step: 5, label: "Done", icon: CheckCircle2 },
];

function OnboardingStepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {ONBOARDING_STEPS.map((s, i) => {
        const isActive = s.step === currentStep;
        const isCompleted = s.step < currentStep;
        const Icon = s.icon;
        return (
          <div key={s.step} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`w-8 h-px transition-colors duration-300 ${isCompleted ? "bg-accent" : "bg-border-primary"}`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-300 ${
                isActive
                  ? "bg-accent/10 text-accent ring-1 ring-accent/30"
                  : isCompleted
                    ? "text-accent"
                    : "text-text-tertiary"
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Icon className="w-3.5 h-3.5" />
              )}
              <span>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AddAccount({ onClose, onSuccess }: AddAccountProps) {
  const { t } = useTranslation();
  const [{ step, status, error }, dispatch] = useReducer(reducer, {
    step: "select-provider",
    status: "idle",
    error: null,
  });
  const [needsSetup, setNeedsSetup] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [detectedProvider, setDetectedProvider] = useState<ProviderInfo | null>(null);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const addAccount = useAccountStore((s) => s.addAccount);
  const accounts = useAccountStore((s) => s.accounts);
  const abortRef = useRef<AbortController | null>(null);
  const [syncSchedule, setSyncSchedule] = useState<QueueSchedulePreset>("normal");
  const [syncingNow, setSyncingNow] = useState(false);
  const [discoveredAccount, setDiscoveredAccount] = useState<DiscoveredAccount | null>(null);

  const handleImportFromScanner = useCallback(
    (account: DiscoveredAccount) => {
      setDiscoveredAccount(account);
      dispatch({ type: "GO_TO", step: "imap" });
    },
    [],
  );

  const abortOAuth = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailInput(value);

    // Detect provider when email looks complete (contains @ and domain)
    if (value.includes("@") && value.split("@")[1]?.trim()) {
      setDetectedProvider(detectProvider(value));
    } else {
      setDetectedProvider(null);
    }
  };

  const onboardingStep = (() => {
    switch (step) {
      case "select-provider":
      case "gmail-method":
        return 1;
      case "gmail-easy":
      case "imap":
      case "caldav":
      case "import-scanner":
        return 2;
      case "gmail-fast-sync":
      case "microsoft-fast-sync":
        return status === "idle" || status === "checking" ? 2 : status === "authenticating" ? 3 : 4;
      case "sync-schedule":
        return 4;
      case "done":
        return 5;
    }
  })();

  const handleAddGmailAccount = async () => {
    const ac = new AbortController();
    abortRef.current = ac;

    dispatch({ type: "SET_STATUS", status: "checking" });

    try {
      const clientId = await getClientId();
      const clientSecret = await getClientSecret();

      if (ac.signal.aborted) return;

      dispatch({ type: "SET_STATUS", status: "authenticating" });

      const { tokens, userInfo } = await startOAuthFlow(clientId, clientSecret);

      if (ac.signal.aborted) return;

      const accountId = crypto.randomUUID();
      const expiresAt = getCurrentUnixTimestamp() + tokens.expires_in;

      const account = await insertAccount({
        id: accountId,
        email: userInfo.email,
        displayName: userInfo.name,
        avatarUrl: userInfo.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        tokenExpiresAt: expiresAt,
      });

      if (ac.signal.aborted) return;

const acc1: Account = {
          id: account.id,
          email: account.email,
          displayName: account.display_name,
          company: null,
          avatarUrl: account.avatar_url ?? userInfo.picture ?? null,
          isActive: true,
          provider: account.provider,
        };
addAccount(acc1);

abortRef.current = null;
        dispatch({ type: "GO_TO", step: "sync-schedule" });
      } catch (err) {
       if (ac.signal.aborted) {
         abortRef.current = null;
         return;
       }
       abortRef.current = null;
       console.error("Add account error:", err);
       const message =
         err instanceof Error ? err.message : String(err);
       if (message.includes("Client ID not configured")) {
         setNeedsSetup(true);
       } else {
         dispatch({ type: "SET_ERROR", error: message });
       }
     }
   };

   const handleAddMicrosoftAccount = async () => {
     const ac = new AbortController();
     abortRef.current = ac;

     dispatch({ type: "SET_STATUS", status: "checking" });

     try {
       const clientId = await getMicrosoftClientId();
       const clientSecret = await getMicrosoftClientSecret();

       if (ac.signal.aborted) return;

       dispatch({ type: "SET_STATUS", status: "authenticating" });

       const { tokens, userInfo } = await startMicrosoftOAuthFlow(clientId, clientSecret);

       if (ac.signal.aborted) return;

       const accountId = crypto.randomUUID();
       const expiresAt = getCurrentUnixTimestamp() + tokens.expires_in;

       const account = await insertMicrosoftAccount({
         id: accountId,
         email: userInfo.email,
         displayName: userInfo.name,
         avatarUrl: userInfo.picture,
         accessToken: tokens.access_token,
         refreshToken: tokens.refresh_token ?? "",
         tokenExpiresAt: expiresAt,
       });

       if (ac.signal.aborted) return;

const acc2: Account = {
           id: account.id,
           email: account.email,
           displayName: account.display_name,
           company: null,
           avatarUrl: account.avatar_url ?? userInfo.picture ?? null,
           isActive: true,
           provider: account.provider,
         };
addAccount(acc2);

        abortRef.current = null;
       dispatch({ type: "GO_TO", step: "sync-schedule" });
     } catch (err) {
       if (ac.signal.aborted) {
         abortRef.current = null;
         return;
       }
       abortRef.current = null;
       console.error("Add Microsoft account error:", err);
       const message =
         err instanceof Error ? err.message : String(err);
       if (message.includes("Client ID not configured")) {
         setNeedsSetup(true);
       } else {
         dispatch({ type: "SET_ERROR", error: message });
       }
     }
   };

   if (needsSetup) {
    return (
      <SetupClientId
        onComplete={() => {
          setNeedsSetup(false);
          dispatch({ type: "SET_STATUS", status: "idle" });
        }}
        onCancel={onClose}
      />
    );
  }

  if (step === "caldav") {
    return (
      <AddCalDavAccount
        onClose={onClose}
        onSuccess={() => dispatch({ type: "GO_TO", step: "sync-schedule" })}
        onBack={() => dispatch({ type: "GO_TO", step: "select-provider" })}
      />
    );
  }

  if (step === "import-scanner") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Add Account" size="xl">
        <div className="p-5">
          <AccountImportScanner
            onSelectAccount={handleImportFromScanner}
            onClose={() => dispatch({ type: "GO_TO", step: "select-provider" })}
          />
        </div>
      </Modal>
    );
  }

  if (step === "imap") {
    const imapPrefill = discoveredAccount?.imap_host
      ? {
          imapHost: discoveredAccount.imap_host,
          imapPort: discoveredAccount.imap_port ?? 993,
          imapSecurity: (discoveredAccount.imap_security?.toLowerCase() ?? "ssl") as "ssl" | "starttls" | "none",
          smtpHost: discoveredAccount.smtp_host ?? "",
          smtpPort: discoveredAccount.smtp_port ?? 465,
          smtpSecurity: (discoveredAccount.smtp_security?.toLowerCase() ?? "ssl") as "ssl" | "starttls" | "none",
        }
      : undefined;
    return (
      <AddImapAccount
        onClose={onClose}
        onSuccess={() => {
          setDiscoveredAccount(null);
          dispatch({ type: "GO_TO", step: "sync-schedule" });
        }}
        onBack={() => {
          setDiscoveredAccount(null);
          dispatch({ type: "GO_TO", step: "select-provider" });
        }}
        prefill={imapPrefill}
      />
    );
  }

  if (step === "gmail-easy") {
    return (
      <AddImapAccount
        onClose={onClose}
        onSuccess={onSuccess}
        onBack={() => dispatch({ type: "GO_TO", step: "select-provider" })}
        prefill={{
          imapHost: "imap.gmail.com",
          imapPort: 993,
          imapSecurity: "ssl",
          smtpHost: "smtp.gmail.com",
          smtpPort: 465,
          smtpSecurity: "ssl",
        }}
      />
    );
  }

  if (step === "done") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Add Account" size="xl">
        <div className="p-5">
          <OnboardingStepIndicator currentStep={onboardingStep} />
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-success/20">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1.5">
              {t("addAccount.connected") || "Account Connected!"}
            </h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {t("addAccount.connectedDesc") || "Your account has been connected. SMEMaster will now sync your emails."}
            </p>
            <Button variant="primary" size="md" onClick={onClose}>
              {t("addAccount.done") || "Done"}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "sync-schedule") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Sync Settings" size="md">
        <div className="p-5">
          <OnboardingStepIndicator currentStep={onboardingStep} />
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Calendar size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">Sync Schedule</h3>
                <p className="text-xs text-text-tertiary">
                  Choose how often to check for new emails
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { value: "fast", label: "Fast (every 10s)", desc: "Quick updates, more battery usage" },
                { value: "normal", label: "Normal (every 30s)", desc: "Balanced performance" },
                { value: "gentle", label: "Gentle (every 2min)", desc: "Battery friendly" },
                { value: "business-hours", label: "Business Hours", desc: "Only sync 9am-5pm weekdays" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSyncSchedule(option.value as QueueSchedulePreset)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    syncSchedule === option.value
                      ? "border-accent bg-accent/5"
                      : "border-border-primary bg-bg-secondary hover:bg-bg-hover"
                  }`}
                >
                  <div className="text-sm font-medium text-text-primary">{option.label}</div>
                  <div className="text-xs text-text-tertiary">{option.desc}</div>
                </button>
              ))}
            </div>

            <div className="pt-4 space-y-3">
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  await setQueueSchedule({ preset: syncSchedule, intervalMs: 30000 });
                  const latestAccount = accounts[accounts.length - 1];
                  if (latestAccount) {
                    setSyncingNow(true);
                    try {
                      await invokeCommand("sync_protocol_full", { account_id: latestAccount.id });
                    } catch (e) {
                      console.warn("Initial sync failed:", e);
                    }
                    setSyncingNow(false);
                  }
                  dispatch({ type: "GO_TO", step: "done" });
                }}
                disabled={syncingNow}
                loading={syncingNow}
              >
                {syncingNow ? "Syncing..." : "Save & Sync Now"}
              </Button>
              
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  onSuccess();
                }}
              >
                Save & Sync Later
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "gmail-method") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Add Gmail Account" size="xl">
        <div className="p-5">
          <OnboardingStepIndicator currentStep={onboardingStep} />
          <p className="text-text-secondary text-sm mb-3">
            {t("addAccount.chooseMethod")}
          </p>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => dispatch({ type: "GO_TO", step: "gmail-easy" })}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border-primary bg-bg-secondary hover:bg-bg-hover transition-colors text-left group hover-lift"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  {t("addAccount.easySetup")}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {t("addAccount.easySetupDesc")}
                </div>
              </div>
            </button>

            <button
              onClick={() => dispatch({ type: "GO_TO", step: "gmail-fast-sync" })}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border-primary bg-bg-secondary hover:bg-bg-hover transition-colors text-left group hover-lift"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  {t("addAccount.fastSync")}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {t("addAccount.fastSyncDesc")}
                </div>
              </div>
            </button>
          </div>

          <div className="flex gap-3 justify-between">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => dispatch({ type: "GO_TO", step: "select-provider" })}
            >
              Back
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === "gmail-fast-sync") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Add Gmail Account" size="xl">
        <div className="p-5">
          <OnboardingStepIndicator currentStep={onboardingStep} />
          {status === "idle" || status === "checking" ? (
            <>
              <p className="text-text-secondary text-sm mb-6">
                Sign in with your Google account to connect it to SMEMaster.
              </p>

              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-3 justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeft size={14} />}
                  onClick={() => {
                    abortOAuth();
                    dispatch({ type: "GO_TO", step: "gmail-method" });
                  }}
                >
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleAddGmailAccount}
                    disabled={status === "checking"}
                    icon={status === "checking" ? <Loader2 className="animate-spin" size={14} /> : undefined}
                  >
                    {status === "checking" ? "Checking..." : "Sign in with Google"}
                  </Button>
                </div>
              </div>
            </>
          ) : status === "authenticating" ? (
            <div>
              <div className="text-center py-8">
                <div className="mb-4 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
                <p className="text-text-secondary text-sm mb-2">
                  Waiting for Google sign-in...
                </p>
                <p className="text-xs text-text-tertiary">
                  Complete the sign-in in your browser, then return here.
                </p>
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="flex justify-center mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    abortOAuth();
                    dispatch({ type: "GO_TO", step: "gmail-method" });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    );
  }

  if (step === "microsoft-fast-sync") {
    return (
      <Modal isOpen={true} onClose={onClose} title="Add Microsoft Account" size="xl">
        <div className="p-5">
          <OnboardingStepIndicator currentStep={onboardingStep} />
          {status === "idle" || status === "checking" ? (
            <>
              <p className="text-text-secondary text-sm mb-6">
                Sign in with your Microsoft account to connect it to SMEMaster.
              </p>

              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="flex gap-3 justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeft size={14} />}
                  onClick={() => {
                    abortOAuth();
                    dispatch({ type: "GO_TO", step: "select-provider" });
                  }}
                >
                  Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleAddMicrosoftAccount}
                    disabled={status === "checking"}
                    icon={status === "checking" ? <Loader2 className="animate-spin" size={14} /> : undefined}
                  >
                    {status === "checking" ? "Checking..." : "Sign in with Microsoft"}
                  </Button>
                </div>
              </div>
            </>
          ) : status === "authenticating" ? (
            <div>
              <div className="text-center py-8">
                <div className="mb-4 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
                <p className="text-text-secondary text-sm mb-2">
                  Waiting for Microsoft sign-in...
                </p>
                <p className="text-xs text-text-tertiary">
                  Complete the sign-in in your browser, then return here.
                </p>
              </div>

              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="flex justify-center mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    abortOAuth();
                    dispatch({ type: "GO_TO", step: "select-provider" });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    );
  }

  // Provider selection view

  const isDetected = detectedProvider !== null && emailInput.includes("@");

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Account" size="xl">
      <div className="p-5">
        <OnboardingStepIndicator currentStep={onboardingStep} />
        <p className="text-text-secondary text-sm mb-4">
          {t("addAccount.chooseProvider") || "Enter your email to get started, or choose a provider below."}
        </p>

        {/* Email input with provider detection */}
        <div className="mb-5">
          <label htmlFor="detect-email" className="block text-xs font-medium text-text-secondary mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <input
              id="detect-email"
              type="email"
              value={emailInput}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 pr-12 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors"
              autoFocus
              autoComplete="email"
            />
            {isDetected && detectedProvider && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold leading-none ${detectedProvider.color} ${detectedProvider.textColor}`}
                  aria-label={`Detected provider: ${detectedProvider.label}`}
                  title={detectedProvider.label}
                >
                  {detectedProvider.letter}
                </span>
              </div>
            )}
          </div>
          {isDetected && detectedProvider && (
            <p className="text-xs text-text-tertiary mt-1.5 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[7px] font-bold leading-none ${detectedProvider.color} ${detectedProvider.textColor}`}
                aria-hidden="true"
              >
                {detectedProvider.letter}
              </span>
              Detected: {detectedProvider.label}
              {detectedProvider.type === "gmail_api" && (
                <span className="text-success ml-1">Recommended</span>
              )}
              {detectedProvider.type === "microsoft_graph" && (
                <span className="text-success ml-1">Recommended</span>
              )}
            </p>
          )}
        </div>

        {/* Provider options — dynamic based on detection */}
        <div className="space-y-3">
          {/* Educational tip for first-time users */}
          <div className="p-3 bg-info/10 border border-info/20 rounded-lg text-xs text-text-secondary mb-2">
            💡 Tip: Enter your email above to auto-detect your provider. IMAP/SMTP works with any email service.
          </div>

          {/* Always show Gmail option */}
          <button
            onClick={() => dispatch({ type: "GO_TO", step: "gmail-method" })}
            className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left group hover-lift ${
              detectedProvider?.type === "gmail_api"
                ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                : "border-border-primary bg-bg-secondary hover:bg-bg-hover"
            }`}
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  {detectedProvider?.type === "gmail_api" ? "Gmail (Recommended)" : "Google (Gmail)"}
                </span>
                {detectedProvider?.type === "gmail_api" && (
                  <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                    Best match
                  </span>
                )}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {detectedProvider?.type === "gmail_api"
                  ? "Connect via OAuth — fastest sync, full Gmail API support"
                  : "Connect via OAuth with full Gmail API support"}
              </div>
            </div>
          </button>

          {/* IMAP/SMTP option — always shown but highlighted for imap/jmap */}
          <button
            onClick={() => dispatch({ type: "GO_TO", step: "imap" })}
            className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left group hover-lift ${
              detectedProvider?.type === "imap" || detectedProvider?.type === "jmap"
                ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                : "border-border-primary bg-bg-secondary hover:bg-bg-hover"
            }`}
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <Mail className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  {detectedProvider?.type === "imap" || detectedProvider?.type === "jmap"
                    ? "IMAP/SMTP (Recommended)"
                    : "IMAP / SMTP"}
                </span>
                {(detectedProvider?.type === "imap" || detectedProvider?.type === "jmap") && (
                  <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                    {detectedProvider?.type === "jmap" ? "JMAP available" : "Best match"}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {detectedProvider?.type === "imap"
                  ? "Connect any email provider with manual server configuration"
                  : detectedProvider?.type === "jmap"
                    ? "Connect via JMAP — modern protocol for Yahoo, FastMail & more"
                    : "Connect any email provider with manual server configuration"}
              </div>
            </div>
          </button>

          {/* Microsoft Graph option — only shown when detected or when showing all */}
          {(detectedProvider?.type === "microsoft_graph" || showAllProviders) && (
            <button
              onClick={() => {
                dispatch({ type: "GO_TO", step: "microsoft-fast-sync" });
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left group hover-lift ${
                detectedProvider?.type === "microsoft_graph"
                  ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                  : "border-border-primary bg-bg-secondary hover:bg-bg-hover"
              }`}
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="9" height="9" rx="1" fill="#F25022" />
                  <rect x="13" y="2" width="9" height="9" rx="1" fill="#7FBA00" />
                  <rect x="2" y="13" width="9" height="9" rx="1" fill="#00A4EF" />
                  <rect x="13" y="13" width="9" height="9" rx="1" fill="#FFB900" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                    {detectedProvider?.type === "microsoft_graph"
                      ? "Microsoft (Recommended)"
                      : "Microsoft (Outlook/Hotmail)"}
                  </span>
                  {detectedProvider?.type === "microsoft_graph" && (
                    <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                      Best match
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {detectedProvider?.type === "microsoft_graph"
                    ? "Connect via OAuth — fastest sync with Microsoft Graph API"
                    : "Connect Outlook, Hotmail or Live accounts"}
                </div>
              </div>
            </button>
          )}

          {/* CalDAV option — always shown */}
          <button
            onClick={() => dispatch({ type: "GO_TO", step: "caldav" })}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border-primary bg-bg-secondary hover:bg-bg-hover transition-colors text-left group hover-lift"
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <Calendar className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                  CalDAV (Calendar Only)
                </span>
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                Connect iCloud, Fastmail, Nextcloud, or any CalDAV calendar server
              </div>
            </div>
          </button>

          {/* Import from System option — discover Thunderbird, Apple Mail, Outlook, etc. */}
          <button
            onClick={() => dispatch({ type: "GO_TO", step: "import-scanner" })}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border-primary bg-bg-secondary hover:bg-bg-hover transition-colors text-left group hover-lift"
          >
            <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <Search className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
                Import from System
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                Discover accounts from Thunderbird, Apple Mail, Outlook, or Evolution
              </div>
            </div>
          </button>
        </div>

        {/* Show all providers toggle */}
        {!showAllProviders && isDetected && (
          <button
            onClick={() => setShowAllProviders(true)}
            className="mt-3 w-full text-xs text-text-tertiary hover:text-text-secondary transition-colors text-center py-1.5"
          >
            Show all connection options
          </button>
        )}

        <div className="flex justify-end mt-6">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

