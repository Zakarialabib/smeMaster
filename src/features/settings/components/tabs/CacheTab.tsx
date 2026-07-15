import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { notify } from "@shared/services/notifications/toastHelper";
import {
  SettingGroup,
  SettingRow,
} from "@features/settings/components/SettingsHelpers";
import { Button } from "@shared/components/ui/Button";
import {
  RefreshCw,
  Gauge,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface DomainCacheStats {
  name: string;
  hits: number;
  misses: number;
  hitRatePct: number;
  size: number;
}

interface CacheStatus {
  enabled: boolean;
  domains: Record<string, DomainCacheStats>;
}

interface SyncHealthSummary {
  total_syncs: number;
  failed_syncs: number;
  success_rate_percent: number;
  last_error?: string;
  last_sync_at?: number;
}

function formatTimestamp(ts?: number | null): string {
  if (!ts || ts <= 0) return "Never";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleString();
}

function formatMs(ms?: number): string {
  if (ms === undefined || ms === null) return "—";
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export default function CacheTab() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CacheStatus | null>(null);
  const [benchmarks, setBenchmarks] = useState<Record<string, number>>({});
  const [lastSync, setLastSync] = useState<SyncHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"benchmark" | "clear" | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cacheStatus, syncHealth] = await Promise.all([
        invokeCommand<CacheStatus>("db_cache_status").catch(() => null),
        invokeCommand<SyncHealthSummary>("get_sync_health_summary").catch(
          () => null,
        ),
      ]);
      if (cacheStatus) setStatus(cacheStatus);
      if (syncHealth) setLastSync(syncHealth);
    } catch (err) {
      console.error("[cache] failed to load status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleBenchmark = async () => {
    setBusy("benchmark");
    try {
      const result = await invokeCommand<Record<string, number>>(
        "db_cache_benchmark",
      );
      setBenchmarks(result);
      notify("Cache", t("settings.cache.benchmarkDone") ?? "Benchmark complete");
    } catch (err) {
      notify(
        "Cache",
        `Benchmark failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setBusy(null);
      void loadAll();
    }
  };

  const handleClear = async () => {
    setBusy("clear");
    try {
      await invokeCommand("db_cache_invalidate_all");
      notify("Cache", t("settings.cache.cleared") ?? "Caches cleared");
      setBenchmarks({});
    } catch (err) {
      notify(
        "Cache",
        `Clear failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setBusy(null);
      void loadAll();
    }
  };

  const domainOrder = ["contacts", "accounts", "labels", "threads"];
  const domains = status?.domains ?? {};

  return (
    <div className="space-y-6">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.cacheTab.overview") ?? "Cache Overview"}>
        <SettingRow
          label={t("settings.cacheTab.enabled") ?? "Data cache enabled"}
          description={
            t("settings.cacheTab.enabledDesc") ??
            "In-memory TTL cache layer (contacts, accounts, labels, threads)."
          }
        >
          {status?.enabled ? (
            <span className="flex items-center gap-1.5 text-emerald-500 text-sm font-medium">
              <CheckCircle2 size={15} /> {t("common.on") ?? "On"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-danger text-sm font-medium">
              <XCircle size={15} /> {t("common.off") ?? "Off"}
            </span>
          )}
        </SettingRow>

        <SettingRow
          label={t("settings.cacheTab.lastSync") ?? "Last sync"}
          description={
            t("settings.cacheTab.lastSyncDesc") ??
            "Most recent background sync attempt (from the sync monitor)."
          }
        >
          <span className="flex items-center gap-1.5 text-text-secondary text-sm">
            <Clock size={14} />
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              formatTimestamp(lastSync?.last_sync_at)
            )}
          </span>
        </SettingRow>
      </SettingGroup>

      {/* ── Per-domain stats ─────────────────────────────────────── */}
      <SettingGroup title={t("settings.cacheTab.domains") ?? "Cache Domains"}>
        {loading ? (
          <div className="flex items-center gap-2 px-1 py-3 text-text-tertiary text-sm">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : domainOrder.length === 0 && Object.keys(domains).length === 0 ? (
          <p className="px-1 py-3 text-text-tertiary text-sm">No cache data.</p>
        ) : (
          domainOrder
            .filter((d) => domains[d])
            .concat(
              Object.keys(domains).filter((d) => !domainOrder.includes(d)),
            )
            .map((key) => {
              const s = domains[key];
              if (!s) return null;
              const bench = benchmarks[key];
              return (
                <SettingRow
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  description={`${s.hits} hits / ${s.misses} misses · ${s.size} entries`}
                >
                  <span className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        s.hitRatePct >= 50
                          ? "text-emerald-500 font-medium"
                          : "text-amber-500 font-medium"
                      }
                    >
                      {s.hitRatePct.toFixed(1)}%
                    </span>
                    {bench !== undefined && (
                      <span className="flex items-center gap-1 text-text-tertiary">
                        <Gauge size={12} />
                        {formatMs(bench)}
                      </span>
                    )}
                  </span>
                </SettingRow>
              );
            })
        )}
      </SettingGroup>

      {/* ── Actions ──────────────────────────────────────────────── */}
      <SettingGroup title={t("settings.cacheTab.actions") ?? "Actions"}>
        <div className="flex flex-wrap gap-3 px-1 py-2">
          <Button
            variant="secondary"
            onClick={handleBenchmark}
            disabled={busy !== null}
          >
            {busy === "benchmark" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Gauge size={14} />
            )}
            {t("settings.cacheTab.runBenchmark") ?? "Run Benchmark"}
          </Button>

          <Button
            variant="danger"
            onClick={handleClear}
            disabled={busy !== null}
          >
            {busy === "clear" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {t("settings.cacheTab.clearCaches") ?? "Clear Caches"}
          </Button>

          <Button variant="ghost" onClick={() => void loadAll()} disabled={busy !== null}>
            <RefreshCw size={14} />
            {t("common.refresh") ?? "Refresh"}
          </Button>
        </div>
        <p className="px-1 text-xs text-text-tertiary">
          {t("settings.cacheTab.actionsHint") ??
            "Benchmark measures read latency through the cache/DB path. Clearing caches forces a fresh reload from the database on next access."}
        </p>
      </SettingGroup>
    </div>
  );
}
