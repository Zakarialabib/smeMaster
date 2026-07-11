import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { PgpKeyManager } from "@features/settings/components/PgpKeyManager";
import { Button } from "@shared/components/ui/Button";
import { notify } from "@shared/services/notifications/toastHelper";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup, SettingRow } from "@features/settings/components/SettingsHelpers";
import { useAccountStore } from "@features/accounts/stores/accountStore";

export default function PgpTab() {
  const { t } = useTranslation();
  const [clearingPassphrase, setClearingPassphrase] = useState(false);
  const accounts = useAccountStore((s) => s.accounts);
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  async function handleClearAllPassphrases() {
    setClearingPassphrase(true);
    try {
      const { clearPassphraseCache } = await import("@shared/services/pgp/passphraseCache");
      await Promise.all(accountIds.map((id) => clearPassphraseCache(id)));
      notify("Passphrase", "Cleared cached PGP passphrases for all accounts.");
    } catch (err) {
      console.error("Failed to clear passphrase cache:", err);
    } finally {
      setClearingPassphrase(false);
    }
  }

  return (
    <SettingGroup title={t('settings.tabs.pgp')}>
      {/* Education: PGP Encryption */}
      <HelpCard
        items={[
          { type: "why", text: "PGP encrypts email content end-to-end so only the intended recipient can read it, protecting sensitive information from interception." },
          { type: "how", text: "Your private key decrypts incoming mail; recipients' public keys encrypt outgoing mail. Keys are stored locally in the Tauri secure enclave." },
          { type: "when", text: "Essential for confidential business communication, legal documents, and any scenario where email privacy is mandated by policy." },
        ]}
      />
      <div className="mt-4">
        <PgpKeyManager />
      </div>
      <div className="mt-4 border-t border-border-primary pt-4">
        <SettingRow label="Passphrase Cache">
          <Button
            variant="secondary"
            size="sm"
            icon={<KeyRound size={14} />}
            onClick={handleClearAllPassphrases}
            disabled={clearingPassphrase || accountIds.length === 0}
          >
            {clearingPassphrase ? "Clearing..." : "Clear Cached Passphrases"}
          </Button>
        </SettingRow>
      </div>
    </SettingGroup>
  );
}

