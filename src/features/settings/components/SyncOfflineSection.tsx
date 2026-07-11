import { useState, useCallback, useEffect } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { useTranslation } from "react-i18next";
import { RefreshCw, Activity, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { InlineTooltip } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { eventBus } from "@shared/services/events/eventBus";

interface SyncHealthSummary {
  total_syncs: number;
  failed_syncs: number;
  success_rate_percent: number;
  last_error: string | null;
  last_sync_at: number | null;
}

export default function SyncOfflineSection() {
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Sync health state
  const [health, setHealth] = useState<SyncHealthSummary | null>(null);
  const [heartbeatHealthy, setHeartbeatHealthy] = useState(true);
  const [secondsSinceHeartbeat, setSecondsSinceHeartbeat] = useState<number | null>(null);
  const [maintenanceResult, setMaintenanceResult] = useState<{ pruned: number; remaining: number } | null>(null);
  const [maintaining, setMaintaining] = useState(false);

  const loadCounts = useCallback(async () => {
    const { getPendingOpsCount, getFailedOpsCount } = await import("@features/settings/db/pendingOperations");
    setPendingCount(await getPendingOpsCount());
    setFailedCount(await getFailedOpsCount());
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const result = await invokeCommand<SyncHealthSummary>("get_sync_health_summary");
      setHealth(result);
    } catch {
      // Silently fail – health monitoring is optional
    }
  }, []);

  const loadHeartbeat = useCallback(() => {
    const status = eventBus.getHeartbeatStatus();
    setHeartbeatHealthy(status.isHealthy);
    setSecondsSinceHeartbeat(status.secondsSinceLastHeartbeat);
  }, []);

  const handleMaintenance = async () => {
    setMaintaining(true);
    setMaintenanceResult(null);
    try {
      const result = await invokeCommand<{ pruned_count: number; remaining_count: number }>("sync_log_maintenance");
      setMaintenanceResult({ pruned: result.pruned_count, remaining: result.remaining_count });
      await loadHealth();
    } catch {
      // Silently fail
    } finally {
      setMaintaining(false);
    }
  };

  useEffect(() => {
    loadCounts();
    loadHealth();
    loadHeartbeat();

    const hbInterval = setInterval(loadHeartbeat, 10_000);
    return () => {
      clearInterval(hbInterval);
    };
  }, [loadCounts, loadHealth, loadHeartbeat]);

  const handleRetryFailed = async () => {
    setLoading(true);
    try {
      const { retryFailedOperations } = await import("@features/settings/db/pendingOperations");
      await retryFailedOperations();
      await loadCounts();
    } finally {
      setLoading(false);
    }
  };

  const handleClearFailed = async () => {
    setLoading(true);
    try {
      const { clearFailedOperations } = await import("@features/settings/db/pendingOperations");
      await clearFailedOperations();
      await loadCounts();
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: number | null): string => {
    if (!ts) return "Never";
    return new Date(ts * 1000).toLocaleString();
  };

  const getHealthColor = (rate: number): string => {
    if (rate >= 90) return "text-green-500";
    if (rate >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <SettingGroup title={t('settings.syncAndOffline')}>
      <div className="space-y-6">
        {/* Event Pipeline Health */}
        <div className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-text-tertiary" />
          <span className="text-text-secondary">Event Pipeline:</span>
          <InlineTooltip text="The event pipeline processes incoming and outgoing email operations. Heartbeats indicate whether the background sync worker is actively processing." />
          <div className={`flex items-center gap-1 ${heartbeatHealthy ? "text-green-500" : "text-red-500"}`}>
            {heartbeatHealthy ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{heartbeatHealthy ? "Healthy" : "Stale"}</span>
          </div>
          {secondsSinceHeartbeat !== null && (
            <span className="text-text-tertiary text-xs">({secondsSinceHeartbeat}s ago)</span>
          )}
        </div>

        {/* Sync Health Summary */}
        {health && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-xs text-text-tertiary">Total Syncs</div>
              <div className="font-semibold">{health.total_syncs}</div>
            </div>
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-xs text-text-tertiary">Failed</div>
              <div className="font-semibold">{health.failed_syncs}</div>
            </div>
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-xs text-text-tertiary">Success Rate</div>
              <div className={`font-semibold ${getHealthColor(health.success_rate_percent)}`}>
                {health.success_rate_percent.toFixed(1)}%
              </div>
            </div>
            <div className="bg-bg-secondary rounded p-2">
              <div className="text-xs text-text-tertiary">Last Sync</div>
              <div className="text-xs">{formatTimestamp(health.last_sync_at)}</div>
            </div>
          </div>
        )}

        {/* Maintenance Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleMaintenance}
            disabled={maintaining}
            variant="secondary"
            size="sm"
          >
            {maintaining ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Clean Old Logs
          </Button>
          <Button
            onClick={loadHealth}
            variant="secondary"
            size="sm"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>

        {maintenanceResult && (
          <div className="text-xs text-green-500">
            Pruned {maintenanceResult.pruned} entries. {maintenanceResult.remaining} remaining.
          </div>
        )}

        {/* Original pending/failed operations */}
        <div className="space-y-3 pt-2 border-t border-border-primary">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-text-secondary">{t('settings.pendingOperations')}</span>
              <InlineTooltip text="Operations queued for sync when the device regains connectivity. These are stored in the local Tauri database and processed sequentially." />
              <p className="text-xs text-text-tertiary mt-0.5">
                {t('settings.pendingOperationsDescription')}
              </p>
            </div>
            <span className="text-sm font-mono text-text-primary">{pendingCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-text-secondary">{t('settings.failedOperations')}</span>
              <InlineTooltip text="Operations that could not be processed after multiple retry attempts. Review and retry or clear them to maintain sync health." />
              <p className="text-xs text-text-tertiary mt-0.5">
                {t('settings.failedOperationsDescription')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-text-primary">{failedCount}</span>
              {failedCount > 0 && (
                <>
                  <Button
                    onClick={handleRetryFailed}
                    disabled={loading}
                    variant="ghost"
                    size="sm"
                    className="text-accent"
                  >
                    {t('settings.retry')}
                  </Button>
                  <Button
                    onClick={handleClearFailed}
                    disabled={loading}
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                  >
                    {t('settings.clear')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingGroup>
  );
}
