import { useState, useEffect, useCallback } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { useTranslation } from "react-i18next";
import {
  Smartphone,
  Monitor,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wifi,
} from "lucide-react";
import { HelpCard } from "@features/settings/components/HelpCard";
import { syncNow, SyncState, SyncResult } from "../services/sync/syncService";
import { isTauriEnvironment } from "@shared/services/ipc";

interface PairedDevice {
  device_id: string;
  device_name: string;
  paired_at: string;
  public_key?: string | null;
  last_seen_at?: string | null;
}

/** How many ms ago counts as "recently synced" */
const RECENT_SYNC_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function isRecentlySynced(iso: string | null | undefined): boolean {
  if (!iso) return false;
  try {
    const d = new Date(iso);
    return Date.now() - d.getTime() < RECENT_SYNC_THRESHOLD_MS;
  } catch {
    return false;
  }
}

export function DevicePairingPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global sync state
  const [globalSyncState, setGlobalSyncState] = useState<SyncState>("idle");
  const [globalLastSync, setGlobalLastSync] = useState<string | null>(null);
  const [globalSyncError, setGlobalSyncError] = useState<string | null>(null);

  // Per-device sync states { deviceId: SyncState }
  const [deviceSyncStates, setDeviceSyncStates] = useState<
    Record<string, SyncState>
  >({});

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeCommand<PairedDevice[]>("get_pairings");
      setDevices(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const handleGlobalSync = useCallback(async () => {
    setGlobalSyncState("syncing");
    setGlobalSyncError(null);
    let allSuccess = true;
    let lastErr: string | null = null;

    for (const device of devices) {
      const result = await syncNow(device.device_id);
      if (!result.success) {
        allSuccess = false;
        lastErr = result.error ?? "Unknown error";
      }
    }

    if (allSuccess) {
      setGlobalSyncState("success");
      setGlobalLastSync(new Date().toISOString());
    } else {
      setGlobalSyncState("error");
      setGlobalSyncError(lastErr);
    }

    // Reset back to idle after 3s on success, stay on error
    if (allSuccess) {
      setTimeout(() => setGlobalSyncState("idle"), 3000);
    }
  }, [devices]);

  const handleDeviceSync = useCallback(
    async (deviceId: string) => {
      setDeviceSyncStates((prev) => ({ ...prev, [deviceId]: "syncing" }));
      const result: SyncResult = await syncNow(deviceId);

      if (result.success) {
        setDeviceSyncStates((prev) => ({ ...prev, [deviceId]: "success" }));
        setGlobalLastSync(new Date().toISOString());
        // Refresh devices to update last_seen_at
        try {
          const updated = await invokeCommand<PairedDevice[]>("get_pairings");
          setDevices(updated);
        } catch {
          // Silently ignore refresh failure
        }
        setTimeout(() => {
          setDeviceSyncStates((prev) => ({ ...prev, [deviceId]: "idle" }));
        }, 3000);
      } else {
        setDeviceSyncStates((prev) => ({ ...prev, [deviceId]: "error" }));
        setError(result.error ?? "Sync failed");
        setTimeout(() => {
          setDeviceSyncStates((prev) => ({ ...prev, [deviceId]: "idle" }));
        }, 5000);
      }
    },
    [],
  );

  async function handleRemove(deviceId: string) {
    try {
      await invokeCommand("remove_device_pairing", { deviceId });
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
    } catch (err) {
      setError(String(err));
    }
  }

  function handlePairNew() {
    // Stub: Real pairing flow TBD
  }

  /** CSS class for the global sync status indicator */
  const statusIndicatorClass = {
    idle: "bg-text-tertiary",
    syncing: "bg-accent animate-pulse",
    success: "bg-success",
    error: "bg-danger-text",
  }[globalSyncState];

  /** Status text for the indicator */
  const statusLabel = {
    idle: t("settings.syncStatusIdle", "Idle"),
    syncing: t("settings.syncStatusSyncing", "Syncing..."),
    success: t("settings.syncStatusSuccess", "Sync complete"),
    error: t("settings.syncStatusError", "Sync failed"),
  }[globalSyncState];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm p-4">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-semibold mb-4">
        {t("settings.devicePairing")}
      </h1>

      {/* ── Global Sync Section ── */}
      <div className="bg-elevated-bg rounded-lg border border-border p-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Status dot */}
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusIndicatorClass}`}
              aria-hidden="true"
            />
            <span className="text-sm text-text-secondary">
              {globalSyncState === "idle" && globalLastSync
                ? t("settings.lastSync", {
                    time: formatTimestamp(globalLastSync),
                  })
                : statusLabel}
            </span>
          </div>

          <button
            onClick={handleGlobalSync}
            disabled={globalSyncState === "syncing"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                globalSyncState === "syncing" ? "animate-spin" : ""
              }`}
            />
            {globalSyncState === "syncing"
              ? t("common.syncing")
              : t("settings.syncNow")}
          </button>
        </div>

        {/* Global sync error */}
        {globalSyncState === "error" && globalSyncError && (
          <div className="flex items-center gap-2 mt-2 text-xs text-danger-text">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{globalSyncError}</span>
          </div>
        )}
      </div>

      {/* Global error display */}
      {error && !globalSyncError && (
        <div className="bg-danger-bg border border-danger-border text-danger-text rounded-lg p-3 mb-4 text-sm">
          {!isTauriEnvironment() || error.includes("Tauri backend is not available")
            ? t(
                "settings.pairingUnavailableDev",
                "Device pairing is available in the desktop app.",
              )
            : error}
        </div>
      )}

      {devices.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary gap-3">
          <Smartphone className="w-12 h-12 opacity-40" />
          <p className="text-sm">{t("settings.noPairedDevices")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {devices.map((device) => {
            const devSyncState =
              deviceSyncStates[device.device_id] ?? "idle";
            const recent = isRecentlySynced(device.last_seen_at);

            return (
              <li
                key={device.device_id}
                className="flex items-center gap-3 bg-elevated-bg rounded-lg p-3 border border-border"
              >
                {/* Sync status dot */}
                {recent ? (
                  <Wifi className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <Monitor className="w-5 h-5 text-text-tertiary shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {device.device_name}
                    </p>
                    {recent && (
                      <span className="text-[10px] font-medium text-success uppercase tracking-wide shrink-0">
                        {t("common.synced", "Synced")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary">
                    {device.last_seen_at
                      ? t("settings.lastSync", {
                          time: formatTimestamp(device.last_seen_at),
                        })
                      : t("settings.notSyncedYet", "Not synced yet")}
                  </p>
                </div>

                {/* Per-device sync button */}
                <button
                  onClick={() => handleDeviceSync(device.device_id)}
                  disabled={devSyncState === "syncing"}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-elevated-bg border border-border hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={t("settings.syncWithDevice", {
                    deviceName: device.device_name,
                  })}
                >
                  {devSyncState === "syncing" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : devSyncState === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : devSyncState === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-danger-text" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {devSyncState === "syncing"
                    ? t("common.syncing")
                    : t("settings.syncNow")}
                </button>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(device.device_id)}
                  className="p-2 text-danger-text hover:bg-danger-bg rounded-lg transition-colors"
                  aria-label={t("common.remove")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={handlePairNew}
        className="flex items-center justify-center gap-2 w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
      >
        <Plus className="w-5 h-5" />
        {t("settings.pairNewDevice")}
      </button>

      {/* Education: Device Pairing */}
      <div className="mt-6">
        <HelpCard
          items={[
            { type: "why", text: "Device pairing lets you sync your email, calendar, and settings between desktop and mobile seamlessly — no manual setup on each device." },
            { type: "how", text: "Pair a new device by generating a token on this page, then scanning a QR code from the SME Master mobile app. Paired devices sync automatically in the background." },
            { type: "when", text: "Pair when setting up a new device, after reinstalling the app, or when you want to sync settings across devices. Keep both devices on the same network for best performance." },
            { type: "tip", text: "Check sync status regularly. A green indicator means the device has synced recently. Use the per-device sync button to force an immediate sync if needed." },
          ]}
        />
      </div>
    </div>
  );
}
