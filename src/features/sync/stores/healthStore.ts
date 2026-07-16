/**
 * Health Store — tracks background service health.
 *
 * In production this is populated from the real backend via the
 * `db_status_snapshot` IPC command, which returns the orchestrator's
 * subsystem statuses. The previous hardcoded `MOCK_SERVICES` seed has been
 * removed so that fake data is never presented as real in a production build.
 *
 * A mock fallback is kept ONLY for `import.meta.env.DEV` (browser dev server
 * without a compiled Tauri backend) so local UI work still has something to
 * render. It is never shipped to production.
 */
import { create } from "zustand";
import { invokeCommand } from "@shared/services/db/invoke/command";
import type { DbStatusSnapshot, SubsystemStatusSnapshot } from "@shared/services/commands";

export interface ServiceHealth {
  id: string;
  name: string;
  status: "running" | "degraded" | "stopped";
  lastHeartbeat: number | null;
  uptimeMs: number | null;
  error?: string;
}

interface HealthState {
  services: ServiceHealth[];
  loading: boolean;
  lastRefreshed: number | null;
  /** False when the backend is unreachable (e.g. browser dev server). */
  backendAvailable: boolean;
  setServices: (services: ServiceHealth[]) => void;
  updateService: (id: string, patch: Partial<ServiceHealth>) => void;
  refresh: () => Promise<void>;
}

/** Dev-only mock so local UI work has data without a compiled backend. */
const DEV_MOCK_SERVICES: ServiceHealth[] = [
  {
    id: "email-sync",
    name: "Email Sync",
    status: "running",
    lastHeartbeat: Date.now() - 5_000,
    uptimeMs: 4 * 3600 * 1000 + 23 * 60 * 1000,
  },
  {
    id: "idle-watchdog",
    name: "IDLE Watchdog",
    status: "running",
    lastHeartbeat: Date.now() - 12_000,
    uptimeMs: 8 * 3600 * 1000,
  },
  {
    id: "background-sync",
    name: "Background Sync",
    status: "running",
    lastHeartbeat: Date.now() - 60_000,
    uptimeMs: 2 * 3600 * 1000 + 15 * 60 * 1000,
  },
  {
    id: "oauth-monitor",
    name: "OAuth Monitor",
    status: "running",
    lastHeartbeat: Date.now() - 30_000,
    uptimeMs: 12 * 3600 * 1000,
  },
  {
    id: "push-notifications",
    name: "Push Notifications",
    status: "degraded",
    lastHeartbeat: Date.now() - 5 * 60 * 1000,
    uptimeMs: 6 * 3600 * 1000,
    error: "Reconnection attempt 3/5 failed",
  },
  {
    id: "calendar-sync",
    name: "Calendar Sync",
    status: "running",
    lastHeartbeat: Date.now() - 45_000,
    uptimeMs: 24 * 3600 * 1000,
  },
  {
    id: "crdt-merger",
    name: "CRDT Merger",
    status: "running",
    lastHeartbeat: Date.now() - 2_000,
    uptimeMs: 48 * 3600 * 1000,
  },
  {
    id: "backup-daemon",
    name: "Backup Daemon",
    status: "stopped",
    lastHeartbeat: Date.now() - 3600 * 1000,
    uptimeMs: null,
    error: "Scheduled backup disabled by user",
  },
];

function mapSubsystemToHealth(s: SubsystemStatusSnapshot): ServiceHealth {
  const status: ServiceHealth["status"] =
    s.status === "failed" || s.status === "shutting_down"
      ? "stopped"
      : s.status === "inactive" || s.status === "dormant" || s.status === "starting"
        ? "degraded"
        : "running";
  return {
    id: s.name,
    name: s.name,
    status,
    lastHeartbeat: s.uptimeSecs != null ? Date.now() - s.uptimeSecs * 1000 : null,
    uptimeMs: s.uptimeSecs != null ? s.uptimeSecs * 1000 : null,
    error: s.error,
  };
}

export const useHealthStore = create<HealthState>((set) => ({
  // In production start empty; the dev server seeds mock data below.
  services: import.meta.env.DEV ? DEV_MOCK_SERVICES : [],
  loading: false,
  lastRefreshed: null,
  backendAvailable: import.meta.env.DEV,
  setServices: (services) =>
    set({ services, lastRefreshed: Date.now(), loading: false, backendAvailable: true }),
  updateService: (id, patch) =>
    set((s) => ({
      services: s.services.map((svc) => (svc.id === id ? { ...svc, ...patch } : svc)),
    })),
  refresh: async () => {
    set({ loading: true });
    try {
      const snapshot = await invokeCommand<DbStatusSnapshot>("db_status_snapshot");
      const services = snapshot.subsystems.map(mapSubsystemToHealth);
      set({
        services,
        lastRefreshed: Date.now(),
        loading: false,
        backendAvailable: true,
      });
    } catch {
      // Backend unreachable (e.g. browser dev server). In dev, keep the mock
      // seed so the UI is still populated; in prod, show an empty state.
      set((s) => ({
        services: import.meta.env.DEV ? s.services : [],
        lastRefreshed: import.meta.env.DEV ? s.lastRefreshed : Date.now(),
        loading: false,
        backendAvailable: false,
      }));
    }
  },
}));
