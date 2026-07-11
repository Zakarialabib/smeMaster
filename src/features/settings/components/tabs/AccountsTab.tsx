import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Plus } from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { notify } from "@shared/services/notifications/toastHelper";
import { getSetting, setSetting, getSecureSetting, setSecureSetting } from "@features/settings/db/settings";
import { deleteAccount } from "@features/accounts/db/accounts";
import { removeClient, reauthorizeAccount } from "@features/mail/services/gmail/tokenManager";
import { triggerSync, forceFullSync, resyncAccount } from "@features/mail/services/gmail/syncManager";
import { AddAccount } from "@features/accounts/components/AddAccount";
import { TextField } from "@shared/components/ui/TextField";
import { Button } from "@shared/components/ui/Button";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup, SettingRow, ButtonGroup } from "@features/settings/components/SettingsHelpers";
import SendAsAliasesSection from "../SendAsAliasesSection";
import SyncOfflineSection from "../SyncOfflineSection";
import ImapCalDavSection from "@features/calendar/components/settings/ImapCalDavSection";

export default function AccountsTab() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const removeAccountFromStore = useAccountStore((s) => s.removeAccount);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [microsoftClientId, setMicrosoftClientId] = useState("");
  const [microsoftClientSecret, setMicrosoftClientSecret] = useState("");
  const [apiSettingsSaved, setApiSettingsSaved] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncPeriodDays, setSyncPeriodDays] = useState("365");
  const [reauthStatus, setReauthStatus] = useState<Record<string, "idle" | "authorizing" | "done" | "error">>({});
  const [resyncStatus, setResyncStatus] = useState<Record<string, "idle" | "syncing" | "done" | "error">>({});
  const [showAddAccount, setShowAddAccount] = useState(false);

  useEffect(() => {
    async function load() {
      const id = await getSetting("google_client_id");
      setClientId(id ?? "");
      const secret = await getSecureSetting("google_client_secret");
      setClientSecret(secret ?? "");
      const msId = await getSetting("microsoft_client_id");
      setMicrosoftClientId(msId ?? "");
      const msSecret = await getSecureSetting("microsoft_client_secret");
      setMicrosoftClientSecret(msSecret ?? "");
      const syncDays = await getSetting("sync_period_days");
      setSyncPeriodDays(syncDays ?? "365");
    }
    load();
  }, []);

  const handleSaveApiSettings = useCallback(async () => {
    const trimmedId = clientId.trim();
    if (trimmedId) {
      await setSetting("google_client_id", trimmedId);
    }
    const trimmedSecret = clientSecret.trim();
    if (trimmedSecret) {
      await setSecureSetting("google_client_secret", trimmedSecret);
    }
    const trimmedMsId = microsoftClientId.trim();
    if (trimmedMsId) {
      await setSetting("microsoft_client_id", trimmedMsId);
    }
    const trimmedMsSecret = microsoftClientSecret.trim();
    if (trimmedMsSecret) {
      await setSecureSetting("microsoft_client_secret", trimmedMsSecret);
    }
    setApiSettingsSaved(true);
    notify("Accounts", "API settings saved successfully.");
    setTimeout(() => setApiSettingsSaved(false), 2000);
  }, [clientId, clientSecret, microsoftClientId, microsoftClientSecret]);

  const handleManualSync = useCallback(async () => {
    const activeIds = accounts.filter((a) => a.isActive).map((a) => a.id);
    if (activeIds.length === 0) return;
    setIsSyncing(true);
    try {
      await triggerSync(activeIds);
      notify("Accounts", "Manual sync completed.");
    } finally {
      setIsSyncing(false);
    }
  }, [accounts]);

  const handleForceFullSync = useCallback(async () => {
    const activeIds = accounts.filter((a) => a.isActive).map((a) => a.id);
    if (activeIds.length === 0) return;
    setIsSyncing(true);
    try {
      await forceFullSync(activeIds);
      notify("Accounts", "Full resync completed.");
    } finally {
      setIsSyncing(false);
    }
  }, [accounts]);

  const handleRemoveAccount = useCallback(
    async (accountId: string) => {
      removeClient(accountId);
      await deleteAccount(accountId);
      removeAccountFromStore(accountId);
      notify("Accounts", "Account removed successfully.");
    },
    [removeAccountFromStore],
  );

  const handleReauthorizeAccount = useCallback(
    async (accountId: string, email: string) => {
      setReauthStatus((prev) => ({ ...prev, [accountId]: "authorizing" }));
      try {
        await reauthorizeAccount(accountId, email);
        setReauthStatus((prev) => ({ ...prev, [accountId]: "done" }));
        notify("Accounts", "Re-authorized.");
        setTimeout(() => {
          setReauthStatus((prev) => ({ ...prev, [accountId]: "idle" }));
        }, 3000);
      } catch (err) {
        console.error("Re-authorization failed:", err);
        setReauthStatus((prev) => ({ ...prev, [accountId]: "error" }));
        setTimeout(() => {
          setReauthStatus((prev) => ({ ...prev, [accountId]: "idle" }));
        }, 3000);
      }
    },
    [],
  );

  const handleResyncAccount = useCallback(
    async (accountId: string) => {
      setResyncStatus((prev) => ({ ...prev, [accountId]: "syncing" }));
      try {
        await resyncAccount(accountId);
        setResyncStatus((prev) => ({ ...prev, [accountId]: "done" }));
        notify("Accounts", "Account resynced successfully.");
        setTimeout(() => {
          setResyncStatus((prev) => ({ ...prev, [accountId]: "idle" }));
        }, 3000);
      } catch (err) {
        console.error("Resync failed:", err);
        setResyncStatus((prev) => ({ ...prev, [accountId]: "error" }));
        setTimeout(() => {
          setResyncStatus((prev) => ({ ...prev, [accountId]: "idle" }));
        }, 3000);
      }
    },
    [],
  );

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-text-primary leading-snug">
          {t('settings.mailAccounts')}
        </h2>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => setShowAddAccount(true)}
        >
          {t('settings.addMailAccount')}
        </Button>
      </div>
      {accounts.filter((a) => a.provider !== "caldav").length === 0 ? (
        <div className="text-sm text-text-tertiary py-6 text-center bg-bg-secondary rounded-lg">
          {t('settings.noAccountsConnected')}
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.filter((a) => a.provider !== "caldav").map((account) => {
            const providerLabel = account.provider === "imap" ? t('settings.imap') : account.provider === "local" ? "Demo" : t('settings.gmail');
            return (
              <div
                key={account.id}
                className="flex items-center justify-between py-2.5 px-4 bg-bg-secondary rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                    {account.displayName ?? account.email}
                    <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary">
                      {providerLabel}
                    </span>
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {account.email}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleReauthorizeAccount(account.id, account.email)}
                    disabled={reauthStatus[account.id] === "authorizing"}
                    className="text-accent hover:text-accent-hover"
                  >
                    {reauthStatus[account.id] === "authorizing" && t('settings.waiting')}
                    {reauthStatus[account.id] === "done" && t('settings.done')}
                    {reauthStatus[account.id] === "error" && t('settings.failed')}
                    {(!reauthStatus[account.id] || reauthStatus[account.id] === "idle") && t('settings.reauthorize')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleResyncAccount(account.id)}
                    disabled={resyncStatus[account.id] === "syncing"}
                    className="text-accent hover:text-accent-hover"
                  >
                    {resyncStatus[account.id] === "syncing" && t('settings.resyncing')}
                    {resyncStatus[account.id] === "done" && t('settings.done')}
                    {resyncStatus[account.id] === "error" && t('settings.failed')}
                    {(!resyncStatus[account.id] || resyncStatus[account.id] === "idle") && t('settings.resync')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleRemoveAccount(account.id)}
                    className="text-danger hover:text-danger/80"
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {accounts.some((a) => a.provider === "caldav") && (
        <SettingGroup title={t('settings.calendarAccounts')}>
          <div className="space-y-2">
            {accounts.filter((a) => a.provider === "caldav").map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between py-2.5 px-4 bg-bg-secondary rounded-lg"
              >
                <div>
                  <div className="text-sm font-medium text-text-primary flex items-center gap-2">
                    {account.displayName ?? account.email}
                    <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                      {t('settings.caldav')}
                    </span>
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {account.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleRemoveAccount(account.id)}
                  className="text-danger hover:text-danger/80"
                >
                  {t('common.remove')}
                </Button>
              </div>
            ))}
          </div>
        </SettingGroup>
      )}

      <SendAsAliasesSection />

      <ImapCalDavSection />

      <SettingGroup title={t('settings.googleApi')}>
        <div className="space-y-3">
          <TextField
            label={t('settings.clientId')}
            size="md"
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={t('settings.clientIdPlaceholder')}
          />
          <TextField
            label={t('settings.clientSecret')}
            size="md"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={t('settings.clientSecretPlaceholder')}
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveApiSettings}
            disabled={!clientId.trim() && !microsoftClientId.trim()}
          >
            {apiSettingsSaved ? t('common.saved') : t("common.save")}
          </Button>
        </div>
        <HelpCard
          items={[
            { type: "why", text: "Custom API credentials allow SME Master to connect directly to your Google account without third-party rate limits." },
            { type: "how", text: "These credentials are stored securely using the Tauri encrypted storage API and are used for OAuth2 authentication." },
            { type: "when", text: "Required for Gmail/Google Workspace accounts. Obtain credentials from the Google Cloud Console." },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.microsoftApi')}>
        <div className="space-y-3">
          <TextField
            label={t('settings.clientId')}
            size="md"
            type="text"
            value={microsoftClientId}
            onChange={(e) => setMicrosoftClientId(e.target.value)}
            placeholder={t('settings.clientIdPlaceholder')}
          />
          <TextField
            label={t('settings.clientSecret')}
            size="md"
            type="password"
            value={microsoftClientSecret}
            onChange={(e) => setMicrosoftClientSecret(e.target.value)}
            placeholder={t('settings.clientSecretPlaceholder')}
          />
        </div>
        <HelpCard
          items={[
            { type: "why", text: "Custom API credentials allow SME Master to connect directly to your Microsoft/Outlook account via Microsoft Graph API." },
            { type: "how", text: "These credentials are stored securely using the Tauri encrypted storage API and are used for OAuth2 authentication." },
            { type: "when", text: "Required for Outlook/Hotmail/Live accounts. Obtain credentials from the Azure Portal (App Registrations)." },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.sync')}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {t('settings.checkForNewMail')}
          </span>
          <Button
            variant="primary"
            size="md"
            icon={<RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />}
            onClick={handleManualSync}
            disabled={isSyncing || accounts.length === 0}
          >
            {isSyncing ? t('common.syncing') : t('settings.syncNow')}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-text-secondary">
              {t('settings.fullResync')}
            </span>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t('settings.fullResyncDescription')}
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            icon={<RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />}
            onClick={handleForceFullSync}
            disabled={isSyncing || accounts.length === 0}
            className="bg-bg-tertiary text-text-primary border border-border-primary"
          >
            {isSyncing ? t('common.syncing') : t('settings.fullResync')}
          </Button>
        </div>
        <HelpCard
          items={[
            { type: "why", text: "Synchronization keeps your local database up-to-date with the server, ensuring you see the latest emails and folder changes." },
            { type: "how", text: "Sync runs in the background at configured intervals. Full resync re-downloads all email metadata from the server." },
            { type: "when", text: "Use manual sync when you need immediately fresh data. Use full resync if you suspect data corruption or missing messages." },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.syncPeriod')}>
        <SettingRow label={t('settings.syncEmailsFrom')}>
          <ButtonGroup
            value={syncPeriodDays}
            onChange={async (val) => {
              setSyncPeriodDays(val);
              await setSetting("sync_period_days", val);
            }}
            options={[
              { value: "30", label: t('settings.last30Days') },
              { value: "90", label: t('settings.last90Days') },
              { value: "180", label: t('settings.last180Days') },
              { value: "365", label: t('settings.last1Year') },
            ]}
          />
        </SettingRow>
        <p className="text-xs text-text-tertiary">
          {t('settings.syncChangesOnResync')}
        </p>
        <HelpCard
          items={[
            { type: "why", text: "Limiting sync scope reduces local storage usage and speeds up initial synchronization, especially for accounts with years of history." },
            { type: "how", text: "Only emails within the selected period are downloaded. Older emails remain accessible on the server but aren't cached locally." },
            { type: "when", text: "Choose a shorter period for low-storage devices. Use 1 year for full historical search capability." },
          ]}
        />
      </SettingGroup>

      <SyncOfflineSection />

      {showAddAccount && (
        <AddAccount
          onClose={() => setShowAddAccount(false)}
          onSuccess={() => setShowAddAccount(false)}
        />
      )}
    </>
  );
}
