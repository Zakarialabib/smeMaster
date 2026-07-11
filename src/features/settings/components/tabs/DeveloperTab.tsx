import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshCw,
  Download,
  Database,
  Loader2,
  CheckCircle,
  Trash2,
  AlertTriangle,
  Terminal,
  Search,
  AlertCircle,
  AlertTriangle as AlertTriangleIcon,
  Info,
  Bug,
  ChevronDown,
  Copy,
  X,
  Cpu,
  Monitor,
  Globe,
  Code2,
  Zap,
  Package,
  HardDrive,
  Activity,
  FileText,
} from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { notify } from "@shared/services/notifications/toastHelper";
import { useLogs, useClearLogs } from "@shared/hooks/useLogs";
import type { LogEntry } from "@shared/services/logger";
import { cn } from "@shared/utils/cn";
import SubsystemStatusPanel from "@features/settings/components/SubsystemStatusPanel";

// ── Log Level Filter Type ──────────────────────────────────────────────────
type LogFilterLevel = "error" | "warning" | "info" | "debug" | "critical";

// ── Log Level Config ─────────────────────────────────────────────────────────
const LOG_LEVEL_CONFIG: Record<
  LogFilterLevel,
  { icon: React.ElementType; label: string; color: string; bg: string; border: string; badge: string }
> = {
  critical: {
    icon: AlertCircle,
    label: "Critical",
    color: "text-danger",
    bg: "bg-danger/10",
    border: "border-l-danger",
    badge: "bg-danger text-white",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    color: "text-danger",
    bg: "bg-danger/5",
    border: "border-l-danger",
    badge: "bg-danger/90 text-white",
  },
  warning: {
    icon: AlertTriangleIcon,
    label: "Warning",
    color: "text-warning",
    bg: "bg-warning/5",
    border: "border-l-warning",
    badge: "bg-warning text-white",
  },
  info: {
    icon: Info,
    label: "Info",
    color: "text-info",
    bg: "bg-info/5",
    border: "border-l-info",
    badge: "bg-info text-white",
  },
  debug: {
    icon: Terminal,
    label: "Debug",
    color: "text-text-tertiary",
    bg: "bg-bg-tertiary",
    border: "border-l-border",
    badge: "bg-text-secondary text-bg-primary",
  },
};

// ── Copy Helper ──────────────────────────────────────────────────────────────
const copyToClipboard = async (text: string, label: string) => {
  try {
    const { copyToClipboard: clip } = await import("@shared/hooks/useClipboard");
    await clip(text);
    notify(label, "Copied to clipboard");
  } catch {
    notify(label, "Failed to copy");
  }
};

// ── Log Row Component ──────────────────────────────────────────────────────
const LogRow = ({ log }: { log: LogEntry }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = LOG_LEVEL_CONFIG[log.level as LogFilterLevel] || LOG_LEVEL_CONFIG.info;

  const getContextLabel = (category?: string) => {
    if (!category) return "System";
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const handleCopyData = async () => {
    if (!log.data) return;
    const text = JSON.stringify(log.data, null, 2);
    await copyToClipboard(text, "Log Data");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasData = !!log.data && Object.keys(log.data).length > 0;

  return (
    <div
      className={cn(
        "group border-l-[3px] mb-1.5 rounded-r-lg transition-all duration-200",
        "hover:shadow-sm hover:translate-x-0.5",
        config.bg,
        config.border,
        isExpanded && "bg-bg-tertiary/80 ring-1 ring-inset ring-border shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 p-3 cursor-pointer select-none",
          !hasData && "cursor-default"
        )}
        onClick={() => hasData && setIsExpanded(!isExpanded)}
      >
        {/* Level Icon */}
        <div className="shrink-0 mt-0.5">
          <config.icon className={cn("w-4 h-4", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", config.badge)}>
              {log.level}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-bg-tertiary text-[10px] font-semibold text-text-tertiary border border-border">
              {getContextLabel(log.category)}
            </span>
            <span className="text-[10px] font-mono text-text-tertiary opacity-60 tabular-nums ml-auto md:ml-0">
              {new Date(log.timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
          <span className="text-sm text-text-secondary leading-snug wrap-break-words">
            {log.message}
          </span>
        </div>

        {/* Expand Indicator */}
        {hasData && (
          <div
            className={cn(
              "shrink-0 p-1 rounded-full transition-all duration-200",
              "text-text-tertiary group-hover:text-text-secondary group-hover:bg-bg-tertiary",
              isExpanded && "rotate-180 bg-bg-tertiary text-text-primary"
            )}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Expanded Data */}
      {isExpanded && hasData && (
        <div className="px-3 pb-3 pt-0">
          <div className="relative group/data">
            <div className="absolute top-2 right-2 opacity-0 group-hover/data:opacity-100 transition-opacity z-10">
              <button
                onClick={handleCopyData}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-medium text-text-secondary backdrop-blur-sm border border-white/10 transition-colors"
              >
                {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>
            <div className="p-3 bg-black/90 rounded-lg text-[11px] text-success font-mono overflow-auto max-h-64 custom-scrollbar shadow-inner border border-white/5">
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Info Card Component ────────────────────────────────────────────────────
const InfoCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) => (
  <div
    className={cn(
      "flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50 border border-border/50",
      "hover:border-border hover:bg-bg-tertiary transition-all duration-200 group"
    )}
  >
    <div className="p-2 rounded-lg bg-bg-primary border border-border/50 text-text-tertiary group-hover:text-text-secondary transition-colors">
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-text-primary font-mono truncate">
          {value || <span className="animate-pulse">...</span>}
        </p>
        {value && (
          <button
            onClick={() => copyToClipboard(value, label)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
            title="Copy"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  </div>
);

// ── Status Badge ───────────────────────────────────────────────────────────
const StatusBadge = ({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "success" | "warning" | "info" | "neutral";
}) => {
  const variants = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info: "bg-accent/10 text-accent border-accent/20",
    neutral: "bg-bg-tertiary text-text-tertiary border-border",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", variants[variant])}>
      {variant === "success" && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
      {children}
    </span>
  );
};

// ── Health Dashboard Types & Helpers ────────────────────────────────────
interface DbHealthStats {
  dbSizeBytes: number;
  walSizeBytes: number;
  uptimeSecs: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
};

export default function DeveloperTab() {
  const [appVersion, setAppVersion] = useState("");
  const [tauriVersion, setTauriVersion] = useState("");
  const [webviewVersion, setWebviewVersion] = useState("");
  const [platformLabel, setPlatformLabel] = useState("...");
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateCheckDone, setUpdateCheckDone] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);

  useEffect(() => {
    async function load() {
      const { getVersion, getTauriVersion } = await import("@tauri-apps/api/app");
      setAppVersion(await getVersion());
      setTauriVersion(await getTauriVersion());

      const ua = navigator.userAgent;
      const edgMatch = /Edg\/(\S+)/.exec(ua);
      const chromeMatch = /Chrome\/(\S+)/.exec(ua);
      const webkitMatch = /AppleWebKit\/(\S+)/.exec(ua);
      setWebviewVersion(edgMatch?.[1] ?? chromeMatch?.[1] ?? webkitMatch?.[1] ?? "Unknown");

      if (/mac/i.test(ua)) {
        setPlatformLabel(/arm|aarch/i.test(ua) ? "macOS (Apple Silicon)" : "macOS (Intel)");
      } else if (/win/i.test(ua)) {
        setPlatformLabel(/arm|aarch/i.test(ua) ? "Windows (ARM)" : "Windows (x64)");
      } else if (/linux/i.test(ua)) {
        setPlatformLabel("Linux");
      } else {
        setPlatformLabel("Unknown");
      }

      const { getAvailableUpdate } = await import("@shared/services/updateManager");
      const existing = getAvailableUpdate();
      if (existing) setUpdateVersion(existing.version);
    }
    load();
  }, []);

  const handleCheckForUpdate = async () => {
    setCheckingForUpdate(true);
    setUpdateCheckDone(false);
    setUpdateVersion(null);
    try {
      const { checkForUpdateNow } = await import("@shared/services/updateManager");
      const result = await checkForUpdateNow();
      if (result) {
        setUpdateVersion(result.version);
      } else {
        setUpdateCheckDone(true);
      }
    } catch (err) {
      console.error("Update check failed:", err);
      setUpdateCheckDone(true);
    } finally {
      setCheckingForUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    setInstallingUpdate(true);
    try {
      const { installUpdate } = await import("@shared/services/updateManager");
      await installUpdate();
    } catch (err) {
      console.error("Update install failed:", err);
      setInstallingUpdate(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [seedResult, setSeedResult] = useState("");

  const handleSeedDemo = useCallback(async () => {
    setSeeding(true);
    setSeedDone(false);
    setSeedResult("");
    try {
      // Clear any existing seed flags first so seed can run fresh
      const { invokeCommand } = await import("@shared/services/db/invoke/command");
      const result = await invokeCommand<{ seeded: number }>("db_reseed_demo");
      const msg = result.seeded > 0
        ? `Seeded ${result.seeded} records`
        : "Demo data already exists — skipped";
      setSeedResult(msg);
      setSeedDone(true);
      notify("Demo Data", msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Seed failed";
      setSeedResult(msg);
      setSeedDone(true);
      notify("Demo Data", `Failed: ${msg}`);
    } finally {
      setSeeding(false);
    }
  }, []);

  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  // ── Logs State ────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<LogFilterLevel[]>([
    "error",
    "warning",
    "info",
    "debug",
  ]);

  const { data: logItems, isLoading: logsLoading, refetch } = useLogs({
    limit: 100,
    filters: activeFilters,
    searchQuery,
  });

  useEffect(() => {
    if (logItems) {
      setLogs(logItems);
    }
  }, [logItems]);

  const clearLogsMutation = useClearLogs();

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all system logs?")) return;
    try {
      await clearLogsMutation.mutateAsync();
      refetch();
    } catch (err) {
      notify("Logs", `Failed to clear logs: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const toggleFilter = (level: LogFilterLevel) => {
    setActiveFilters((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const handleResetDb = useCallback(async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    setResetting(true);
    try {
      const { invokeCommand } = await import("@shared/services/db/invoke/command");
      await invokeCommand("reset_app");
      // App restarts — code below won't execute
    } catch (err) {
      notify("Reset DB", `Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setResetting(false);
      setResetConfirm(false);
    }
  }, [resetConfirm]);

  const { t } = useTranslation();

  // ── Health Dashboard State ──────────────────────────────────────────
  const [healthStats, setHealthStats] = useState<DbHealthStats>({
    dbSizeBytes: 0,
    walSizeBytes: 0,
    uptimeSecs: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const { invokeCommand } = await import("@shared/services/db/invoke/command");
        const stats = await invokeCommand<DbHealthStats>("db_health_stats");
        if (!cancelled) setHealthStats(stats);
      } catch {
        // Silently ignore — health stats are non-critical
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Export Logs Handler ─────────────────────────────────────────────
  const handleExportLogs = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: `smemaster-logs-${Date.now()}.txt`,
        filters: [
          { name: "Text Files", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!path) return;
      const { invokeCommand } = await import("@shared/services/db/invoke/command");
      await invokeCommand("db_export_logs", { destination: path });
      notify("Logs", "Logs exported successfully");
    } catch (err) {
      notify("Logs", `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ── Health Dashboard ──────────────────────────────────────────── */}
      <SettingGroup
        title="Health Dashboard"
        description="Real-time observability metrics for the app runtime."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard label="Database Size" value={formatFileSize(healthStats.dbSizeBytes)} icon={Database} />
          <InfoCard label="WAL File Size" value={formatFileSize(healthStats.walSizeBytes)} icon={Database} />
          <InfoCard label="Uptime" value={formatUptime(healthStats.uptimeSecs)} icon={Activity} />
          <InfoCard label="Cache Status" value="Active" icon={Activity} />
        </div>
      </SettingGroup>

      {/* ── App Info ───────────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.appInfo")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard label={t("settings.version")} value={appVersion} icon={Package} />
          <InfoCard label={t("settings.tauriVersion")} value={tauriVersion} icon={Cpu} />
          <InfoCard label={t("settings.webviewVersion")} value={webviewVersion} icon={Globe} />
          <InfoCard label={t("settings.platform")} value={platformLabel} icon={Monitor} />
        </div>
      </SettingGroup>

      {/* ── Subsystem Status ────────────────────────────────────────────── */}
      <SubsystemStatusPanel />

      {/* ── Updates ────────────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.updates")}>
        <div className="flex items-center justify-between p-1">
          <div className="space-y-1">
            <span className="text-sm font-medium text-text-secondary">
              {t("settings.softwareUpdates")}
            </span>
            <div className="flex items-center gap-2">
              {updateVersion && (
                <StatusBadge variant="info">
                  <Zap className="w-3 h-3" />
                  {t("settings.updateAvailable", { version: updateVersion })}
                </StatusBadge>
              )}
              {updateCheckDone && !updateVersion && (
                <StatusBadge variant="success">
                  <CheckCircle className="w-3 h-3" />
                  {t("settings.upToDate")}
                </StatusBadge>
              )}
              {checkingForUpdate && (
                <StatusBadge variant="neutral">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </StatusBadge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {updateVersion ? (
              <Button
                variant="primary"
                size="md"
                icon={<Download size={14} />}
                onClick={handleInstallUpdate}
                disabled={installingUpdate}
              >
                {installingUpdate ? t("settings.updating") : t("settings.updateAndRestart")}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="md"
                icon={
                  <RefreshCw
                    size={14}
                    className={cn(checkingForUpdate && "animate-spin")}
                  />
                }
                onClick={handleCheckForUpdate}
                disabled={checkingForUpdate}
              >
                {checkingForUpdate ? t("common.checking") : t("settings.checkForUpdates")}
              </Button>
            )}
          </div>
        </div>
      </SettingGroup>

      {/* ── Demo Data ───────────────────────────────────────────────────── */}
      <SettingGroup
        title="Demo Data"
        description="Seed the database with comprehensive demo data for testing."
      >
        <div className="flex items-center justify-between p-1">
          <div className="space-y-1">
            <span className="text-sm font-medium text-text-secondary">
              Seed accounts, labels, threads, messages, contacts, tasks, and more
            </span>
            {seedDone && seedResult && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  seedResult.includes("Failed") ? "text-danger" : "text-success"
                )}
              >
                <CheckCircle size={12} />
                {seedResult}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="md"
            icon={
              seeding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Database size={14} />
              )
            }
            onClick={handleSeedDemo}
            disabled={seeding}
          >
            {seeding ? "Seeding..." : "Seed Demo Data"}
          </Button>
        </div>
      </SettingGroup>

      {/* ── Developer Tools ─────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.developerTools")}>
        <div className="flex items-center justify-between p-1">
          <div className="space-y-1">
            <span className="text-sm font-medium text-text-secondary">
              {t("settings.openDevtools")}
            </span>
            <p className="text-xs text-text-tertiary">
              {t("settings.openDevtoolsDescription")}
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            icon={<Code2 size={14} />}
            onClick={async () => {
              const { invokeCommand } = await import("@shared/services/db/invoke/command");
              await invokeCommand("open_devtools");
            }}
          >
            {t("settings.openDevtools")}
          </Button>
        </div>
      </SettingGroup>

      {/* ── Feature Flags ──────────────────────────────────────────────── */}
      <SettingGroup title="Feature Flags">
        <p className="text-xs text-text-tertiary mb-3">
          View feature access status and test tier-based progressive disclosure.
          Feature flags control which capabilities are available based on your
          subscription tier and usage limits.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<Code2 size={14} />}
            onClick={async () => {
              const { navigateToSettings } = await import("@/router/navigate");
              navigateToSettings("feature-flags");
            }}
            className="bg-bg-tertiary text-text-primary border border-border-primary"
          >
            Open Feature Flags Dashboard
          </Button>
        </div>
        <HelpCard
          collapsible
          items={[
            { type: "why", text: "Developer tools give you deep visibility into app health, logs, database state, and feature flags — essential for troubleshooting and performance tuning." },
            { type: "how", text: "Health dashboard shows real-time metrics. Subsystem panel reports component status. Logs capture filtered app events. Feature flags control tier access." },
            { type: "when", text: "Use developer tools when diagnosing issues, checking update status, monitoring subsystem health, or testing feature flag behavior." },
            { type: "tip", text: "Export logs before clearing them if you're investigating a recurring issue — they can be shared with support for faster resolution." },
          ]}
        />
      </SettingGroup>

      {/* ── Logs Section ─────────────────────────────────────────────────── */}
      <SettingGroup title="System Logs">
        <div className="border border-border rounded-2xl bg-card overflow-hidden flex flex-col h-[520px] shadow-sm">
          {/* Toolbar */}
          <div className="p-4 border-b border-border/50 bg-bg-tertiary/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-text-primary">Activity Stream</h3>
                <p className="text-[10px] text-text-tertiary">Real-time application events</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={logsLoading}
                className="h-8 w-8 p-0"
                title="Refresh"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", logsLoading && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearLogs}
                className="h-8 px-2.5 text-danger hover:bg-danger/10 hover:text-danger"
                title="Clear all logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-xs">Clear</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportLogs}
                className="h-8 px-2.5 text-text-secondary hover:bg-bg-tertiary"
                title="Export logs to file"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="text-xs">Export</span>
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="px-4 py-3 border-b border-border/50 bg-bg-tertiary/10 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search messages, components, or data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 h-9 w-full bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 p-1 bg-bg-tertiary rounded-xl border border-border shrink-0">
              {(["error", "warning", "info", "debug"] as LogFilterLevel[]).map((level) => {
                const config = LOG_LEVEL_CONFIG[level];
                const isActive = activeFilters.includes(level);
                return (
                  <button
                    key={level}
                    onClick={() => toggleFilter(level)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5",
                      isActive
                        ? cn(config.badge, "shadow-sm scale-105")
                        : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
                    )}
                  >
                    <config.icon className="w-3 h-3" />
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Log List */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-bg-primary/50">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center space-y-4">
                <div className="p-4 rounded-2xl bg-bg-tertiary border border-border/50">
                  <Bug className="w-8 h-8 text-text-tertiary opacity-30" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-text-tertiary">
                    No matching events
                  </p>
                  <p className="text-xs text-text-tertiary max-w-[240px]">
                    Adjust your filters or search query to find what you're looking for.
                  </p>
                </div>
                {searchQuery && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <LogRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-bg-tertiary/50 border-t border-border flex items-center justify-between">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              {logs.length} {logs.length === 1 ? "event" : "events"} displayed
            </span>
            <div className="flex items-center gap-2 text-[10px] font-medium text-text-tertiary uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Live
            </div>
          </div>
        </div>
      </SettingGroup>

      {/* ── Reset Database ─────────────────────────────────────────────── */}
      <SettingGroup
        title="Reset Database"
        description="Delete all data and restart the app. After restart, use 'Seed Demo Data' above to repopulate."
      >
        <div
          className={cn(
            "rounded-xl border transition-all duration-300",
            resetConfirm
              ? "border-danger/50 bg-danger/5 p-4"
              : "border-transparent p-1"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg shrink-0",
                  resetConfirm ? "bg-danger/10 text-danger" : "bg-bg-tertiary text-text-tertiary"
                )}
              >
                {resetConfirm ? <AlertTriangle size={18} /> : <HardDrive size={18} />}
              </div>
              <div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    resetConfirm ? "text-danger" : "text-text-secondary"
                  )}
                >
                  {resetConfirm
                    ? "This action is irreversible. All data will be lost."
                    : "Delete database, reset to clean state, and restart"}
                </span>
                {resetConfirm && (
                  <p className="text-xs text-danger/80 mt-0.5">
                    Click "Confirm Reset" to proceed. The app will restart immediately.
                  </p>
                )}
              </div>
            </div>
            <Button
              variant={resetConfirm ? "danger" : "secondary"}
              size="md"
              icon={
                resetting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )
              }
              onClick={handleResetDb}
              disabled={resetting}
            >
              {resetting ? "Resetting..." : resetConfirm ? "Confirm Reset" : "Reset Database"}
            </Button>
          </div>
        </div>
      </SettingGroup>
    </div>
  );
}