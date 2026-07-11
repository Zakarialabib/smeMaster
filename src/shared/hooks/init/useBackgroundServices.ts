import { useEffect, useState } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";

/**
 * Result of the `db_init_background_services` Rust command.
 */
interface ServiceOwnership {
  owner: string;
  services: string[];
  already_running: boolean;
}

/**
 * Phase 8: Observe background service ownership.
 *
 * Calls the Rust `db_init_background_services` command which confirms
 * that all background services (snooze, follow-up, queue, pre-cache,
 * scheduled send, bundle, update checker) are running under Rust ownership.
 *
 * React does NOT start or manage services — Rust owns the lifecycle.
 * This hook only observes and logs the result.
 *
 * Returns ownership info that can be displayed in a debug overlay.
 */
export function useBackgroundServices(): {
  ownedBy: string | null;
  services: string[];
  error: string | null;
} {
  const [ownedBy, setOwnedBy] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const result = await invokeCommand<ServiceOwnership>("db_init_background_services");
        if (cancelled) return;
        setOwnedBy(result.owner);
        setServices(result.services);
        console.log(
          `[init] Background services owned by "${result.owner}":`,
          result.services.join(", "),
          result.already_running ? "(already running)" : "(fresh start)",
        );
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[init] Failed to init background services:", msg);
        setError(msg);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ownedBy, services, error };
}