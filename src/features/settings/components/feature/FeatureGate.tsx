/**
 * FeatureGate — Combined Feature Flag + Tier/License Gating
 *
 * Unifies BOTH:
 * 1. Feature Flag check (runtime toggles from featureFlagStore)
 * 2. Tier/License check (Basic/Pro from licenseStore)
 *
 * A feature is shown when:
 * - The required flag (if any) is enabled
 * - AND the current tier is at or above the required minimum tier
 *
 * Optional behavior:
 * - showUpgrade: render an upgrade CTA when locked
 * - fallback: render any custom fallback when locked
 *
 * @example
 *   <FeatureGate flag="ai_writer" minTier="pro">
 *     <AiWriterButton />
 *   </FeatureGate>
 *
 * @example
 *   <FeatureGate minTier="pro" showUpgrade>
 *     <CampaignsPage />
 *   </FeatureGate>
 */
import { ReactNode, useMemo } from "react";
import { Sparkles, Lock, ChevronRight } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { useLicenseStore, type LicenseTier } from "@shared/stores/licenseStore";

export type GateReason = "ok" | "flag-disabled" | "tier-too-low" | "no-license";

export interface FeatureGateProps {
  /** Optional feature flag key (kebab-case id from featureFlags.ts) */
  flag?: string;
  /** Minimum required license tier */
  minTier?: LicenseTier;
  /** When locked, show an upgrade CTA instead of nothing */
  showUpgrade?: boolean;
  /** Custom fallback when locked */
  fallback?: ReactNode;
  /** Children to render when the gate is open */
  children: ReactNode;
  /** Hide all visual decoration, render only children or nothing */
  silent?: boolean;
  /** Callback when the gate is closed (useful for analytics) */
  onBlocked?: (reason: GateReason) => void;
}

const TIER_RANK: Record<LicenseTier, number> = {
  trial: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

/**
 * FeatureGate — Drop-in wrapper that combines flag + tier gating.
 *
 * Use as a smart alternative to multiple `if` checks.
 */
export function FeatureGate({
  flag,
  minTier = "basic",
  showUpgrade = false,
  fallback,
  children,
  silent = false,
  onBlocked,
}: FeatureGateProps) {
  const license = useLicenseStore((s) => s.license);
  const isLoading = useLicenseStore((s) => s.loading);
  const getFeatureAccess = useFeatureFlagStore((s) => s.getFeatureAccess);

  const { allowed, reason } = useMemo(() => {
    // If still loading, optimistically show children (avoids layout shift)
    if (isLoading) {
      return { allowed: true, reason: "ok" as GateReason };
    }

    // No license at all (shouldn't happen in production but be safe)
    if (!license) {
      return { allowed: false, reason: "no-license" as GateReason };
    }

    // 1. Tier check first (cheaper, more decisive)
    const currentRank = TIER_RANK[license.tier];
    const requiredRank = TIER_RANK[minTier];

    // During trial, treat as the tier it represents
    const effectiveRank =
      license.trialStartedAt !== null && license.tier === "pro" && license.trialTier
        ? Math.max(currentRank, TIER_RANK[license.trialTier])
        : currentRank;

    if (effectiveRank < requiredRank) {
      return { allowed: false, reason: "tier-too-low" as GateReason };
    }

    // 2. Feature flag check (only if flag provided)
    if (flag) {
      // getFeatureAccess(featureId, realUsage) — pass 0 as no usage cap check
      const access = getFeatureAccess(flag, 0);
      if (access === "locked") {
        return { allowed: false, reason: "flag-disabled" as GateReason };
      }
    }

    return { allowed: true, reason: "ok" as GateReason };
  }, [license, isLoading, minTier, flag, getFeatureAccess]);

  if (allowed) {
    return <>{children}</>;
  }

  // Gate is closed
  if (onBlocked) {
    // Defer to a microtask to avoid setState in render
    queueMicrotask(() => onBlocked(reason));
  }

  if (silent) {
    return null;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (showUpgrade) {
    return <UpgradePrompt reason={reason} minTier={minTier} />;
  }

  return null;
}

/**
 * UpgradePrompt — Inline card shown when a feature is gated.
 * Kept separate for direct use in feature listings (e.g., settings → features).
 */
export function UpgradePrompt({
  reason,
  minTier = "pro",
  message,
}: {
  reason: GateReason;
  minTier?: LicenseTier;
  message?: string;
}) {
  const defaultMessage =
    reason === "tier-too-low"
      ? `This feature requires ${minTier === "enterprise" ? "Enterprise" : "Pro"} tier.`
      : reason === "flag-disabled"
        ? "This feature is not enabled in your current configuration."
        : "A license is required to use this feature.";

  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 p-6 rounded-xl border border-border-primary bg-bg-secondary/40">
      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center ring-1 ring-accent/20">
        {reason === "tier-too-low" || reason === "no-license" ? (
          <Lock size={20} className="text-accent" />
        ) : (
          <Sparkles size={20} className="text-accent" />
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          {message ?? "Upgrade required"}
        </h3>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          {defaultMessage}
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        icon={<ChevronRight size={14} />}
        iconPosition="right"
        onClick={() => {
          // Navigate to license page
          import("@/router/navigate").then(({ navigateToLicense }) => {
            navigateToLicense();
          });
        }}
      >
        Upgrade now
      </Button>
    </div>
  );
}

/**
 * Hook variant for inline conditional rendering without a wrapper.
 * Returns `{ allowed, reason }` so callers can decide what to render.
 */
export function useFeatureGate(
  flag?: string,
  minTier: LicenseTier = "basic",
): { allowed: boolean; reason: GateReason } {
  const license = useLicenseStore((s) => s.license);
  const isLoading = useLicenseStore((s) => s.loading);
  const getFeatureAccess = useFeatureFlagStore((s) => s.getFeatureAccess);

  return useMemo(() => {
    if (isLoading || !license) {
      return { allowed: true, reason: "ok" as GateReason };
    }
    const currentRank = TIER_RANK[license.tier];
    const requiredRank = TIER_RANK[minTier];
    const effectiveRank =
      license.trialStartedAt !== null && license.tier === "pro" && license.trialTier
        ? Math.max(currentRank, TIER_RANK[license.trialTier])
        : currentRank;
    if (effectiveRank < requiredRank) {
      return { allowed: false, reason: "tier-too-low" as GateReason };
    }
    if (flag) {
      const access = getFeatureAccess(flag, 0);
      if (access === "locked") {
        return { allowed: false, reason: "flag-disabled" as GateReason };
      }
    }
    return { allowed: true, reason: "ok" as GateReason };
  }, [license, isLoading, minTier, flag, getFeatureAccess]);
}

