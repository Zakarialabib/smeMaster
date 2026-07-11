import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { TextField } from "@shared/components/ui/TextField";
import { insertCalDavAccount } from "@features/accounts/db/accounts";
import { useAccountStore, type Account } from "@features/accounts/stores/accountStore";
import { discoverCalDavSettings, testCalDavConnection } from "@features/calendar/services/autoDiscovery";

interface AddCalDavAccountProps {
  onClose: () => void;
  onSuccess: () => void;
  onBack: () => void;
}

type Step = "basic" | "server" | "test" | "done";

export function AddCalDavAccount({ onClose, onSuccess, onBack }: AddCalDavAccountProps) {
  const { t } = useTranslation();
  const addAccount = useAccountStore((s) => s.addAccount);
  const [step, setStep] = useState<Step>("basic");

  // Form state
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [caldavUrl, setCaldavUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [providerName, setProviderName] = useState<string | null>(null);
  const [needsAppPassword, setNeedsAppPassword] = useState(false);

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [calendarCount, setCalendarCount] = useState(0);

  // Creating account
  const [creating, setCreating] = useState(false);

  const handleDiscoverAndNext = useCallback(async () => {
    if (!email.trim()) return;
    setUsername(email);

    const result = await discoverCalDavSettings(email);
    if (result.caldavUrl) {
      setCaldavUrl(result.caldavUrl);
    }
    setProviderName(result.providerName);
    setNeedsAppPassword(result.needsAppPassword);
    setStep("server");
  }, [email]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    const result = await testCalDavConnection(caldavUrl, username, password);
    setTestResult(result);
    setCalendarCount(result.calendarCount ?? 0);
    setTesting(false);
  }, [caldavUrl, username, password]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const account = await insertCalDavAccount({
        email,
        displayName: displayName || null,
        caldavUrl,
        caldavUsername: username,
        caldavPassword: password,
      });

      const acc: Account = {
        id: account.id,
        email: account.email,
        displayName: account.display_name,
        company: null,
        avatarUrl: account.avatar_url,
        isActive: true,
        provider: account.provider,
      };
      addAccount(acc);

      setStep("done");
    } catch (err) {
      console.error("Failed to create CalDAV account:", err);
      setTestResult({ success: false, message: "Failed to save account" });
    } finally {
      setCreating(false);
    }
  }, [email, displayName, caldavUrl, username, password, addAccount]);

  return (
    <Modal isOpen={true} onClose={onClose} title={t('modals.addCalDavAccount.title')} size="md">
      <div className="p-4">
        {step === "basic" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Calendar size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-text-primary">{t('modals.addCalDavAccount.caldavCalendarAccount')}</h3>
                <p className="text-xs text-text-tertiary">
                  {t('modals.addCalDavAccount.connectDescription')}
                </p>
              </div>
            </div>

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoFocus
            />

            <TextField
              label="Display Name (optional)"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Calendar"
            />

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={onBack}
              >
                {t("common.back")}
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight size={16} />}
                onClick={handleDiscoverAndNext}
                disabled={!email.trim()}
              >
                {t("common.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "server" && (
          <div className="space-y-4">
            {providerName && (
              <div className="text-xs text-accent font-medium">
                {t('modals.addCalDavAccount.detected', { provider: providerName })}
              </div>
            )}

            {needsAppPassword && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded text-xs text-text-secondary">
                {t('modals.addCalDavAccount.appPasswordRequired')}
              </div>
            )}

            <TextField
              label={t("account.caldavUrl")}
              type="url"
              value={caldavUrl}
              onChange={(e) => setCaldavUrl(e.target.value)}
              placeholder="https://caldav.example.com/"
            />

            <TextField
              label={t("account.caldavUsername")}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your@email.com"
            />

            <TextField
              label={t("account.caldavPassword")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={needsAppPassword ? "App-specific password" : "Password"}
            />

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={() => setStep("basic")}
              >
                {t("common.back")}
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<ArrowRight size={16} />}
                onClick={() => { setStep("test"); handleTest(); }}
                disabled={!caldavUrl || !password}
              >
                {t("account.testConnection")}
              </Button>
            </div>
          </div>
        )}

        {step === "test" && (
          <div className="space-y-4">
            <div className="text-center py-6">
              {testing && (
                <>
                  <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
                  <p className="text-sm text-text-secondary">{t('modals.addCalDavAccount.testingConnection')}</p>
                </>
              )}

              {!testing && testResult?.success && (
                <>
                  <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary">{testResult.message}</p>
                  {calendarCount > 0 && (
                    <p className="text-xs text-text-tertiary mt-1">
                      {t('modals.addCalDavAccount.foundCalendars', { count: calendarCount })}
                    </p>
                  )}
                </>
              )}

              {!testing && testResult && !testResult.success && (
                <>
                  <XCircle size={32} className="text-danger mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-primary">{t('modals.addCalDavAccount.connectionFailed')}</p>
                  <p className="text-xs text-text-tertiary mt-1">{testResult.message}</p>
                </>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={16} />}
                onClick={() => { setStep("server"); setTestResult(null); }}
              >
                {t("common.back")}
              </Button>

              {testResult?.success ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreate}
                  disabled={creating}
                  loading={creating}
                >
                  {creating ? "Creating..." : t("account.save")}
                </Button>
              ) : !testing ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleTest}
                >
                  {t("account.testConnection")}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
            <p className="text-sm font-medium text-text-primary">CalDAV account added!</p>
            <p className="text-xs text-text-tertiary mt-1">
              Your calendars will sync automatically.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={onSuccess}
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
