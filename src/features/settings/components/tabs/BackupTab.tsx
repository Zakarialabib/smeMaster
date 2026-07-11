import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { HardDrive, Save, FolderOpen, Monitor, Plus, Trash2, RotateCcw, FileText, AlertCircle } from "lucide-react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { open } from "@tauri-apps/plugin-dialog";
import { notify } from "@shared/services/notifications/toastHelper";
import { Button } from "@shared/components/ui/Button";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { usePlatform } from "@shared/hooks/usePlatform";
import { Toggle } from "@shared/components/ui/Toggle";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { INPUT_BASE } from "@shared/styles/ui-tokens";

interface BackupConfig {
  enabled: boolean;
  interval_secs: number;
  retention_count: number;
  destination_path: string | null;
}

const INTERVAL_PRESETS = [
  { label: "Every 6 hours", value: 21600 },
  { label: "Every 12 hours", value: 43200 },
  { label: "Daily (24h)", value: 86400 },
  { label: "Every 2 days", value: 172800 },
  { label: "Weekly", value: 604800 },
  { label: "Custom", value: 0 },
];

function formatInterval(secs: number): string {
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  if (secs < 604800) return `${Math.round(secs / 86400)}d`;
  return `${Math.round(secs / 604800)}w`;
}

export default function BackupTab() {
  const { t } = useTranslation();
  const platform = usePlatform();
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customInterval, setCustomInterval] = useState("");

  // Backup list state
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!platform.desktop) {
      setLoading(false);
      return;
    }
    loadConfig();
  }, [platform.desktop]);

  async function loadConfig() {
    try {
      const cfg = await invokeCommand<BackupConfig>("get_backup_config");
      setConfig(cfg);
      if (cfg.interval_secs > 0 && !INTERVAL_PRESETS.some((p) => p.value === cfg.interval_secs)) {
        setCustomInterval(String(cfg.interval_secs));
      }
    } catch (e) {
      setError(`Failed to load backup config: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  // Load backup files whenever config loads or destination changes
  const loadBackupFiles = useCallback(async () => {
    if (!config?.destination_path) {
      setBackupFiles([]);
      return;
    }
    setLoadingBackups(true);
    try {
      const files = await invokeCommand<string[]>("list_backups", { directory: config.destination_path });
      setBackupFiles(files);
    } catch {
      // Silently fail — directory may not exist yet
      setBackupFiles([]);
    } finally {
      setLoadingBackups(false);
    }
  }, [config?.destination_path]);

  useEffect(() => {
    if (config?.destination_path) {
      loadBackupFiles();
    }
  }, [config?.destination_path, loadBackupFiles]);

  async function handleSave() {
    if (!config || !platform.desktop) return;
    setSaving(true);
    try {
      await invokeCommand("set_backup_config", { newConfig: config });
      notify("Backup", "Backup settings saved successfully.");
    } catch (e) {
      setError(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!config || !platform.desktop) return;
    try {
      await invokeCommand("toggle_backup", { enabled: !config.enabled });
      setConfig({ ...config, enabled: !config.enabled });
      notify("Backup", !config.enabled ? "Backup scheduler enabled." : "Backup scheduler disabled.");
    } catch (e) {
      setError(`Failed to toggle: ${e}`);
    }
  }

  async function handlePickDirectory() {
    if (!platform.desktop) return;
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Backup Directory",
      });
      if (selected) {
        setConfig({ ...config!, destination_path: selected as string });
      }
    } catch (e) {
      setError(`Failed to select directory: ${e}`);
    }
  }

  function handleIntervalChange(value: number) {
    if (!config) return;
    if (value === 0) {
      setCustomInterval(String(config.interval_secs || 86400));
      return;
    }
    setConfig({ ...config, interval_secs: value });
    setCustomInterval("");
  }

  function handleCustomIntervalChange(val: string) {
    setCustomInterval(val);
    const secs = parseInt(val, 10);
    if (!isNaN(secs) && secs > 0 && config) {
      setConfig({ ...config, interval_secs: secs });
    }
  }

  // ── Backup actions ──────────────────────────────────────────

  async function handleCreateBackup() {
    if (!config?.destination_path || !platform.desktop) return;
    setCreatingBackup(true);
    setError(null);
    try {
      await invokeCommand<string>("create_backup", { destinationDir: config.destination_path });
      notify("Backup", "Backup created successfully.");
      await loadBackupFiles();
    } catch (e) {
      setError(`Failed to create backup: ${e}`);
    } finally {
      setCreatingBackup(false);
    }
  }

  async function handleDeleteBackup() {
    if (!deleteTarget || !platform.desktop) return;
    try {
      // Use Rust-side delete_file or just notify — we'll use the filesystem API
      const { remove } = await import("@tauri-apps/plugin-fs");
      await remove(deleteTarget);
      notify("Backup", "Backup file deleted.");
      setDeleteTarget(null);
      await loadBackupFiles();
    } catch (e) {
      setError(`Failed to delete backup: ${e}`);
    }
  }

  async function handleRestoreBackup() {
    if (!restoreTarget || !platform.desktop) return;
    setRestoring(true);
    setError(null);
    try {
      await invokeCommand("restore_backup", { backupPath: restoreTarget });
      // App will restart after this, so no need to update state
    } catch (e) {
      setError(`Failed to restore backup: ${e}`);
      setRestoring(false);
    }
  }

  // ── Extract filename from path ──────────────────────────────

  function getFileName(path: string): string {
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] ?? path;
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <SettingGroup title={t('settings.backup')}>
        <div className="flex items-center justify-center py-8 text-sm text-text-tertiary">
          {t('common.loading')}
        </div>
      </SettingGroup>
    );
  }

  if (!config) {
    return (
      <SettingGroup title={t('settings.backup')}>
        <div className="py-4 text-sm text-danger">
          {error || "Backup config not available"}
        </div>
      </SettingGroup>
    );
  }

  if (!platform.desktop) {
    return (
      <SettingGroup title={t('settings.backup')}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Monitor size={32} className="text-text-tertiary mb-3" />
          <p className="text-sm text-text-primary font-medium mb-1">Desktop Only</p>
          <p className="text-xs text-text-tertiary max-w-xs">
            Backup settings are only available on the desktop version of the app.
          </p>
        </div>
      </SettingGroup>
    );
  }

  const selectedPreset = INTERVAL_PRESETS.find((p) => p.value === config.interval_secs);

  return (
    <SettingGroup title={t('settings.backup')}>
      <div className="space-y-5">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-primary font-medium">
            <HardDrive size={16} className="text-text-tertiary" />
            <span>{t('settings.backupScheduler')}</span>
          </div>
          <Toggle checked={config.enabled} onChange={handleToggle} size="sm" />
        </div>

        {/* Status badge */}
        <div
          className={`px-3 py-2 rounded-lg text-xs border ${
            config.enabled
              ? "bg-accent/5 border-accent/20 text-accent"
              : "bg-bg-secondary border-border-primary text-text-tertiary"
          }`}
        >
          {config.enabled
            ? `Backup runs every ${formatInterval(config.interval_secs)} · Retains ${config.retention_count} files`
            : "Backup scheduler is disabled. Enable to start automatic backups."}
        </div>

        {/* Interval */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary font-medium">Backup Interval</label>
          <select
            value={selectedPreset?.value ?? 0}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            className={INPUT_BASE}
          >
            {INTERVAL_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {selectedPreset?.value === 0 && (
            <input
              type="number"
              value={customInterval}
              onChange={(e) => handleCustomIntervalChange(e.target.value)}
              placeholder="Seconds (e.g., 43200 = 12h)"
              className={INPUT_BASE}
            />
          )}
        </div>

        {/* Retention */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary font-medium">Retention Count</label>
          <input
            type="number"
            min={1}
            max={30}
            value={config.retention_count}
            onChange={(e) =>
              setConfig({ ...config, retention_count: Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)) })
            }
            className={INPUT_BASE}
          />
          <p className="text-[0.625rem] text-text-tertiary">
            Number of backup files to keep. Oldest files are deleted when limit is exceeded.
          </p>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <label className="text-xs text-text-secondary font-medium">Destination Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.destination_path ?? ""}
              onChange={(e) => setConfig({ ...config, destination_path: e.target.value || null })}
              placeholder="Leave empty for default location"
              className={INPUT_BASE}
            />
            <Button
              variant="secondary"
              iconOnly
              icon={<FolderOpen size={16} />}
              onClick={handlePickDirectory}
              title="Browse for directory"
              aria-label="Browse for directory"
            />
          </div>
          <p className="text-[0.625rem] text-text-tertiary">
            If empty, backups emit events only (no file backup). Set a path to save backup files.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            icon={<Save size={14} />}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger">
            {error}
          </div>
        )}
      </div>

      {/* ── Backup Management Section ────────────────────────────── */}
      <div className="mt-6 pt-6 border-t border-border-primary space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileText size={15} className="text-text-tertiary" />
            Backup Files
          </h4>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateBackup}
            disabled={creatingBackup || !config.destination_path}
            icon={creatingBackup ? undefined : <Plus size={14} />}
          >
            {creatingBackup ? "Creating..." : "Generate Backup"}
          </Button>
        </div>

        <p className="text-xs text-text-tertiary">
          Create a manual backup at any time. Backups saved to the destination directory can be restored or deleted below.
        </p>

        {!config.destination_path && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            <AlertCircle size={13} />
            Set a destination directory above to enable backup creation.
          </div>
        )}

        {/* Backup list */}
        {loadingBackups ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : backupFiles.length > 0 ? (
          <div className="space-y-1.5">
            {backupFiles.map((filePath, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-secondary border border-border-primary"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {getFileName(filePath)}
                  </p>
                  <p className="text-[0.625rem] text-text-tertiary truncate mt-0.5">{filePath}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={<RotateCcw size={13} />}
                    onClick={() => setRestoreTarget(filePath)}
                    title="Restore from this backup"
                    aria-label="Restore"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={<Trash2 size={13} />}
                    onClick={() => setDeleteTarget(filePath)}
                    className="hover:text-danger"
                    title="Delete backup"
                    aria-label="Delete backup"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-text-tertiary border border-dashed border-border-primary rounded-lg">
            No backup files found in the destination directory.
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ──────────────────────────── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteBackup}
        title="Delete Backup"
        message={`Are you sure you want to delete "${deleteTarget ? getFileName(deleteTarget) : ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* ── Restore confirmation dialog ─────────────────────────── */}
      <ConfirmDialog
        isOpen={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreBackup}
        title="Restore Backup"
        message={`Restore "${restoreTarget ? getFileName(restoreTarget) : ""}"? The application will restart after the restore completes.`}
        confirmLabel="Restore"
        variant="primary"
        loading={restoring}
      />

      <HelpCard
        items={[
          { type: "why", text: "Backups protect your email database, settings, and templates from data loss — essential before major updates or when troubleshooting." },
          { type: "how", text: "Automatic backups run on a configurable schedule. Manual backups can be created at any time. Restore from a backup to recover from corruption or roll back changes." },
          { type: "when", text: "Schedule regular backups (daily or weekly) for production use. Create a manual backup before updating the app or making significant configuration changes." },
          { type: "tip", text: "Store backups on a different drive or cloud-synced folder for redundancy. Retention settings automatically clean up old files." },
        ]}
      />
    </SettingGroup>
  );
}
