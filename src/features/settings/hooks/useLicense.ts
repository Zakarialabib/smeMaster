/**
 * useLicense — Convenience hook for accessing license state.
 *
 * Mirrors `Simple-Signage/src/core/configuration/useLicense.ts`:
 *   - Returns the current tier and status
 *   - Exposes booleans (isPro, isBasic, isTrial, ...) so consumers
 *     don't need to remember tier rank
 *   - Exposes `hasTier(min)` for tier-gated feature checks
 *
 * The component still uses `useLicenseStore` directly when it needs
 * to *write* (activate, deactivate) — this hook is read-only.
 */

import { useMemo } from 'react';
import {
  useLicenseStore,
  tierMeets,
  type LicenseTier,
  type LicenseStatus,
} from '@shared/stores/licenseStore';

export interface UseLicenseResult {
  tier: LicenseTier;
  status: LicenseStatus;
  isActive: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  isTrial: boolean;
  isBasic: boolean;
  isPro: boolean;
  isEnterprise: boolean;

  hasTier: (minimum: LicenseTier) => boolean;
}

export function useLicense(): UseLicenseResult {
  const license = useLicenseStore((s) => s.license);
  const isLoading = useLicenseStore((s) => s.loading);
  const error = useLicenseStore((s) => s.error);

  return useMemo<UseLicenseResult>(() => {
    const tier: LicenseTier = license?.tier ?? 'basic';
    const status = license?.status ?? 'active';
    const isActive = status === 'active' || status === 'grace';

    return {
      tier,
      status,
      isActive,
      isLoaded: !isLoading,
      isLoading,
      error,
      isTrial: tier === 'trial',
      isBasic: tier === 'basic',
      isPro: tier === 'pro',
      isEnterprise: tier === 'enterprise',
      hasTier: (minimum: LicenseTier) => (isActive ? tierMeets(tier, minimum) : false),
    };
  }, [license, isLoading, error]);
}

