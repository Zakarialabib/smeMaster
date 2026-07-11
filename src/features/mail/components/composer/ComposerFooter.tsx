import { useTranslation } from "react-i18next";
import { Clock, Building2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { SignatureSelector } from "./SignatureSelector";
import type { Account } from "@features/accounts/stores/accountStore";
import { usePlatform } from "@shared/hooks/usePlatform";

interface ComposerFooterProps {
  fromEmail: string | null;
  activeAccount: Account | undefined;
  savedLabel: string | null;
  isSaving: boolean;
  to: string[];
  onDiscard: () => void;
  onSend: () => void;
  onSchedule: () => void;
}

export function ComposerFooter({
  fromEmail,
  activeAccount,
  savedLabel,
  isSaving,
  to,
  onDiscard,
  onSend,
  onSchedule,
}: ComposerFooterProps) {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobile = screen.isMobile;
  const orgName = activeAccount?.company ?? activeAccount?.displayName;

  return (
    <div className={`flex items-center justify-between px-5 py-3 border-t border-border-primary bg-bg-secondary rounded-b-lg ${isMobile ? "safe-area-bottom" : ""}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-xs text-text-tertiary truncate max-w-[200px]">
          {fromEmail ?? activeAccount?.email ?? t('composer.noAccount')}
        </div>
        {orgName && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[0.625rem] text-accent/70 bg-accent/5 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
            <Building2 size={10} />
            {t('composer.via')} {orgName}
          </span>
        )}
        {savedLabel && (
          <span
            className={`text-xs text-text-tertiary italic transition-opacity duration-200 shrink-0 ${isSaving ? "animate-pulse" : ""}`}
          >
            {savedLabel}
          </span>
        )}
        <div className="hidden sm:flex items-center gap-2">
          <SignatureSelector />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDiscard}
        >
          {t('common.discard')}
        </Button>
        <div className="flex items-center">
          <Button
            variant="primary"
            size="sm"
            onClick={onSend}
            disabled={to.length === 0}
            className="rounded-r-none border-r border-white/20"
          >
            {t('composer.send')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconOnly
            onClick={onSchedule}
            disabled={to.length === 0}
            title={t('composer.scheduleSend')}
            className="rounded-l-none"
          >
            <Clock size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
