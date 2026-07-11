import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useSyncStore } from "@shared/stores/syncStore";

interface MobileOfflineBannerProps {
  className?: string;
}

/**
 * Enhanced offline banner for mobile that shows when the device is offline.
 * Auto-hides with a slide-down animation when reconnected.
 *
 * Unlike the global OfflineBanner, this includes:
 * - Animated entrance/exit
 * - Sync queue count
 * - Safe area inset support for notched phones
 */
export function MobileOfflineBanner({ className = "" }: MobileOfflineBannerProps) {
  const isOnline = useSyncStore((s) => s.isOnline);
  const pendingOpsCount = useSyncStore((s) => s.pendingOpsCount);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      // Slide in
      requestAnimationFrame(() => {
        setVisible(true);
        setAnimating(true);
      });
    } else if (visible) {
      // Slide out
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOnline, visible]);

  if (!visible && isOnline) return null;

  return (
    <div
      className={`
        fixed left-0 right-0 z-50 flex items-center justify-center gap-2
        bg-warning/90 text-white text-xs px-4 py-2 backdrop-blur-sm shadow-sm
        transition-transform duration-300 ease-out
        ${animating ? "translate-y-0" : "-translate-y-full"}
        ${className}
      `}
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
      }}
      role="alert"
      aria-live="assertive"
    >
      <WifiOff size={14} aria-hidden="true" />
      <span className="font-medium">
        You're offline
        {pendingOpsCount > 0 && (
          <span className="ml-1 opacity-80">
            — {pendingOpsCount} {pendingOpsCount === 1 ? "change" : "changes"} pending
          </span>
        )}
      </span>
    </div>
  );
}
