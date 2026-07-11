import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@shared/components/ui/Button";
import { AddressInput, type ContactLookupInfo } from "./AddressInput";
import { FromSelector } from "./FromSelector";
import { getContactByEmail } from "@features/contacts/db/contacts";
import type { SendAsAlias } from "@features/mail/db/sendAsAliases";
import type { Account } from "@features/accounts/stores/accountStore";
import type { ComposerMode } from "@features/mail/stores/composerStore";

interface ComposerAddressSectionProps {
  aliases: SendAsAlias[];
  fromEmail: string | null;
  activeAccount: Account | undefined;
  to: string[];
  cc: string[];
  bcc: string[];
  showCcBcc: boolean;
  mode?: ComposerMode;
  onFromChange: (email: string) => void;
  onToChange: (addresses: string[]) => void;
  onCcChange: (addresses: string[]) => void;
  onBccChange: (addresses: string[]) => void;
  onToggleCcBcc: () => void;
}

/**
 * Look up a single email in the contacts DB and return display info.
 * Returns null if no contact is found.
 */
async function lookupContactInfo(email: string): Promise<ContactLookupInfo | null> {
  try {
    const contact = await getContactByEmail(email);
    if (contact && contact.display_name) {
      return { displayName: contact.display_name };
    }
    return null;
  } catch {
    return null;
  }
}

export function ComposerAddressSection({
  aliases,
  fromEmail,
  activeAccount,
  to,
  cc,
  bcc,
  showCcBcc,
  mode = "new",
  onFromChange,
  onToChange,
  onCcChange,
  onBccChange,
  onToggleCcBcc,
}: ComposerAddressSectionProps) {
  const { t } = useTranslation();
  const [contactInfo, setContactInfo] = useState<Record<string, ContactLookupInfo | null>>({});
  const pendingLookupRef = useRef<Set<string>>(new Set());

  const isNewMode = mode === "new";

  /**
   * Enqueue contact lookups for a list of addresses.
   * Merges new results into the existing contactInfo map.
   */
  const lookupAddresses = useCallback(async (addresses: string[]) => {
    const emailsToLookup = addresses.filter(
      (addr) => addr.includes("@") && !(addr in contactInfo) && !pendingLookupRef.current.has(addr),
    );
    if (emailsToLookup.length === 0) return;

    for (const email of emailsToLookup) {
      pendingLookupRef.current.add(email);
    }

    // Fire all lookups concurrently, then batch-update state
    const results = await Promise.all(
      emailsToLookup.map(async (email) => {
        const info = await lookupContactInfo(email);
        return { email, info };
      }),
    );

    const updates: Record<string, ContactLookupInfo | null> = {};
    for (const { email, info } of results) {
      updates[email] = info;
      pendingLookupRef.current.delete(email);
    }

    setContactInfo((prev) => ({ ...prev, ...updates }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally NOT depending on contactInfo to avoid stale closure in the filter check;
  // we use pendingLookupRef to avoid duplicate in-flight lookups instead.

  // Look up contact info whenever the address lists change
  useEffect(() => {
    lookupAddresses(to);
  }, [to, lookupAddresses]);

  useEffect(() => {
    if (showCcBcc) {
      lookupAddresses(cc);
    }
  }, [cc, showCcBcc, lookupAddresses]);

  useEffect(() => {
    if (showCcBcc) {
      lookupAddresses(bcc);
    }
  }, [bcc, showCcBcc, lookupAddresses]);

  return (
    <div className="px-5 py-3 space-y-2 border-b border-border-secondary">
      <FromSelector
        aliases={aliases}
        selectedEmail={fromEmail ?? activeAccount?.email ?? ""}
        onChange={(alias: SendAsAlias) => onFromChange(alias.email)}
      />
      <AddressInput label="To" addresses={to} onChange={onToChange} contactInfo={contactInfo} isNewMode={isNewMode} />
      {showCcBcc ? (
        <>
          <AddressInput label="Cc" addresses={cc} onChange={onCcChange} contactInfo={contactInfo} isNewMode={isNewMode} />
          <AddressInput label="Bcc" addresses={bcc} onChange={onBccChange} contactInfo={contactInfo} isNewMode={isNewMode} />
        </>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCcBcc}
          className="ml-10 text-accent hover:text-accent-hover"
        >
          {t('composer.ccBcc')}
        </Button>
      )}
    </div>
  );
}
