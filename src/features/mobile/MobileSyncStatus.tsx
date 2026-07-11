import { Cloud, CloudOff, Loader2, Check } from "lucide-react";
import { useSyncStore } from "@shared/stores/syncStore";

interface MobileSyncStatusProps {
  className?: string;
}

export function MobileSyncStatus({ className = "" }: MobileSyncStatusProps) {
  const isOnline = useSyncStore((s) => s.isOnline);
  const isSyncingFolder = useSyncStore((s) => s.isSyncingFolder);
  const pendingOpsCount = useSyncStore((s) => s.pendingOpsCount);

  const isSyncing = isSyncingFolder !== null;

  if (!isOnline) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-warning ${className}`}
        role="status"
        aria-live="polite"
      >
        <CloudOff size={14} className="shrink-0" aria-hidden="true" />
        <span>Offline</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-accent ${className}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (pendingOpsCount > 0) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-text-tertiary ${className}`}
        role="status"
        aria-live="polite"
      >
        <Cloud size={14} className="shrink-0" aria-hidden="true" />
        <span>{pendingOpsCount} pending</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-success ${className}`}
      role="status"
      aria-live="polite"
    >
      <Check size={14} className="shrink-0" aria-hidden="true" />
      <span>Synced</span>
    </div>
  );
}
