import { useState, useRef, useCallback, useMemo } from "react";
import { useAccountToken, type TokenHealth } from "@features/accounts/hooks/useAccountToken";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { cn } from "@shared/utils/cn";

interface TokenStatusBarProps {
  /** Array of account IDs to show token health for */
  accountIds: string[];
}

/**
 * Map provider string to a short letter badge.
 * - gmail_api / google → G
 * - microsoft_graph / outlook / hotmail → O
 * - jmap → J
 * - imap / caldav / default → first letter uppercase
 */
function providerLetter(provider: string | undefined): string {
  if (!provider) return "?";
  switch (provider) {
    case "gmail_api":
      return "G";
    case "microsoft_graph":
      return "O";
    case "jmap":
      return "J";
    default:
      // imap → I, caldav → C, etc.
      return provider[0]?.toUpperCase() ?? "?";
  }
}

/** Tailwind classes per health state for the dot indicator */
const healthDotColor: Record<TokenHealth, string> = {
  healthy: "bg-success shadow-[0_0_6px_rgba(5,150,105,0.4)]",
  refreshing: "bg-warning shadow-[0_0_6px_rgba(217,119,6,0.4)]",
  expired: "bg-danger shadow-[0_0_6px_rgba(220,38,38,0.4)]",
  unknown: "bg-text-tertiary/40",
};

/** Human-readable label for each health state */
const healthLabels: Record<TokenHealth, string> = {
  healthy: "Token healthy",
  refreshing: "Token refreshing…",
  expired: "Re-auth required",
  unknown: "No token data",
};

/** Provider badge colors */
const providerBadgeColor: Record<string, string> = {
  G: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  O: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  I: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  J: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  C: "bg-green-500/15 text-green-600 dark:text-green-400",
};

// ── Individual token badge ───────────────────────────────────────────────

interface TokenBadgeProps {
  accountId: string;
}

function TokenBadge({ accountId }: TokenBadgeProps) {
  const { data: tokenStatus, isLoading } = useAccountToken(accountId);
  const account = useAccountStore((s) => s.accounts.find((a) => a.id === accountId));
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provider = account?.provider ?? "";
  const letter = providerLetter(provider);
  const email = account?.email ?? "Unknown";
  const health: TokenHealth = isLoading
    ? "unknown"
    : (tokenStatus?.health ?? "unknown");

  const showTooltipWithDelay = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), 300);
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setShowTooltip(false);
  }, []);

  const formattedExpiry = useMemo(() => {
    if (!tokenStatus?.expiresAt) return null;
    const d = new Date(tokenStatus.expiresAt * 1000);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [tokenStatus?.expiresAt]);

  return (
    <div
      className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-secondary border border-border-primary text-xs cursor-default hover:bg-bg-hover transition-colors"
      onMouseEnter={showTooltipWithDelay}
      onMouseLeave={hideTooltip}
      onFocus={showTooltipWithDelay}
      onBlur={hideTooltip}
      role="status"
      aria-label={`${email}: ${healthLabels[health]}`}
      tabIndex={0}
    >
      {/* Provider letter badge */}
      <span
        className={cn(
          "inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold leading-none",
          providerBadgeColor[letter] ?? "bg-bg-tertiary text-text-tertiary",
        )}
        aria-hidden="true"
      >
        {letter}
      </span>

      {/* Health dot */}
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0 transition-all duration-300",
          healthDotColor[health],
          health === "refreshing" && "animate-pulse",
        )}
        aria-hidden="true"
      />

      {/* Email — truncated */}
      <span className="max-w-[100px] truncate text-text-secondary" aria-hidden="true">
        {email}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 min-w-[180px]"
          role="tooltip"
        >
          <div className="px-2.5 py-2 rounded-lg bg-bg-primary border border-border-primary shadow-lg text-xs text-text-secondary pointer-events-none">
            <div className="font-medium text-text-primary mb-0.5">{email}</div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  healthDotColor[health],
                )}
              />
              <span>{healthLabels[health]}</span>
            </div>
            {formattedExpiry && (
              <div className="text-text-tertiary mt-0.5">
                Expires at {formattedExpiry}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

/**
 * TokenStatusBar — compact horizontal row showing per-account token health.
 *
 * Each account shows:
 * - Provider letter badge (G / O / I / J)
 * - Colored health dot (green / yellow / red / grey)
 * - Truncated email
 * - Hover tooltip with expiry details
 *
 * States:
 * - **Green** (healthy): Token > 10 min remaining
 * - **Yellow / pulsing** (refreshing): Token being refreshed (auto-resolves)
 * - **Red** (expired/error): Re-auth required
 * - **Grey** (unknown): No token data (e.g. IMAP accounts)
 */
export function TokenStatusBar({ accountIds }: TokenStatusBarProps) {
  if (accountIds.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 flex-wrap px-3 py-2"
      role="group"
      aria-label="Account token status"
    >
      <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mr-1">
        Tokens
      </span>
      {accountIds.map((id) => (
        <TokenBadge key={id} accountId={id} />
      ))}
    </div>
  );
}
