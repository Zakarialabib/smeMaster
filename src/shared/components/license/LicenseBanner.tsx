/**
 * LicenseBanner — Trial countdown & upgrade prompt
 *
 * Shows a dismissible sticky banner at the top of the app when:
 * - User is on a trial (with X days remaining)
 * - User is on Basic tier and Pro features are available
 *
 * Uses the unified `useLicenseStore` for state.
 */
import { useMemo, useCallback } from 'react';
import { Clock, Sparkles, X, ChevronRight } from 'lucide-react';
import { useLicenseStore } from '@shared/stores/licenseStore';
import { Button } from '@shared/components/ui/Button';
import { navigateToSettings } from '@/router/navigate';
import { useSetting } from '@shared/hooks/useSetting';

const DISMISS_HOURS = 24;

export function LicenseBanner() {
  const license = useLicenseStore((s) => s.license);
  const loading = useLicenseStore((s) => s.loading);
  const [dismissedAtStr, setDismissedAt] = useSetting("license_banner_dismissed_at", "0");

  const dismissedAt = parseInt(dismissedAtStr, 10) || null;

  // All hooks must be called before any early return. Compute visibility
  // in a memo rather than using early returns.
  const visibility = useMemo(() => {
    if (loading || !license) {
      return { show: false as const };
    }

    const isOnTrial =
      !!license.trialStartedAt &&
      license.tier === 'pro' &&
      license.trialDaysRemaining !== null &&
      license.trialDaysRemaining > 0;
    const isBasic = license.tier === 'basic';
    const showForTrial =
      isOnTrial && license.trialDaysRemaining! > 0 && license.trialDaysRemaining! <= 7;
    const showForBasic = isBasic;

    if (!showForTrial && !showForBasic) {
      return { show: false as const };
    }

    // Check if dismissed within the last 24h
    const now = Date.now();
    if (dismissedAt && now - dismissedAt < DISMISS_HOURS * 60 * 60 * 1000) {
      return { show: false as const };
    }

    return {
      show: true as const,
      variant: (showForTrial ? 'trial' : 'basic') as 'trial' | 'basic',
      daysRemaining: showForTrial ? license.trialDaysRemaining! : null,
    };
  }, [license, loading, dismissedAt]);

  const handleDismiss = useCallback(() => {
    setDismissedAt(String(Date.now()));
  }, [setDismissedAt]);

  const handleClick = useCallback(() => {
    navigateToSettings('license');
  }, []);

  if (!visibility.show) return null;

  // Variant: Trial countdown (urgent)
  if (visibility.variant === 'trial') {
    const days = visibility.daysRemaining!;
    return (
      <div
        className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-between gap-3 text-sm"
        role="banner"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Clock size={14} className="text-warning shrink-0" />
          <span className="text-text-secondary truncate">
            <strong className="text-warning">
              {days} day{days !== 1 ? 's' : ''}
            </strong>{' '}
            left in your Pro trial. Activate a key to keep all features.
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="primary"
            size="xs"
            onClick={handleClick}
            icon={<ChevronRight size={12} />}
            iconPosition="right"
          >
            Upgrade
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label="Dismiss banner"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  // Variant: Basic tier (subtle upgrade prompt)
  return (
    <div
      className="bg-accent/5 border-b border-accent/15 px-4 py-1.5 flex items-center justify-between gap-3 text-sm"
      role="banner"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Sparkles size={13} className="text-accent shrink-0" />
        <span className="text-text-secondary truncate">
          You're on <strong className="text-text-primary">Basic</strong>. Upgrade to Pro for AI,
          campaigns & more.
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="primary"
          size="xs"
          onClick={handleClick}
          icon={<ChevronRight size={12} />}
          iconPosition="right"
        >
          See plans
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="Dismiss banner"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

