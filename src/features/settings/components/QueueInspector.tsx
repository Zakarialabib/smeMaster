import { useState, useEffect, useCallback } from "react";
import { Clock, Pause, Play, RefreshCw, RotateCcw, Trash2, AlertCircle, CheckCircle, Loader, Hourglass, XCircle } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { notify } from "@shared/services/notifications/toastHelper";
import { useSyncStore } from "@shared/stores/syncStore";
import { executeSearchQuery, deletePendingOpsByIds } from "@/shared/services/db/db-invoke";
import { getPendingOpsCount, getFailedOpsCount, clearFailedOperations, retryFailedOperations } from "@features/settings/db/pendingOperations";
import { stopQueueProcessor, startQueueProcessor } from "@features/mail/services/queue/queueProcessor";
import { getQueuePaused, setQueuePaused, getQueueSchedule, setQueueSchedule, getQueueSchedulePresets } from "@features/settings/db/settings";
import type { QueueSchedule, QueueSchedulePreset } from "@features/settings/db/settings";

interface QueueOperation {
  id: string;
  account_id: string;
  operation_type: string;
  resource_id: string;
  params: string;
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: number | null;
  created_at: number;
  error_message: string | null;
  campaign_id: string | null;
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Hourglass,
  executing: Loader,
  sent: CheckCircle,
  failed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-warning",
  executing: "text-accent",
  sent: "text-success",
  failed: "text-danger",
};

const PRESET_LABELS: Record<QueueSchedulePreset, string> = {
  fast: "Fast (10s)",
  normal: "Normal (30s)",
  gentle: "Gentle (2min)",
  "business-hours": "Business Hours",
  custom: "Custom",
};

export function QueueInspector() {
  const pendingOpsCount = useSyncStore((s) => s.pendingOpsCount);
  const [operations, setOperations] = useState<QueueOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [schedule, setSchedule] = useState<QueueSchedule>({ preset: "normal", intervalMs: 30_000 });
  const [realFailedCount, setRealFailedCount] = useState(0);

  const loadOperations = useCallback(async () => {
    try {
      const [rows, failedCount] = await Promise.all([
        executeSearchQuery(
          "SELECT * FROM pending_operations ORDER BY created_at DESC LIMIT 100",
          [],
        ) as unknown as QueueOperation[],
        getFailedOpsCount(),
      ]);
      setOperations(rows);
      setRealFailedCount(failedCount);
    } catch (err) {
      console.error("Failed to load queue operations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOperations();
    getQueuePaused().then(setPaused);
    getQueueSchedule().then(setSchedule);
    const interval = setInterval(loadOperations, 10_000);
    return () => clearInterval(interval);
  }, [loadOperations]);

  async function handlePauseResume() {
    if (paused) {
      startQueueProcessor();
      setPaused(false);
      await setQueuePaused(false);
      notify("Queue", "Queue processor resumed.");
    } else {
      stopQueueProcessor();
      setPaused(true);
      await setQueuePaused(true);
      notify("Queue", "Queue processor paused.");
    }
  }

  async function handlePresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const presets = getQueueSchedulePresets();
    const selectedPreset = e.target.value as QueueSchedulePreset;
    const newSchedule = presets[selectedPreset];
    if (!newSchedule) return;
    await setQueueSchedule(newSchedule);
    setSchedule(newSchedule);
    stopQueueProcessor();
    await startQueueProcessor();
    notify("Queue", `Schedule changed to ${PRESET_LABELS[selectedPreset]}.`);
  }

  async function handleRetryFailed() {
    await retryFailedOperations();
    await loadOperations();
    await updatePendingCount();
    notify("Queue", "Retrying all failed operations.");
  }

  async function handleClearFailed() {
    await clearFailedOperations();
    await loadOperations();
    await updatePendingCount();
    notify("Queue", "Cleared all failed operations.");
  }

  async function handleDeleteOp(id: string) {
    await deletePendingOpsByIds([id]);
    await loadOperations();
    await updatePendingCount();
    notify("Queue", "Operation removed from queue.");
  }

  async function updatePendingCount() {
    const count = await getPendingOpsCount();
    useSyncStore.getState().setPendingOpsCount(count);
  }

  const filteredOps = filter === "all" ? operations : operations.filter((o) => o.status === filter);

  const counts = {
    all: operations.length,
    pending: operations.filter((o) => o.status === "pending").length,
    executing: operations.filter((o) => o.status === "executing").length,
    failed: operations.filter((o) => o.status === "failed").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-text-primary font-medium">
          <Clock size={16} />
          Queue Inspector
          <span className="text-xs text-text-tertiary font-normal">({pendingOpsCount} pending)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Schedule preset selector */}
          <select
            value={schedule.preset}
            onChange={handlePresetChange}
            className="px-2 py-1 text-xs bg-bg-secondary border border-border-primary rounded-lg text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            {Object.entries(PRESET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <Button
              variant={paused ? "primary" : "secondary"}
              size="sm"
              icon={paused ? <Play size={14} /> : <Pause size={14} />}
              onClick={handlePauseResume}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={handleRetryFailed}
              disabled={counts.failed === 0}
            >
              Retry Failed
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={handleClearFailed}
              disabled={counts.failed === 0}
              className="hover:text-danger"
            >
              Clear Failed
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<RefreshCw size={14} />}
              onClick={loadOperations}
              title="Refresh"
              aria-label="Refresh"
            />
          </div>
        </div>
      </div>

      {/* Schedule info line */}
      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <span>Interval: {schedule.intervalMs >= 60_000 ? `${schedule.intervalMs / 60_000}min` : `${schedule.intervalMs / 1_000}s`}</span>
        {schedule.businessHoursOnly && (
          <span className="flex items-center gap-1 text-warning">
            <Clock size={10} />
            Business hours only
          </span>
        )}
        {schedule.minSendGapMs && schedule.minSendGapMs > 0 ? (
          <span>Min gap: {schedule.minSendGapMs >= 1_000 ? `${schedule.minSendGapMs / 1_000}s` : `${schedule.minSendGapMs}ms`}</span>
        ) : null}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1">
        {(["all", "pending", "executing", "failed"] as const).map((key) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? "bg-accent/10 text-accent border border-accent/30"
                : "text-text-tertiary hover:text-text-secondary border border-transparent"
            }
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
            <span className="ms-1 text-[0.625rem] opacity-60">({counts[key]})</span>
          </Button>
        ))}
      </div>

      {/* Queue table */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-text-tertiary">
          <Loader size={16} className="animate-spin me-2" />
          Loading queue...
        </div>
      ) : filteredOps.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Queue is empty" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-tertiary border-b border-border-primary">
                <th className="text-start py-2 px-2 font-medium">Type</th>
                <th className="text-start py-2 px-2 font-medium">Status</th>
                <th className="text-start py-2 px-2 font-medium">Resource</th>
                <th className="text-start py-2 px-2 font-medium">Campaign</th>
                <th className="text-start py-2 px-2 font-medium">Created</th>
                <th className="text-start py-2 px-2 font-medium">Retries</th>
                <th className="text-start py-2 px-2 font-medium">Error</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filteredOps.map((op) => {
                const StatusIcon = STATUS_ICONS[op.status] ?? Clock;
                const statusColor = STATUS_COLORS[op.status] ?? "text-text-tertiary";
                return (
                  <tr key={op.id} className="border-b border-border-primary hover:bg-bg-hover transition-colors group">
                    <td className="py-2 px-2 text-text-primary font-mono text-xs">{op.operation_type}</td>
                    <td className="py-2 px-2">
                      <span className={`flex items-center gap-1 text-xs ${statusColor}`}>
                        <StatusIcon size={12} className={op.status === "executing" ? "animate-spin" : ""} />
                        {op.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-text-secondary text-xs max-w-[160px] truncate" title={op.resource_id}>
                      {op.resource_id}
                    </td>
                    <td className="py-2 px-2 text-text-secondary text-xs">
                      {op.campaign_id ? (
                        <span className="font-mono text-[0.625rem]">{op.campaign_id.slice(0, 12)}...</span>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-text-tertiary text-xs">
                      {new Date(op.created_at * 1000).toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-text-tertiary text-xs">
                      {op.retry_count}/{op.max_retries}
                    </td>
                    <td className="py-2 px-2 text-xs max-w-[200px] truncate" title={op.error_message ?? ""}>
                      {op.error_message ? (
                        <span className="text-danger flex items-center gap-1">
                          <AlertCircle size={10} />
                          {op.error_message}
                        </span>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<XCircle size={12} />}
                        onClick={() => handleDeleteOp(op.id)}
                        className="text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100"
                        title="Remove from queue"
                        aria-label="Remove from queue"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {realFailedCount > counts.failed && (
        <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger">
          <AlertCircle size={14} />
          {realFailedCount - counts.failed} additional failed operation{realFailedCount - counts.failed !== 1 ? "s" : ""} not shown (limit: 100)
        </div>
      )}

      {paused && (
        <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning">
          <Pause size={14} />
          Queue is paused. New operations will accumulate until resumed.
        </div>
      )}
    </div>
  );
}
