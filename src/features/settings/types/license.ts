/**
 * License Types — Frontend ↔ Backend contract
 *
 * These types MUST stay in sync with the Rust types in
 * `src-tauri/src/licensing/license.rs`. The backend uses serde to
 * serialize these as snake_case in some places and PascalCase in others
 * — we accept both shapes on the frontend to be defensive.
 */

export type LicenseTier = 'free' | 'professional' | 'enterprise';

export type LicenseStatus = 'active' | 'expired' | 'trial' | 'none' | 'grace' | 'invalid';

/** Tier rank for comparison. Higher = more access. */
export const TIER_RANK: Record<LicenseTier, number> = {
  free: 0,
  professional: 1,
  enterprise: 2,
};

/** Aliases the existing UI code uses (basic = free, pro = professional) */
export type LicenseTierAlias = 'trial' | 'basic' | 'pro' | 'enterprise';

export const TIER_RANK_ALIAS: Record<LicenseTierAlias, number> = {
  trial: 0,
  basic: 0, // 'basic' maps to 'free'
  pro: 1, // 'pro' maps to 'professional'
  enterprise: 2,
};

/** Map a backend tier to the UI's friendly alias */
export function tierToAlias(tier: LicenseTier | null | undefined): LicenseTierAlias {
  if (tier === 'professional') return 'pro';
  if (tier === 'enterprise') return 'enterprise';
  return 'basic';
}

/** Map a UI alias to the backend tier */
export function aliasToTier(alias: LicenseTierAlias): LicenseTier | null {
  if (alias === 'pro') return 'professional';
  if (alias === 'enterprise') return 'enterprise';
  if (alias === 'basic') return 'free';
  return null;
}

/**
 * LicenseInfo — mirrors `crate::licensing::license::LicenseInfo`
 *
 * Both snake_case (as serialized by serde) and camelCase (defensive
 * fallback) are accepted.
 */
export interface LicenseInfo {
  key: string;
  tier: LicenseTier;
  issued_to: string;
  issued_to_legacy?: string; // alias
  issuedAt?: string;
  issued_at?: string;
  expires_at?: string | null;
  expiresAt?: string | null;
  hardware_id?: string | null;
  hardwareId?: string | null;
  features: string[];
  is_active: boolean;
  isActive?: boolean;
  status?: LicenseStatus;
  activation_date?: string;
  activationDate?: string;
  pro_cap?: number | null;
  proCap?: number | null;
  camera_limit?: number | null;
  cameraLimit?: number | null;
}

/**
 * LicenseValidationResult — mirrors
 * `crate::licensing::license::LicenseValidationResult`
 */
export interface LicenseValidationResult {
  valid: boolean;
  tier: LicenseTier | null;
  expires_at: string | null;
  expiresAt?: string | null;
  hardware_id_bound: boolean;
  hardwareIdBound?: boolean;
  message: string;
  features: string[];
}

/**
 * Unified license state as used by the frontend store.
 * Combines backend LicenseInfo with the legacy settings-store shape
 * so the existing LicenseTab/LicenseBanner continue to work.
 */
export interface LicenseState {
  tier: LicenseTierAlias;
  status: LicenseStatus;
  trialTier: LicenseTierAlias | null;
  trialDaysRemaining: number | null;
  graceDaysRemaining: number | null;
  keyFingerprint: string | null;
  hardwareId: string | null;
  activatedAt: string | null;
  trialStartedAt: string | null;
  lastValidatedAt: string | null;
  features: string[];
  expiresAt: string | null;
}

/**
 * Default empty license state — fresh install, no license, no trial.
 */
export const EMPTY_LICENSE_STATE: LicenseState = {
  tier: 'basic',
  status: 'active',
  trialTier: null,
  trialDaysRemaining: null,
  graceDaysRemaining: null,
  keyFingerprint: null,
  hardwareId: null,
  activatedAt: null,
  trialStartedAt: null,
  lastValidatedAt: null,
  features: [],
  expiresAt: null,
};

/** Feature identifiers exposed by the licensing system. */
export const LICENSE_FEATURES = {
  EMAIL_SYNC: 'email_sync',
  BASIC_CRM: 'basic_crm',
  CONTACT_MANAGEMENT: 'contact_management',
  TASK_BASIC: 'task_basic',
  EMAIL_AUTOMATION: 'email_automation',
  ADVANCED_CRM: 'advanced_crm',
  REPORTING_BASIC: 'reporting_basic',
  PIPELINE_MANAGEMENT: 'pipeline_management',
  REPORTING_ADVANCED: 'reporting_advanced',
  API_ACCESS: 'api_access',
} as const;

export type LicenseFeature = (typeof LICENSE_FEATURES)[keyof typeof LICENSE_FEATURES];

/**
 * Normalize a raw LicenseInfo (from the backend) into the
 * frontend-friendly LicenseState. Defensive against both naming
 * conventions and missing fields.
 */
export function licenseInfoToState(info: LicenseInfo | null): LicenseState {
  if (!info) return EMPTY_LICENSE_STATE;

  const tier = info.tier ?? 'free';
  const expiresAt = info.expires_at ?? info.expiresAt ?? null;
  const hardwareId = info.hardware_id ?? info.hardwareId ?? null;
  const isActive = info.is_active ?? info.isActive ?? true;
  const activatedAt =
    info.activation_date ?? info.activationDate ?? info.issued_at ?? info.issuedAt ?? null;

  // Trial is implicit: if the key looks trial-y OR no key + tier is professional
  // we leave that to the store's init logic which checks trial_started_at.
  const status: LicenseStatus = !isActive
    ? 'expired'
    : expiresAt && new Date(expiresAt) < new Date()
      ? 'expired'
      : 'active';

  return {
    tier: tierToAlias(tier),
    status,
    trialTier: null,
    trialDaysRemaining: null,
    graceDaysRemaining: null,
    keyFingerprint: fingerprintFromKey(info.key),
    hardwareId,
    activatedAt,
    trialStartedAt: null,
    lastValidatedAt: null,
    features: info.features ?? [],
    expiresAt,
  };
}

/**
 * Convert a validation result into LicenseState. Used when the store
 * pings `validate_license` on startup.
 */
export function validationToState(
  result: LicenseValidationResult,
  fallback: LicenseState,
): LicenseState {
  if (!result.valid) {
    return { ...fallback, status: 'expired' };
  }
  const tier = result.tier ?? 'free';
  return {
    ...fallback,
    tier: tierToAlias(tier),
    status: 'active',
    features: result.features ?? fallback.features,
    expiresAt: result.expires_at ?? result.expiresAt ?? null,
    lastValidatedAt: new Date().toISOString(),
    hardwareId: result.hardware_id_bound ? fallback.hardwareId : null,
  };
}

/**
 * Extract a fingerprint (last 4 chars) from a license key.
 * Handles XXXX-XXXX-XXXX-XXXX and colon-delimited backend formats.
 */
function fingerprintFromKey(key: string | undefined | null): string | null {
  if (!key) return null;
  // Strip a signature suffix (backend uses :signature) — keep the body
  const body = key.split(':')[0] ?? key;
  // Find the last meaningful segment
  const segments = body.split(/[-:]/).filter(Boolean);
  const last = segments[segments.length - 1] ?? '';
  if (last.length < 4) return `..${last.toUpperCase()}`;
  return `..${last.slice(-4).toUpperCase()}`;
}
