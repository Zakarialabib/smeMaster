/**
 * UpgradeBadge / UpgradeBanner — Premium Pro Upgrade UI Components
 *
 * Usage:
 *   <UpgradeBadge variant="pro-only" size="sm" />
 *   <UpgradeBanner featureName="AI Features" />
 *
 * Design:
 * - Badge: compact inline/block pill with Zap icon, "PRO" label, tooltip, hover micro-animations
 * - Banner: full-width card with Crown icon, title, description, "Learn More" CTA, gradient background
 * - Both respect prefers-reduced-motion and are fully dark-mode compatible
 */
import { useState, useRef } from "react";
import { Zap, Crown, Lock } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";
import { TOOLTIP_BASE } from "@shared/styles/ui-tokens";

// ─── Props ───

interface UpgradeBadgeProps {
  /** 'pro-only' = feature is completely locked, 'limit' = usage cap reached */
  variant?: "pro-only" | "limit";
  /** Optional: custom tooltip / message */
  message?: string;
  /** Alias for message (used by some consumer components) */
  tooltipContent?: string;
  /** Optional: size */
  size?: "sm" | "md" | "lg";
  /** Optional: show as inline vs block */
  inline?: boolean;
  /** Optional: className for customization */
  className?: string;
}

interface UpgradeBannerProps {
  /** Name of the feature (e.g. "PGP Encryption") */
  featureName: string;
  /** Optional: custom description; defaults to a standard upgrade prompt */
  description?: string;
  /** Optional: className for customization */
  className?: string;
  /** Optional: custom CTA label */
  ctaLabel?: string;
  /** Optional: CTA href (defaults to #settings/subscription) */
  ctaHref?: string;
}

// ─── Size maps ───

const SIZE_CLASSES = {
  sm: {
    badge: "px-1.5 py-0.5 text-[0.625rem] gap-1",
    icon: 10,
    label: "text-[0.5625rem]",
  },
  md: {
    badge: "px-2 py-0.5 text-xs gap-1",
    icon: 12,
    label: "text-[0.625rem]",
  },
  lg: {
    badge: "px-2.5 py-1 text-xs gap-1.5",
    icon: 14,
    label: "text-xs",
  },
} as const;

// ─── UpgradeBadge ───

export function UpgradeBadge({
  variant = "pro-only",
  message,
  tooltipContent,
  size = "sm",
  inline = true,
  className = "",
}: UpgradeBadgeProps) {
  // Merge tooltipContent as an alias for message
  const resolvedMessage = message ?? tooltipContent;
  const s = SIZE_CLASSES[size];
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;

  const defaultMessage =
    variant === "limit"
      ? "You've reached the usage limit. Upgrade to Pro for unlimited access."
      : "Upgrade to Pro to unlock this feature";

  const tooltipText = resolvedMessage ?? defaultMessage;

  const showTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTooltipVisible(true), 300);
  };

  const hideTooltip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTooltipVisible(false), 100);
  };

  const toggleTooltip = () => setTooltipVisible((v) => !v);

  // ── Variant styles ──

  const isProOnly = variant === "pro-only";

  const badgeColors = isProOnly
    ? "bg-accent/10 text-accent border-accent/25 hover:bg-accent/15 hover:border-accent/40"
    : "bg-warning/10 text-warning border-warning/25 hover:bg-warning/15 hover:border-warning/40";

  const IconComponent = isProOnly ? Zap : Lock;

  const animationClasses =
    "transition-all duration-200 ease-out hover:scale-105 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:scale-100";

  const containerClass = inline ? "inline-flex items-center" : "flex items-center w-full";

  return (
    <span className={`relative ${containerClass} ${className}`}>
      <span
        tabIndex={0}
        role="button"
        aria-label={tooltipText}
        className={`
          ${s.badge} ${badgeColors} rounded-full border font-semibold
          cursor-pointer select-none
          ${animationClasses}
          inline-flex items-center
        `}
        onMouseEnter={!isMobileDevice ? showTooltip : undefined}
        onMouseLeave={!isMobileDevice ? hideTooltip : undefined}
        onFocus={!isMobileDevice ? showTooltip : undefined}
        onBlur={!isMobileDevice ? hideTooltip : undefined}
        onClick={isMobileDevice ? toggleTooltip : undefined}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (isMobileDevice && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggleTooltip();
          }
        }}
        aria-expanded={tooltipVisible}
      >
        <IconComponent size={s.icon} className="shrink-0" aria-hidden="true" />
        {isProOnly ? (
          <span className={s.label}>PRO</span>
        ) : (
          <span className={s.label}>Limit</span>
        )}
      </span>

      {/* ── Tooltip ── */}
      {tooltipVisible && (
        <>
          <div
            className={`${TOOLTIP_BASE} bottom-full left-1/2 -translate-x-1/2 mb-2`}
            role="tooltip"
          >
            <div className="flex items-start gap-1.5">
              <Crown size={12} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
              <span>{tooltipText}</span>
            </div>
            {/* Arrow */}
            <span
              className="absolute top-full left-1/2 -translate-x-1/2
                border-l-4 border-r-4 border-t-4 border-transparent border-t-border-primary"
            />
          </div>
          {/* Mobile backdrop */}
          {isMobileDevice && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setTooltipVisible(false)}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </span>
  );
}

// ─── UpgradeBanner ───

export function UpgradeBanner({
  featureName,
  description,
  className = "",
  ctaLabel = "Learn More",
  ctaHref = "#settings/subscription",
}: UpgradeBannerProps) {
  const defaultDescription = `Unlock ${featureName} and other premium features when you upgrade to Pro.`;

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border border-accent/20
        bg-gradient-to-br from-accent/[0.04] via-accent/[0.02] to-transparent
        p-5 sm:p-6
        transition-all duration-300
        hover:border-accent/30 hover:shadow-sm hover:shadow-accent/5
        motion-reduce:transition-none
        ${className}
      `}
      role="region"
      aria-label={`Upgrade to Pro for ${featureName}`}
    >
      {/* Subtle decorative glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-accent/5 blur-xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon + text */}
        <div className="flex items-start gap-3 sm:items-center flex-1 min-w-0">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 shrink-0"
            aria-hidden="true"
          >
            <Crown size={20} className="text-accent" />
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-text-primary">
              Upgrade to Pro
            </h4>
            <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
              {description ?? defaultDescription}
            </p>
          </div>
        </div>

        {/* CTA */}
        <a
          href={ctaHref}
          className={`
            inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold
            text-white bg-accent hover:bg-accent-hover
            rounded-lg shadow-sm
            transition-all duration-200
            hover:shadow-md hover:shadow-accent/20
            hover:-translate-y-0.5
            active:translate-y-0
            motion-reduce:transition-none motion-reduce:hover:translate-y-0
            shrink-0 self-start sm:self-auto
          `}
          onClick={(e: React.MouseEvent) => {
            // If it's a hash link, let default behavior handle it
            if (ctaHref.startsWith("#")) {
              e.preventDefault();
              // Dispatch a custom event that the settings page can listen for
              window.dispatchEvent(
                new CustomEvent("navigate-settings", { detail: { tab: "subscription" } }),
              );
            }
          }}
        >
          <Crown size={14} aria-hidden="true" />
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}
