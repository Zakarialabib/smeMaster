import { useState, useEffect, useCallback } from "react";
import { getSubsystemStatus } from "@shared/services/ipc/invoke";
import type { SubsystemStatusResponse } from "@shared/services/ipc/CommandRegistry";

export type { SubsystemStatusResponse };

export function useSubsystemStatus(refreshIntervalMs = 30000) {
  const [statuses, setStatuses] = useState<SubsystemStatusResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const result = await getSubsystemStatus();
      setStatuses(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetch, refreshIntervalMs]);

  return { statuses, loading, error, refresh: fetch };
}
