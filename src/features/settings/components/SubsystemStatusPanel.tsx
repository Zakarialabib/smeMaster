/**
 * SubsystemStatusPanel — Debug UI for SubsystemRegistry observability.
 *
 * Displays all registered subsystems with their current FSM state,
 * class, uptime, and error information. Polls every 30s by default
 * with a manual refresh button.
 */
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Power,
  PowerOff,
  Zap,
  Activity,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { useSubsystemStatus } from "@shared/hooks/useSubsystemStatus";
import type { SubsystemStatusResponse } from "@shared/services/ipc/CommandRegistry";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { cn } from "@shared/utils/cn";
import { Button } from "@shared/components/ui/Button";

// ── Status Config ────────────────────────────────────────────────────────────
interface StatusStyle {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  dot: string;
}

const STATUS_CONFIG: Record<string, StatusStyle> = {
  active: {
    icon: CheckCircle2,
    label: "Active",
    color: "text-success",
    bg: "bg-success/10",
    dot: "bg-success",
  },
  dormant: {
    icon: Clock,
    label: "Dormant",
    color: "text-warning",
    bg: "bg-warning/10",
    dot: "bg-warning",
  },
  starting: {
    icon: Loader2,
    label: "Starting",
    color: "text-info",
    bg: "bg-info/10",
    dot: "bg-info",
  },
  shutting_down: {
    icon: PowerOff,
    label: "Shutting Down",
    color: "text-text-tertiary",
    bg: "bg-bg-tertiary",
    dot: "bg-text-tertiary",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-danger",
    bg: "bg-danger/10",
    dot: "bg-danger",
  },
  inactive: {
    icon: Power,
    label: "Inactive",
    color: "text-text-tertiary",
    bg: "bg-bg-tertiary/50",
    dot: "bg-text-tertiary/30",
  },
  unknown: {
    icon: HelpCircle,
    label: "Unknown",
    color: "text-text-tertiary",
    bg: "bg-bg-tertiary",
    dot: "bg-text-tertiary",
  },
};

function getStatusConfig(status: string): StatusStyle {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown!;
}

// ── Class Badge ──────────────────────────────────────────────────────────────
function ClassBadge({ cls }: { cls: string }) {
  const variants: Record<string, string> = {
    always_on: "bg-accent/10 text-accent border-accent/20",
    lazy: "bg-info/10 text-info border-info/20",
    on_demand: "bg-warning/10 text-warning border-warning/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
        variants[cls] || "bg-bg-tertiary text-text-tertiary border-border",
      )}
    >
      {cls === "always_on" ? <Activity className="w-2.5 h-2.5 mr-1" /> : null}
      {cls === "lazy" ? <Clock className="w-2.5 h-2.5 mr-1" /> : null}
      {cls === "on_demand" ? <Zap className="w-2.5 h-2.5 mr-1" /> : null}
      {cls?.replace("_", " ") || "unknown"}
    </span>
  );
}

// ── Single Subsystem Row ─────────────────────────────────────────────────────
function SubsystemRow({ subsystem }: { subsystem: SubsystemStatusResponse }) {
  const config = getStatusConfig(subsystem.status);
  const Icon = config.icon;

  const formatUptime = (secs?: number): string => {
    if (secs === undefined) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200",
        "hover:shadow-sm",
        subsystem.status === "failed"
          ? "border-danger/20 bg-danger/[0.02]"
          : subsystem.status === "active"
            ? "border-success/20 bg-success/[0.02]"
            : "border-border/50 bg-bg-secondary/30",
      )}
    >
      {/* Status icon */}
      <div className={cn("p-1.5 rounded-lg shrink-0", config.bg)}>
        <Icon
          className={cn(
            "w-4 h-4",
            config.color,
            subsystem.status === "starting" && "animate-spin",
          )}
        />
      </div>

      {/* Name + class */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {subsystem.name.replace(/_/g, " ")}
          </span>
          <ClassBadge cls={subsystem.class} />
        </div>
        <p className="text-[10px] text-text-tertiary mt-0.5 flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
          {config.label}
          {subsystem.status === "active" && subsystem.uptime_secs !== undefined && (
            <>
              <span className="text-text-tertiary/50">·</span>
              <span className="font-mono">{formatUptime(subsystem.uptime_secs)}</span>
            </>
          )}
          {subsystem.status === "failed" && subsystem.error && (
            <>
              <span className="text-text-tertiary/50">·</span>
              <span className="text-danger font-mono truncate max-w-[200px]" title={subsystem.error}>
                {subsystem.error}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Feature flag badge */}
      {subsystem.feature_flag && (
        <span className="hidden sm:inline-flex text-[9px] font-mono text-text-tertiary bg-bg-tertiary/50 px-1.5 py-0.5 rounded border border-border/30">
          {subsystem.feature_flag}
        </span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function SubsystemStatusPanel() {
  const { statuses, loading, error, refresh } = useSubsystemStatus(30000);

  const statusCounts = {
    active: statuses.filter((s: SubsystemStatusResponse) => s.status === "active").length,
    failed: statuses.filter((s: SubsystemStatusResponse) => s.status === "failed").length,
    dormant: statuses.filter((s: SubsystemStatusResponse) => s.status === "dormant").length,
  };

  return (
    <SettingGroup
      title="Subsystem Status"
      description="Live state-machine status for all registered subsystems (AlwaysOn, Lazy, OnDemand)."
    >
      {/* Summary bar */}
      {!loading && statuses.length > 0 && (
        <div className="flex items-center gap-4 mb-3 px-1">
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <span className="font-semibold text-text-primary">{statuses.length}</span> total
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-success" />
            {statusCounts.active} active
          </div>
          {statusCounts.dormant > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
              <span className="w-2 h-2 rounded-full bg-warning" />
              {statusCounts.dormant} dormant
            </div>
          )}
          {statusCounts.failed > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
              <span className="w-2 h-2 rounded-full bg-danger" />
              {statusCounts.failed} failed
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-[10px] text-danger ml-auto">
              <AlertTriangle className="w-3 h-3" />
              Poll error
            </div>
          )}
        </div>
      )}

      {/* Refresh button */}
      <div className="flex items-center justify-end mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-8 px-3"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Status list */}
      {loading && statuses.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-text-tertiary gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading subsystem status...</span>
        </div>
      ) : statuses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <div className="p-3 rounded-2xl bg-bg-tertiary border border-border/50">
            <RotateCcw className="w-6 h-6 text-text-tertiary/40" />
          </div>
          <p className="text-sm text-text-tertiary">No subsystems registered</p>
          <p className="text-[10px] text-text-tertiary/60">
            Subsystems appear here once they are registered in SubsystemRegistry.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {statuses.map((subsystem: SubsystemStatusResponse) => (
            <SubsystemRow key={subsystem.name} subsystem={subsystem} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-4 mt-3 px-1 pt-2 border-t border-border/30 text-[9px] text-text-tertiary">
        <span className="font-semibold uppercase tracking-wider">Classes</span>
        <span className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-accent" /> AlwaysOn
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-info" /> Lazy
        </span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-warning" /> OnDemand
        </span>
      </div>
    </SettingGroup>
  );
}
