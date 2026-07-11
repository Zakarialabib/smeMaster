/**
 * LicenseTauriAdapter — Concrete adapter that bridges LicensePort
 * to the Rust licensing commands exposed by Tauri.
 *
 * Mirrors `src-tauri/src/licensing/license.rs`:
 *   - get_hardware_id            -> getHardwareId
 *   - get_license_info           -> getLicenseInfo
 *   - activate_license           -> activateLicense
 *   - validate_license           -> validateLicense
 *   - deactivate_license         -> deactivateLicense
 *   - generate_test_license      -> generateTestLicense (debug only)
 *   - check_feature_access       -> checkFeatureAccess
 *
 * All methods are defensive:
 *   - If Tauri is unavailable (e.g. running in `vite dev` with no
 *     Tauri host), they return sensible defaults so the UI doesn't
 *     blow up during development.
 *   - Errors are logged via console.warn so they don't get swallowed
 *     silently but also don't block the UI thread.
 */

import { invokeCommand } from '@shared/services/db/invoke/command';
import type { LicensePort } from '@core/ports/LicensePort';
import type {
  LicenseInfo,
  LicenseTier,
  LicenseValidationResult,
} from '@features/settings/types/license';

/** Detect whether the Tauri host is available at runtime. */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class LicenseTauriAdapter implements LicensePort {
  async getHardwareId(): Promise<string> {
    if (!isTauri()) return 'web-mode-hardware-id';
    try {
      const id = await invokeCommand<string>('get_hardware_id');
      return id ?? '';
    } catch (error) {
      console.warn('[license] getHardwareId failed', error);
      return '';
    }
  }

  async getLicenseInfo(): Promise<LicenseInfo | null> {
    if (!isTauri()) return null;
    try {
      return await invokeCommand<LicenseInfo | null>('get_license_info');
    } catch (error) {
      console.error('[license] getLicenseInfo failed', error);
      return null;
    }
  }

  async activateLicense(key: string): Promise<LicenseValidationResult> {
    if (!isTauri()) {
      throw new Error('License activation is only available in the desktop app.');
    }
    if (!key || !key.trim()) {
      throw new Error('License key is required.');
    }
    try {
      return await invokeCommand<LicenseValidationResult>('activate_license', {
        licenseKey: key.trim(),
      });
    } catch (error) {
      console.error('[license] activateLicense failed', error);
      throw error instanceof Error
        ? error
        : new Error(String(error) ?? 'License activation failed');
    }
  }

  async validateLicense(): Promise<LicenseValidationResult> {
    if (!isTauri()) {
      return {
        valid: false,
        tier: null,
        expires_at: null,
        hardware_id_bound: false,
        message: 'License validation is only available in the desktop app.',
        features: [],
      };
    }
    try {
      return await invokeCommand<LicenseValidationResult>('validate_license');
    } catch (error) {
      console.error('[license] validateLicense failed', error);
      return {
        valid: false,
        tier: null,
        expires_at: null,
        hardware_id_bound: false,
        message: error instanceof Error ? error.message : 'Validation failed',
        features: [],
      };
    }
  }

  async deactivateLicense(): Promise<string> {
    if (!isTauri()) {
      throw new Error('License deactivation is only available in the desktop app.');
    }
    try {
      return await invokeCommand<string>('deactivate_license');
    } catch (error) {
      console.error('[license] deactivateLicense failed', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async generateTestLicense(
    tier: LicenseTier,
    issuedTo: string,
    daysValid: number,
  ): Promise<string> {
    if (!isTauri()) {
      throw new Error('Test license generation is only available in the desktop app.');
    }
    try {
      return await invokeCommand<string>('generate_test_license', {
        tier,
        issuedTo,
        daysValid,
      });
    } catch (error) {
      console.error('[license] generateTestLicense failed', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async checkFeatureAccess(feature: string): Promise<boolean> {
    if (!isTauri()) return true; // permissive in web dev
    try {
      return await invokeCommand<boolean>('check_feature_access', { feature });
    } catch (error) {
      console.warn('[license] checkFeatureAccess failed', error);
      return false;
    }
  }
}

/** Shared singleton — same shape as Simple-Signage's `licenseAdapter`. */
export const licenseAdapter = new LicenseTauriAdapter();
