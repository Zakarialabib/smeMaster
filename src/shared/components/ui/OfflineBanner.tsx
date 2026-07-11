import { useEffect, useRef, useState } from "react";
import { useSyncStore } from "@shared/stores/syncStore";
import { WifiOff, Check } from "lucide-react";
import "@shared/styles/mobile-animations.css";

export function OfflineBanner() {
  const isOnline = useSyncStore((s) => s.isOnline);
  const prevIsOnline = useRef(isOnline);
  const [showReconnected, setShowReconnected] = useState(false);

  // Detect offline→online transition and show a brief reconnection flash
  useEffect(() => {
    if (prevIsOnline.current === false && isOnline === true) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 2000);
      return () => clearTimeout(timer);
    } else if (prevIsOnline.current === true && isOnline === false) {
      // Went offline during reconnection flash — clear it immediately
      setShowReconnected(false);
    }
    prevIsOnline.current = isOnline;
  }, [isOnline]);

  // Show reconnection flash when coming back online
  if (showReconnected && isOnline) {
    return (
      <div
        className="fixed top-8 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-success/90 text-white text-xs px-4 py-1.5 backdrop-blur-sm shadow-sm reconnect-animate"
        role="status"
        aria-live="assertive"
      >
        <Check size={14} aria-hidden="true" />
        <span>Reconnected!</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed top-8 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-warning/90 text-white text-xs px-4 py-1.5 backdrop-blur-sm shadow-sm">
        <WifiOff size={14} />
        <span>You're offline — changes will sync when you reconnect</span>
      </div>
    );
  }

  return null;
}
