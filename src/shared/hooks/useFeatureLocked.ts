import { useMemo } from "react";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import type { FeatureAccess } from "@/constants/featureFlags";

export interface UseFeatureLockedResult {
  isLocked: boolean;
  access: FeatureAccess;
}

/**
 * Wraps the `useFeatureFlagStore.getFeatureAccess(featureName, 0)` call so
 * consumers don't need to import the store directly and so the `isLocked`
 * predicate is centralized.
 *
 * @example
 *   const { isLocked } = useFeatureLocked("ai");
 *   if (isLocked) return <UpgradeBanner />;
 */
export function useFeatureLocked(featureName: string, currentUsage = 0): UseFeatureLockedResult {
  const access = useFeatureFlagStore((s) => s.getFeatureAccess(featureName, currentUsage));
  return useMemo(() => ({ access, isLocked: access === "locked" }), [access]);
}

