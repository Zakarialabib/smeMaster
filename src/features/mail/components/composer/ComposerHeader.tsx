import { useTranslation } from "react-i18next";
import { Maximize2, Minimize2, ExternalLink, X, Mail, Building2, Eye } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import type { Account } from "@features/accounts/stores/accountStore";

interface ComposerHeaderProps {
  modeLabel: string;
  isFullpage: boolean;
  onToggleView: () => void;
  onPopOut: () => void;
  onClose: () => void;
  activeAccount?: Account | undefined;
  onToggleZen?: () => void;
}

export function ComposerHeader({
  modeLabel,
  isFullpage,
  onToggleView,
  onPopOut,
  onClose,
  activeAccount,
  onToggleZen,
}: ComposerHeaderProps) {
  const { t } = useTranslation();

  const orgName = activeAccount?.company ?? activeAccount?.displayName;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary bg-bg-secondary/80 rounded-t-xl">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
          <Mail size={13} className="text-accent" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {modeLabel}
          </span>
          {orgName && (
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium bg-accent/5 text-accent px-1.5 py-0.5 rounded border border-accent/10">
              <Building2 size={10} className="shrink-0" />
              {orgName}
            </span>
          )}
          <span className="text-[0.5rem] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded-full">
            Esc to close
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          onClick={onToggleView}
          title={isFullpage ? t('composer.collapse') : t('composer.expand')}
        >
          {isFullpage ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          onClick={onPopOut}
          title={t('composer.openInNewWindow')}
        >
          <ExternalLink size={13} />
        </Button>
        {onToggleZen && (
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            onClick={onToggleZen}
            title="Focus mode"
          >
            <Eye size={13} />
          </Button>
        )}
        <div className="w-px h-4 bg-border-secondary mx-1" />
        <Button
          variant="ghost"
          size="xs"
          iconOnly
          onClick={onClose}
          title={t('common.close')}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
