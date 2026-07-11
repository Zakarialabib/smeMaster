import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";

function CalDavSettingsInline({ account, onSaved }: { account: import("@features/accounts/db/accounts").DbAccount; onSaved: () => void }) {
  const { t } = useTranslation();
  const [CalDav, setCalDav] = useState<typeof import("@features/calendar/components/settings/CalDavSettings").CalDavSettings | null>(null);

  useEffect(() => {
    import("@features/calendar/components/settings/CalDavSettings").then((m) => setCalDav(() => m.CalDavSettings));
  }, []);

  if (!CalDav) return <div className="text-xs text-text-tertiary">{t('common.loading')}</div>;

  return <CalDav account={account} onSaved={onSaved} />;
}

export default function ImapCalDavSection() {
  const { t } = useTranslation();
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [account, setAccount] = useState<import("@features/accounts/db/accounts").DbAccount | null>(null);

  useEffect(() => {
    if (!activeAccountId) return;
    import("@features/accounts/db/accounts").then(({ getAccount }) => {
      getAccount(activeAccountId).then(setAccount);
    });
  }, [activeAccountId]);

  const activeUiAccount = accounts.find((a) => a.id === activeAccountId);
  const isImap = activeUiAccount?.provider === "imap";

  if (!isImap || !account) return null;

  return (
    <SettingGroup title={t('settings.calendarCaldav')}>
      <CalDavSettingsInline account={account} onSaved={() => {
        import("@features/accounts/db/accounts").then(({ getAccount }) => {
          getAccount(account.id).then(setAccount);
        });
      }} />
    </SettingGroup>
  );
}
