/**
 * HealthDashboard
 *
 * A settings tab panel showing a card grid of all background services with
 * status indicators, heartbeat info, uptime, and restart controls.
 *
 * Data is sourced from the real backend via `db_status_snapshot` (orchestrator
 * subsystem statuses), polled every 30 seconds. When the backend is
 * unavailable (e.g. browser dev server) a clear empty state is shown instead
 * of fabricated data.
 */
import { useEffect, useMemo } from "react";
import {
  RefreshCw,
  Server,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
} from "lucide-react";
import { useHealthStore } from "../stores/healthStore";
import type { ServiceHealth } from "../stores/healthStore";
import { cn } from "@shared/utils/cn";
import { Button } from "@shared/components/ui/Button";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { formatRelativeDate } from "@shared/utils/date";

// ── Status configuration ────────────────────────────────────────────────

const STATUS_STYLES: Record<
  ServiceHealth["status"],
  { dot: string; bg: string; label: string }
> = {
  running: {
    dot: "bg-success",
    bg: "bg-success/10",
    label: "Running",
  },
  degraded: {
    dot: "bg-warning",
    bg: "bg-warning/10",
    label: "Degraded",
  },
  stopped: {
    dot: "bg-danger",
    bg: "bg-danger/10",
    label: "Stopped",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatUptime(ms: number | null): string {
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function getSeverityCounts(services: ServiceHealth[]) {
  return {
    running: services.filter((s) => s.status === "running").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    stopped: services.filter((s) => s.status === "stopped").length,
  };
}

// ── Service Card ─────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceHealth }) {
  const style = STATUS_STYLES[service.status];

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-200 hover:shadow-sm",
        service.status === "stopped"
          ? "border-danger/20 bg-danger/[0.02]"
          : service.status === "degraded"
            ? "border-warning/20 bg-warning/[0.02]"
            : "border-border-primary bg-bg-secondary/50",
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("p-1.5 rounded-lg shrink-0", style.bg)}>
            <Server size={14} className="text-text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {service.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn("w-1.5 h-1.5 rounded-full", style.dot)}
              />
              <span className="text-[10px] text-text-tertiary">
                {style.label}
              </span>
            </div>
          </div>
        </div>

        {/* Restart is managed automatically by the orchestrator watchdog;
            no public restart IPC exists yet, so the control is disabled. */}
        <Button
          variant="ghost"
          size="xs"
          disabled
          className="shrink-0 opacity-40 cursor-not-allowed"
          aria-label={`Restart ${service.name} (managed automatically)`}
          title="Restart is managed automatically by the watchdog"
        >
          <Play size={12} />
        </Button>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-tertiary flex items-center gap-1">
            <Clock size={10} className="shrink-0" />
            Uptime
          </span>
          <span className="text-text-secondary font-mono">
            {formatUptime(service.uptimeMs)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-tertiary flex items-center gap-1">
            <Activity size={10} className="shrink-0" />
            Last heartbeat
          </span>
          <span className="text-text-secondary font-mono">
            {service.lastHeartbeat
              ? formatRelativeDate(service.lastHeartbeat)
              : "—"}
          </span>
        </div>
      </div>

      {/* Error message */}
      {service.error && (
        <div className="mt-2 flex items-start gap-1.5 text-[10px] text-danger bg-danger/5 rounded-lg px-2 py-1.5">
          <AlertCircle size={10} className="shrink-0 mt-0.5" />
          <span>{service.error}</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function HealthDashboard() {
  const services = useHealthStore((s) => s.services);
  const loading = useHealthStore((s) => s.loading);
  const lastRefreshed = useHealthStore((s) => s.lastRefreshed);
  const backendAvailable = useHealthStore((s) => s.backendAvailable);
  const refresh = useHealthStore((s) => s.refresh);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const counts = useMemo(() => getSeverityCounts(services), [services]);

  const allRunning = counts.stopped === 0 && counts.degraded === 0;
  const degradedCount = counts.degraded + counts.stopped;

  const showEmptyState = !loading && services.length === 0;

  return (
    <div className="space-y-6">
      <SettingGroup
        title="System Health"
        description="Monitor background services, uptime, and heartbeat status."
      >
        {/* Master status bar */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3 mb-4",
            allRunning && services.length > 0
              ? "border-success/20 bg-success/[0.02]"
              : "border-warning/20 bg-warning/[0.02]",
          )}
        >
          <div className="flex items-center gap-3">
            {allRunning && services.length > 0 ? (
              <CheckCircle2 size={18} className="text-success shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-warning shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-text-primary">
                {showEmptyState
                  ? "Service status unavailable"
                  : allRunning
                    ? "All systems running"
                    : `${degradedCount} service${degradedCount > 1 ? "s" : ""} degraded`}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-text-tertiary">
                  {counts.running} running
                </span>
                {counts.degraded > 0 && (
                  <span className="text-[10px] text-warning">
                    {counts.degraded} degraded
                  </span>
                )}
                {counts.stopped > 0 && (
                  <span className="text-[10px] text-danger">
                    {counts.stopped} stopped
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-[10px] text-text-tertiary hidden sm:block">
                Updated {formatRelativeDate(lastRefreshed)}
              </span>
            )}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void refresh()}
              disabled={loading}
              className="shrink-0"
              aria-label="Refresh service status"
            >
              <RefreshCw
                size={14}
                className={cn(loading && "animate-spin")}
              />
              <span className="ml-1 hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Service cards grid */}
        {loading && services.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-text-tertiary gap-2">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Loading service status...</span>
          </div>
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-text-tertiary gap-1">
            <Server size={20} className="opacity-50" />
            <span className="text-xs">
              {backendAvailable
                ? "No background services are currently reporting status."
                : "Service health is available in the desktop app."}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </SettingGroup>
    </div>
  );
}
