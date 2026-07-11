/**
 * LicensePort — Port (interface) for the licensing subsystem.
 *
 * This is the Clean Architecture boundary between the domain
 * (store, hooks, UI) and the concrete Tauri backend. UI code MUST
 * depend on this interface only — never on a concrete adapter — so
 * the licensing system can be mocked in tests and swapped to a
 * different transport (e.g. a hosted REST API) without touching the
 * callers.
 *
 * Mirrors `src-tauri/src/licensing/license.rs` Tauri command surface.
 */

import type {
  LicenseInfo,
  LicenseTier,
  LicenseValidationResult,
} from '@features/settings/types/license';

export interface LicensePort {
  /** Get the stable hardware fingerprint for this device. */
  getHardwareId(): Promise<string>;

  /** Get the currently active license, if any. */
  getLicenseInfo(): Promise<LicenseInfo | null>;

  /**
   * Activate a license key. Returns a validation result. Throws on
   * signature/expiry/hardware-binding failure.
   */
  activateLicense(key: string): Promise<LicenseValidationResult>;

  /**
   * Validate the currently active license against the embedded
   * public key and current hardware. Returns a result describing
   * whether the license is still valid, expired, or unbound.
   */
  validateLicense(): Promise<LicenseValidationResult>;

  /**
   * Deactivate the currently active license on this device.
   * Returns a deactivation token (backend copy) so the user can
   * prove they deactivated and free up a seat.
   */
  deactivateLicense(): Promise<string>;

  /**
   * Generate a signed test license. Only callable in dev/debug builds;
   * the production adapter throws in release mode.
   */
  generateTestLicense(tier: LicenseTier, issuedTo: string, daysValid: number): Promise<string>;

  /** Check whether the current license tier unlocks a named feature. */
  checkFeatureAccess(feature: string): Promise<boolean>;
}
