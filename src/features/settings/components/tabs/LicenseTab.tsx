/**
 * LicenseTab — Settings tab entry point for license management.
 *
 * Thin wrapper that mounts the full `LicensePage` in embedded mode
 * (no internal page header — the settings tab UI provides that).
 *
 * This file is kept as the canonical entry point for the settings
 * tab registry; all logic lives in `LicensePage` so updates happen
 * in one place.
 */

import { LicensePage } from '@shared/components/license/LicensePage';

export default function LicenseTab() {
  return <LicensePage embedded />;
}
