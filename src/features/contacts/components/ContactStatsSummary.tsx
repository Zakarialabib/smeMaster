import { Mail, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatRelativeDate } from "@shared/utils/date";
import type { ContactStats } from "@features/contacts/db/contacts";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ContactStatsSummaryProps {
  stats: ContactStats | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Shared stats summary for a contact: email count, first email, last email.
 *
 * Used by both `ContactSidebar` (mail) and `ContactInfoTab` (contacts detail).
 */
export function ContactStatsSummary({ stats }: ContactStatsSummaryProps) {
  const { t } = useTranslation();

  if (!stats) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <Mail size={12} className="text-text-tertiary shrink-0" />
        <span>{t('contact.nEmails', { n: stats.emailCount })}</span>
      </div>
      {stats.firstEmail && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Clock size={12} className="text-text-tertiary shrink-0" />
          <span>{t('contact.firstEmail', { date: formatRelativeDate(stats.firstEmail) })}</span>
        </div>
      )}
      {stats.lastEmail && (
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Clock size={12} className="text-text-tertiary shrink-0" />
          <span>{t('contact.lastEmail', { date: formatRelativeDate(stats.lastEmail) })}</span>
        </div>
      )}
    </div>
  );
}
