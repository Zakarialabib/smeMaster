/**
 * SystemHealthTab — settings tab wrapper for HealthDashboard.
 *
 * Renders the HealthDashboard inside a settings-friendly layout
 * so it can be registered in SettingsTabRegistry.
 */
import HealthDashboard from "./HealthDashboard";

export default function SystemHealthTab() {
  return <HealthDashboard />;
}
