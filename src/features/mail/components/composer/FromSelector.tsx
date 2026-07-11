import type { SendAsAlias } from "@features/mail/db/sendAsAliases";

interface FromSelectorProps {
  aliases: SendAsAlias[];
  selectedEmail: string;
  onChange: (alias: SendAsAlias) => void;
}

/**
 * Dropdown for selecting a send-as alias in the composer.
 * Only visible when more than one alias is available.
 */
export function FromSelector({ aliases, selectedEmail, onChange }: FromSelectorProps) {
  if (aliases.length <= 1) return null;

  const selectedAlias = aliases.find((a) => a.email === selectedEmail) ?? null;

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-xs text-text-tertiary w-8 shrink-0">
        From
      </span>
      <div className="flex-1 relative">
        <select
          value={selectedEmail}
          onChange={(e) => {
            const alias = aliases.find((a) => a.email === e.target.value);
            if (alias) onChange(alias);
          }}
          className="w-full bg-bg-secondary text-sm text-text-primary outline-none cursor-pointer rounded-md border border-border-primary/50 hover:border-border-primary focus:border-accent transition-colors px-2 py-1.5 appearance-none"
        >
          {aliases.map((alias) => (
            <option key={alias.id} value={alias.email}>
              {alias.displayName
                ? `${alias.email} — ${alias.displayName}`
                : alias.email}
            </option>
          ))}
        </select>
      </div>
      {selectedAlias?.displayName && (
        <span className="text-[0.625rem] bg-accent/10 text-accent px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
          {selectedAlias.displayName}
        </span>
      )}
    </div>
  );
}

