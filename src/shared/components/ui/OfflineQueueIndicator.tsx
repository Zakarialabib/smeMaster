import { useState } from "react";
import { ChevronDown, ChevronUp, X, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useSyncStore } from "@shared/stores/syncStore";
import { useQueueProgressStore } from "@shared/stores/queueProgressStore";

export function OfflineQueueIndicator() {
  const [expanded, setExpanded] = useState(false);
  const pendingOpsCount = useSyncStore((s) => s.pendingOpsCount);
  const isOnline = useSyncStore((s) => s.isOnline);
  const { activeProgress, completedCount, failedCount, totalCount } = useQueueProgressStore();

  if (pendingOpsCount === 0 && activeProgress.length === 0) return null;

  const allDone = totalCount > 0 && completedCount + failedCount >= totalCount;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-warning/90 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs text-white">
        <span className="inline-block w-2 h-2 rounded-full bg-white/60 animate-pulse" />
        <span>
          {isOnline
            ? `Syncing ${pendingOpsCount} item${pendingOpsCount !== 1 ? "s" : ""}...`
            : `${pendingOpsCount} operation${pendingOpsCount !== 1 ? "s" : ""} queued`}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 text-white/70 hover:text-white transition-colors"
          title={expanded ? "Hide details" : "Show details"}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {allDone && (
          <button
            onClick={() => { setExpanded(false); useQueueProgressStore.getState().clearProgress(); }}
            className="p-0.5 text-white/70 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {expanded && activeProgress.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-t border-white/10">
          <div className="px-4 py-1.5 space-y-1">
            {activeProgress.map((op) => (
              <div key={op.operationId} className="flex items-center gap-2 text-xs text-white/80">
                {op.status === "processing" && <Loader2 size={10} className="animate-spin shrink-0 text-accent" />}
                {op.status === "completed" && <CheckCircle size={10} className="shrink-0 text-success" />}
                {op.status === "failed" && <XCircle size={10} className="shrink-0 text-danger" />}
                <span className="truncate flex-1">{op.operationType.replace(/_/g, " ")}</span>
                {op.message && (
                  <span className="text-white/50 truncate max-w-[200px]" title={op.message}>
                    {op.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
