/**
 * Health Store — tracks background service health.
 *
 * Initially seeded with mock data for development.
 * Replace `setMockHealthData` with real IPC calls once the
 * orchestrator gateway commands are available.
 */
import { create } from "zustand";

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
  setServices: (services: ServiceHealth[]) => void;
  updateService: (id: string, patch: Partial<ServiceHealth>) => void;
  refresh: () => void;
}

const MOCK_SERVICES: ServiceHealth[] = [
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

export const useHealthStore = create<HealthState>((set) => ({
  services: MOCK_SERVICES,
  loading: false,
  lastRefreshed: Date.now(),
  setServices: (services) =>
    set({ services, lastRefreshed: Date.now(), loading: false }),
  updateService: (id, patch) =>
    set((s) => ({
      services: s.services.map((svc) =>
        svc.id === id ? { ...svc, ...patch } : svc,
      ),
    })),
  refresh: () => {
    set({ loading: true });
    // Simulate async refresh — replace with real IPC call
    setTimeout(() => {
      set({
        services: MOCK_SERVICES.map((s) => ({
          ...s,
          lastHeartbeat: Date.now() - Math.floor(Math.random() * 120_000),
        })),
        lastRefreshed: Date.now(),
        loading: false,
      });
    }, 600);
  },
}));
