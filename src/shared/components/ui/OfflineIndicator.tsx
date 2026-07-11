import { useState, useEffect, useCallback } from "react";
import { WifiOff } from "lucide-react";

/**
 * OfflineIndicator – a small bar at the top of the screen that appears
 * when the browser reports the device is offline.
 *
 * Uses `window.navigator.onLine` and listens for `online`/`offline`
 * events.  Auto-hides with a slide animation when back online.
 */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(() => !window.navigator.onLine);
  const [visible, setVisible] = useState(() => !window.navigator.onLine);

  const handleOnline = useCallback(() => {
    setOffline(false);
    // Let the slide-up animation play before unmounting
    setTimeout(() => setVisible(false), 300);
  }, []);

  const handleOffline = useCallback(() => {
    setVisible(true);
    // Allow the DOM to render before marking offline (avoids flash)
    requestAnimationFrame(() => setOffline(true));
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync with current state on mount (e.g. if connection restored while component was unmounted)
    const isOffline = !window.navigator.onLine;
    setOffline(isOffline);
    setVisible(isOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-danger/90 backdrop-blur-sm transition-all duration-300 ${
        offline
          ? "translate-y-0 opacity-100"
          : "-translate-y-full opacity-0"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <WifiOff size={14} aria-hidden="true" />
      <span>You're offline</span>
    </div>
  );
}
