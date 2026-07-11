import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getAliasesForAccount, setDefaultAlias, mapDbAlias, type SendAsAlias } from "@features/mail/db/sendAsAliases";
import { InlineTooltip } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";

export default function SendAsAliasesSection() {
  const accounts = useAccountStore((s) => s.accounts);
  const [aliases, setAliases] = useState<SendAsAlias[]>([]);

  useEffect(() => {
    const activeAccount = accounts.find((a) => a.isActive);
    if (!activeAccount) return;
    let cancelled = false;
    getAliasesForAccount(activeAccount.id).then((dbAliases) => {
      if (cancelled) return;
      setAliases(dbAliases.map(mapDbAlias));
    });
    return () => { cancelled = true; };
  }, [accounts]);

  const activeAccount = accounts.find((a) => a.isActive);

  const handleSetDefault = async (alias: SendAsAlias) => {
    if (!activeAccount) return;
    await setDefaultAlias(activeAccount.id, alias.id);
    setAliases((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === alias.id,
      })),
    );
  };

  const { t } = useTranslation();
  return (
    <SettingGroup title={t('settings.sendAsAliases')}>
      <div className="flex items-center gap-1 mb-3">
        <p className="text-xs text-text-tertiary">
          {t('settings.sendAsAliasesDescription')}
        </p>
        <InlineTooltip text="Send-as aliases let you send emails from alternate addresses associated with your account. Aliases must be verified before use." />
      </div>
      {aliases.length === 0 ? (
        <p className="text-sm text-text-tertiary">
          {t('settings.noAliasesFound')}
        </p>
      ) : (
        <div className="space-y-2">
          {aliases.map((alias) => (
            <div
              key={alias.id}
              className="flex items-center justify-between py-2.5 px-4 bg-bg-secondary rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Mail size={15} className="text-text-tertiary shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {alias.displayName ? `${alias.displayName} <${alias.email}>` : alias.email}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {alias.isPrimary && (
                      <span className="text-[0.625rem] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
                        {t('settings.primary')}
                      </span>
                    )}
                    {alias.isDefault && (
                      <span className="text-[0.625rem] bg-success/15 text-success px-1.5 py-0.5 rounded-full">
                        {t('settings.default')}
                      </span>
                    )}
                    {alias.verificationStatus !== "accepted" && (
                      <span className="inline-flex items-center gap-1 text-[0.625rem] bg-warning/15 text-warning px-1.5 py-0.5 rounded-full">
                        {alias.verificationStatus}
                        <InlineTooltip text="Verification confirms you own this email address. A verification email was sent to this address � click the link inside to verify." />
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!alias.isDefault && (
                <Button
                  onClick={() => handleSetDefault(alias)}
                  variant="ghost"
                  size="sm"
                  className="text-accent shrink-0 ml-3"
                >
                  {t("compliance.setDefault")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </SettingGroup>
  );
}

