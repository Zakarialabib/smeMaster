import { useState, useEffect } from "react";
import { useSyncStore } from "@shared/stores/syncStore";

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<number | null>(null);

  const isOnline = useSyncStore((s) => s.isOnline);
  const setOnline = useSyncStore((s) => s.setOnline);

  useEffect(() => {
    const handleOnline = () => {
      setWasOffline(true);
      setLastOnlineAt(Date.now());
      setOnline(true);
    };
    const handleOffline = () => {
      setLastOfflineAt(Date.now());
      setOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial state
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  return { isOnline, wasOffline, lastOnlineAt, lastOfflineAt };
}
