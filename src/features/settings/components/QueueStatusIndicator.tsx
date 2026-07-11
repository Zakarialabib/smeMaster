import { useState, useEffect } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { useSyncStore } from "@shared/stores/syncStore";
import { getQueuePaused } from "@features/settings/db/settings";
import { getPendingOpsCount } from "@features/settings/db/pendingOperations";

export function QueueStatusIndicator() {
  const pendingOpsCount = useSyncStore((s) => s.pendingOpsCount);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const [count, pausedState] = await Promise.all([
          getPendingOpsCount(),
          getQueuePaused(),
        ]);
        if (!mounted) return;
        useSyncStore.getState().setPendingOpsCount(count);
        setPaused(pausedState);
      } catch {
        // silently ignore poll errors
      }
    }

    poll();
    const interval = setInterval(poll, 10_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Nothing to show — no pending ops and not paused
  if (pendingOpsCount === 0 && !paused) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      {paused ? (
        <span className="flex items-center gap-1.5 text-xs text-warning">
          <Pause size={12} />
          Queue paused
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
          <Clock size={12} />
          <span className="text-accent font-medium">{pendingOpsCount}</span>
          pending
        </span>
      )}
      {!paused && pendingOpsCount > 0 && (
        <span className="flex items-center gap-1 text-xs text-success">
          <Play size={10} />
          running
        </span>
      )}
    </div>
  );
}
