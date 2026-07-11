/**
 * License Store — Tier & Trial State Management
 *
 * Manages the current license tier (trial/basic/pro/enterprise) and tracks
 * trial countdown, grace period, and validation status.
 *
 * Architecture:
 *  - Persists authoritative license state in SQLite via the Rust
 *    `src-tauri/src/licensing` module (Ed25519-signed, hardware-bound).
 *  - Persists trial metadata (start date, fingerprint display) in the
 *    settings KV store so we don't depend on the backend for that.
 *  - Uses the LicensePort abstraction (`LicenseTauriAdapter`) so the
 *    store is testable and can swap to a different transport.
 *
 * Initial behavior:
 *  - On first install, no trial is auto-started. User can start a
 *    14-day Pro trial manually from settings.
 *  - License key activation upgrades to Pro permanently (until key
 *    expiry or hardware change).
 *  - When a Pro license expires, the app downgrades to Basic (no
 *    hard lock — this is the SMEMaster open-source contract).
 */

import { create } from 'zustand';
import { getSetting, setSetting } from '@features/settings/db/settings';
import { licenseAdapter } from '@core/adapters/tauri/LicenseTauriAdapter';
import {
  licenseInfoToState,
  validationToState,
  EMPTY_LICENSE_STATE,
  type LicenseTier as BackendTier,
  type LicenseStatus as BackendLicenseStatus,
} from '@features/settings/types/license';

// ---------------------------------------------------------------------------
// Re-exports — keep backwards compatibility with the existing public surface
// ---------------------------------------------------------------------------

/** Frontend-friendly tier names. Matches the existing union. */
export type LicenseTier = 'trial' | 'basic' | 'pro' | 'enterprise';
/**
 * License status. Aliased to the canonical union in
 * `@features/settings/types/license` so the store, the LicensePage
 * UI, and the FeatureGate component all agree on the same shape.
 */
export type LicenseStatus = BackendLicenseStatus;

export interface LicenseState {
  tier: LicenseTier;
  status: LicenseStatus;
  /** What tier the trial represents (always 'pro' for now) */
  trialTier: LicenseTier | null;
  trialDaysRemaining: number | null;
  graceDaysRemaining: number | null;
  /** Last 4 chars of key for display, e.g. "..A3F2" */
  keyFingerprint: string | null;
  hardwareId: string | null;
  activatedAt: string | null;
  trialStartedAt: string | null;
  lastValidatedAt: string | null;
  features: string[];
  expiresAt: string | null;
}

export interface LicenseStore {
  license: LicenseState | null;
  loading: boolean;
  error: string | null;
  /**
   * Wall-clock timestamp of the last successful backend validation.
   * Independent of `license.lastValidatedAt` so the UI can show
   * "validated 5m ago" even when the user is on a free tier.
   */
  lastValidatedAt: number | null;

  // Lifecycle
  init: () => Promise<void>;

  // Actions
  activateTrial: () => Promise<LicenseState>;
  activateLicenseKey: (key: string) => Promise<LicenseState>;
  setTier: (tier: LicenseTier) => Promise<LicenseState>;
  refresh: () => Promise<void>;
  deactivate: () => Promise<void>;
  /** Re-fetch from backend + validate against the embedded public key. */
  revalidate: () => Promise<LicenseState | null>;

  // Helpers
  isPro: () => boolean;
  isTrial: () => boolean;
  isExpired: () => boolean;
  isGrace: () => boolean;
  /** Check if current tier meets the minimum required */
  hasTier: (minTier: LicenseTier) => boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIAL_DURATION_DAYS = 14;
const GRACE_PERIOD_DAYS = 7;

const TIER_RANK: Record<LicenseTier, number> = {
  trial: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function computeTrialState(trialStartedAt: string | null): {
  daysRemaining: number;
  status: LicenseStatus;
} {
  if (!trialStartedAt) {
    return { daysRemaining: TRIAL_DURATION_DAYS, status: 'active' };
  }
  const start = new Date(trialStartedAt);
  const now = new Date();
  const elapsed = daysBetween(start, now);
  const daysRemaining = Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  return {
    daysRemaining,
    status: daysRemaining > 0 ? 'active' : 'expired',
  };
}

function mergeBackendWithLocal(
  backend: ReturnType<typeof licenseInfoToState>,
  local: Partial<LicenseState>,
): LicenseState {
  return {
    ...EMPTY_LICENSE_STATE,
    ...backend,
    // Preserve local trial metadata that the backend doesn't know about
    trialStartedAt: local.trialStartedAt ?? backend.trialStartedAt ?? null,
    trialTier: local.trialTier ?? null,
    trialDaysRemaining: local.trialDaysRemaining ?? null,
    graceDaysRemaining: local.graceDaysRemaining ?? null,
    lastValidatedAt: local.lastValidatedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLicenseStore = create<LicenseStore>((set, get) => ({
  license: null,
  loading: true,
  error: null,
  lastValidatedAt: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      // Load local trial metadata first (synchronous-ish)
      const [
        storedTier,
        storedKeyFingerprint,
        storedActivatedAt,
        storedTrialStartedAt,
        storedLastValidatedAt,
        storedStatus,
      ] = await Promise.all([
        getSetting('license_tier'),
        getSetting('license_key_fingerprint'),
        getSetting('license_activated_at'),
        getSetting('license_trial_started_at'),
        getSetting('license_last_validated_at'),
        getSetting('license_status'),
      ]);

      // Try to fetch the canonical license from the Rust backend.
      // In web (vite dev) mode this returns null gracefully.
      let backendInfo = null;
      try {
        backendInfo = await licenseAdapter.getLicenseInfo();
      } catch (e) {
        console.warn('[license] init: backend getLicenseInfo failed', e);
      }

      const backendState = licenseInfoToState(backendInfo);
      const hasBackend = backendInfo !== null && !!backendInfo.key;

      // Case 1: Backend has a license — backend is authoritative
      if (hasBackend) {
        const merged = mergeBackendWithLocal(backendState, {
          trialStartedAt: storedTrialStartedAt || null,
          status: (storedStatus as LicenseStatus) || backendState.status,
          activatedAt: storedActivatedAt || backendState.activatedAt,
        });
        set({ license: merged, loading: false, error: null });
        return;
      }

      // Case 2: No backend license — fall back to local trial state
      if (!storedTier && !storedTrialStartedAt && !storedKeyFingerprint) {
        // Fresh install: no trial auto-started
        set({ license: { ...EMPTY_LICENSE_STATE }, loading: false });
        return;
      }

      // Trial path (no key, only trial started)
      if (storedTrialStartedAt) {
        const { daysRemaining, status } = computeTrialState(storedTrialStartedAt);
        const license: LicenseState = {
          tier: status === 'expired' ? 'basic' : (storedTier as LicenseTier) || 'pro',
          status: status as LicenseStatus,
          trialTier: 'pro',
          trialDaysRemaining: daysRemaining,
          graceDaysRemaining: status === 'expired' ? GRACE_PERIOD_DAYS : null,
          keyFingerprint: null,
          hardwareId: null,
          activatedAt: null,
          trialStartedAt: storedTrialStartedAt,
          lastValidatedAt: storedLastValidatedAt,
          features: [],
          expiresAt: null,
        };
        set({ license, loading: false });
        return;
      }

      // Legacy key path (key set in local settings but no backend) — degrade gracefully
      if (storedKeyFingerprint) {
        const license: LicenseState = {
          tier: (storedTier as LicenseTier) || 'pro',
          status: (storedStatus as LicenseStatus) || 'active',
          trialTier: null,
          trialDaysRemaining: null,
          graceDaysRemaining: null,
          keyFingerprint: storedKeyFingerprint,
          hardwareId: null,
          activatedAt: storedActivatedAt,
          trialStartedAt: null,
          lastValidatedAt: storedLastValidatedAt,
          features: [],
          expiresAt: null,
        };
        set({ license, loading: false });
        return;
      }

      // Fallback
      set({ license: { ...EMPTY_LICENSE_STATE }, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load license',
      });
    }
  },

  activateTrial: async () => {
    const now = new Date().toISOString();
    await setSetting('license_trial_started_at', now);
    await setSetting('license_tier', 'pro');
    await setSetting('license_status', 'active');

    const license: LicenseState = {
      tier: 'pro',
      status: 'active',
      trialTier: 'pro',
      trialDaysRemaining: TRIAL_DURATION_DAYS,
      graceDaysRemaining: null,
      keyFingerprint: null,
      hardwareId: null,
      activatedAt: null,
      trialStartedAt: now,
      lastValidatedAt: null,
      features: [],
      expiresAt: null,
    };
    set({ license, error: null });
    return license;
  },

  activateLicenseKey: async (key: string) => {
    // Delegate to the backend which performs Ed25519 signature
    // verification + hardware binding. The backend is the source of
    // truth for any activated key.
    const result = await licenseAdapter.activateLicense(key);

    if (!result.valid) {
      const error = result.message || 'License activation failed';
      set({ error });
      throw new Error(error);
    }

    // Build the unified state from the validation result.
    const now = new Date().toISOString();
    const license: LicenseState = {
      tier: result.tier === 'enterprise' ? 'enterprise' : 'pro',
      status: 'active',
      trialTier: null,
      trialDaysRemaining: null,
      graceDaysRemaining: null,
      keyFingerprint: fingerprintFromValidationKey(key, result),
      hardwareId: null,
      activatedAt: now,
      trialStartedAt: null,
      lastValidatedAt: now,
      features: result.features ?? [],
      expiresAt: result.expires_at ?? null,
    };

    // Mirror to settings KV so legacy code paths still find the
    // fingerprint and tier after a hard restart.
    await setSetting('license_tier', license.tier);
    await setSetting('license_key_fingerprint', license.keyFingerprint ?? '');
    await setSetting('license_activated_at', now);
    await setSetting('license_status', 'active');
    await setSetting('license_last_validated_at', now);
    await setSetting('license_trial_started_at', '');

    set({ license, error: null });
    return license;
  },

  setTier: async (tier: LicenseTier) => {
    await setSetting('license_tier', tier);
    const current = get().license ?? { ...EMPTY_LICENSE_STATE };
    const license: LicenseState = {
      ...current,
      tier,
      status: 'active',
    };
    set({ license });
    return license;
  },

  refresh: async () => {
    return get().init();
  },

  revalidate: async () => {
    try {
      const result = await licenseAdapter.validateLicense();
      const current = get().license;
      if (!current) return null;
      const updated = validationToState(result, current);
      const now = Date.now();
      set({ license: updated, lastValidatedAt: now });
      await setSetting(
        'license_last_validated_at',
        updated.lastValidatedAt ?? new Date().toISOString(),
      );
      return updated;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Validation failed' });
      return null;
    }
  },

  deactivate: async () => {
    // Try the backend first; ignore failures so the local state
    // can still be cleared even if the backend is unreachable.
    try {
      await licenseAdapter.deactivateLicense();
    } catch (e) {
      console.warn('[license] backend deactivate failed; clearing local only', e);
    }

    await setSetting('license_tier', 'basic');
    await setSetting('license_key_fingerprint', '');
    await setSetting('license_activated_at', '');
    await setSetting('license_trial_started_at', '');
    await setSetting('license_status', 'active');
    await setSetting('license_last_validated_at', '');

    set({ license: { ...EMPTY_LICENSE_STATE } });
  },

  isPro: () => {
    const l = get().license;
    return !!l && (l.tier === 'pro' || l.tier === 'enterprise');
  },
  isTrial: () => {
    const l = get().license;
    if (!l) return false;
    // Either the legacy "trial" tier, or we have a trial start date
    return (
      l.tier === 'trial' ||
      (l.trialStartedAt !== null && l.tier === 'pro' && (l.trialDaysRemaining ?? 0) > 0)
    );
  },
  isExpired: () => {
    const l = get().license;
    return !!l && l.status === 'expired';
  },
  isGrace: () => {
    const l = get().license;
    return !!l && l.status === 'grace';
  },
  hasTier: (minTier: LicenseTier) => {
    const l = get().license;
    if (!l) return false;
    return TIER_RANK[l.tier] >= TIER_RANK[minTier];
  },
}));

// ---------------------------------------------------------------------------
// Pure helpers (kept for back-compat with FeatureGate)
// ---------------------------------------------------------------------------

/** Pure helper to check tier rank — used in FeatureGate */
export function tierMeets(current: LicenseTier, required: LicenseTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

function fingerprintFromValidationKey(key: string, _result: { tier: BackendTier | null }): string {
  const cleaned = key.replace(/\s+/g, '').toUpperCase();
  const groups = cleaned.split(/[-:]/).filter(Boolean);
  const last = groups[groups.length - 1] ?? '';
  if (last.length < 4) return `..${last.toUpperCase()}`;
  return `..${last.slice(-4).toUpperCase()}`;
}
