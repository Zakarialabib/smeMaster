import { useState, useCallback } from "react";
import { cn } from "@shared/utils/cn";

// ── Types ───────────────────────────────────────────────────────────────

interface AccountCardProps {
  /** Unique account ID */
  id: string;
  /** Email address */
  email: string;
  /** Optional display name (falls back to email local part) */
  displayName: string | null;
  /** Provider type string (e.g. "gmail_api", "microsoft_graph", "jmap", "imap") */
  provider: string;
  /** Optional avatar URL — if provided, shown instead of provider letter */
  avatarUrl?: string | null;
  /** Whether this card is currently selected/active */
  isActive?: boolean;
  /** Optional click handler */
  onClick?: (id: string) => void;
  /** Optional additional class names */
  className?: string;
}

// ── Provider letter mapping ─────────────────────────────────────────────

/**
 * Map provider string to a short letter badge.
 * Matches the same convention used in TokenStatusBar and AccountSwitcher.
 */
function providerLetter(provider: string): string {
  switch (provider) {
    case "gmail_api":
      return "G";
    case "microsoft_graph":
      return "O";
    case "jmap":
      return "J";
    default:
      return provider[0]?.toUpperCase() ?? "?";
  }
}

/**
 * Tailwind classes for the provider badge circle.
 * Matches the color scheme in TokenStatusBar and AccountSwitcher.
 */
function providerBadgeClass(provider: string): string {
  switch (provider) {
    case "gmail_api":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    case "microsoft_graph":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    case "jmap":
      return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
    case "imap":
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
    default:
      return "bg-gray-500/15 text-gray-600 dark:text-gray-400";
  }
}

// ── Component ───────────────────────────────────────────────────────────

/**
 * AccountCard — displays an email account with provider letter badge.
 *
 * Shows:
 * - Provider letter badge (G / O / I / J) in a colored circle
 *   (or avatar image if avatarUrl is provided)
 * - Display name (or email local part as fallback)
 * - Email address
 * - Active/selected state
 *
 * Uses the same provider badge conventions as TokenStatusBar and AccountSwitcher:
 * - Gmail (gmail_api)     → blue  badge "G"
 * - Outlook (microsoft_graph) → orange badge "O"
 * - JMAP (jmap)           → teal  badge "J"
 * - IMAP (imap)           → purple badge "I"
 */
export function AccountCard({
  id,
  email,
  displayName,
  provider,
  avatarUrl,
  isActive = false,
  onClick,
  className,
}: AccountCardProps) {
  const [imgError, setImgError] = useState(false);
  const letter = providerLetter(provider);
  const badgeClasses = providerBadgeClass(provider);
  const displayLabel = displayName || email.split("@")[0] || email;
  const showAvatar = avatarUrl && !imgError;

  const handleClick = useCallback(() => {
    onClick?.(id);
  }, [id, onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick(id);
      }
    },
    [id, onClick],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        isActive
          ? "border-accent/30 bg-accent/5"
          : "border-border-primary bg-bg-secondary hover:bg-bg-hover",
        onClick && "cursor-pointer hover-lift",
        className,
      )}
      onClick={onClick ? handleClick : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Account: ${displayLabel} (${email})`}
      aria-current={isActive ? "true" : undefined}
    >
      {/* Provider letter badge or avatar */}
      <div className="relative shrink-0">
        {showAvatar ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-9 h-9 rounded-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
              isActive ? "bg-accent text-white" : badgeClasses,
            )}
            aria-hidden="true"
          >
            {letter}
          </div>
        )}
      </div>

      {/* Account info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm font-medium truncate leading-tight",
            isActive ? "text-accent" : "text-text-primary",
          )}
        >
          {displayLabel}
        </div>
        <div className="text-xs text-text-tertiary truncate leading-tight mt-0.5">
          {email}
        </div>
      </div>
    </div>
  );
}
