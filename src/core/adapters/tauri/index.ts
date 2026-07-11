/**
 * Public surface of the licensing core (ports + adapters).
 *
 * UI code imports from here so it can be swapped between transport
 * implementations (Tauri, REST, mock) without changes.
 */

export { LicenseTauriAdapter, licenseAdapter } from './LicenseTauriAdapter';
