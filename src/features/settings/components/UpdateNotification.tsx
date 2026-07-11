import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import {
  UpdaterService,
  type UpdateChannel,
  type UpdateState,
} from "@shared/services/updater/updaterService";

interface UpdateNotificationProps {
  updater: UpdaterService;
  onDismiss?: () => void;
}

export default function UpdateNotification({ updater, onDismiss }: UpdateNotificationProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdateState>(updater.getState());
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Subscribe to state changes via polling
  useEffect(() => {
    const interval = setInterval(() => {
      setState(updater.getState());
    }, 500);
    return () => clearInterval(interval);
  }, [updater]);

  // Check for updates on mount
  useEffect(() => {
    const checkSilently = async () => {
      await updater.checkForUpdate();
    };
    checkSilently();
  }, [updater]);

  const handleCheckNow = useCallback(async () => {
    await updater.checkNow();
  }, [updater]);

  const handleDownload = useCallback(async () => {
    try {
      await updater.downloadUpdate();
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [updater]);

  const handleInstall = useCallback(async () => {
    try {
      await updater.installUpdate();
    } catch (err) {
      console.error("Install failed:", err);
    }
  }, [updater]);

  const handleSkip = useCallback(() => {
    if (state.available) {
      updater.skipVersion(state.available.version);
      setDismissed(true);
    }
  }, [updater, state.available]);

  const handleChannelChange = useCallback(
    (channel: UpdateChannel) => {
      updater.setChannel(channel);
      setState((prev) => ({ ...prev, channel }));
    },
    [updater]
  );

  if (dismissed) return null;

  const hasUpdate =
    state.available !== null &&
    !state.skippedVersions.includes(state.available.version);
  const isUpToDate = state.lastCheckDate && !hasUpdate && !state.checking;

  return (
    <div className="bg-bg-secondary dark:bg-slate-800/80 rounded-xl border border-border-primary p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            {t("updater.title", "Application Updater")}
          </h3>
          <p className="mt-1 text-sm text-text-tertiary">
            {t(
              "updater.description",
              "Keep SMEMaster up to date with the latest features and security fixes."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded-full p-1 text-text-tertiary hover:bg-bg-hover transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <div
            className={`rounded-full p-3 ${
              isUpToDate
                ? "bg-green-500/10"
                : state.error
                  ? "bg-red-500/10"
                  : "bg-accent/10"
            }`}
          >
            {state.checking || state.downloading ? (
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            ) : isUpToDate ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : state.error ? (
              <AlertCircle className="h-6 w-6 text-red-500" />
            ) : (
              <Download className="h-6 w-6 text-accent" />
            )}
          </div>
        </div>
      </div>

      {/* Channel Selector */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-text-tertiary">
          {t("updater.channel", "Channel")}:
        </span>
        <select
          value={state.channel}
          onChange={(e) => handleChannelChange(e.target.value as UpdateChannel)}
          className="w-32 px-3 py-1.5 rounded-lg border border-border-primary bg-bg-tertiary text-text-primary text-sm focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors"
        >
          <option value="stable">Stable</option>
          <option value="beta">Beta</option>
          <option value="nightly">Nightly</option>
        </select>
      </div>

      {/* Status Section */}
      <div className="mb-6 rounded-xl border border-border-primary bg-bg-tertiary/20 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-tertiary">
            {t("updater.status.label", "Status")}
          </span>
          <span className="text-sm font-semibold text-text-primary">
            {state.checking
              ? t("updater.status.checking", "Checking...")
              : state.downloading
                ? t("updater.status.downloading", "Downloading...")
                : state.readyToInstall
                  ? t("updater.status.downloaded", "Ready to install")
                  : hasUpdate
                    ? t("updater.status.available", "Update available")
                    : isUpToDate
                      ? t("updater.status.upToDate", "Up to date")
                      : state.error
                        ? t("updater.status.error", "Error")
                        : t("updater.status.idle", "Idle")}
          </span>
        </div>

        {/* Update Info */}
        {hasUpdate && state.available && (
          <div className="mt-4 space-y-2 border-t border-border-primary/50 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">
                {t("updater.version.new", "New Version")}
              </span>
              <span className="font-medium text-text-primary">
                {state.available.version}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">
                {t("updater.date", "Release Date")}
              </span>
              <span className="font-medium text-text-primary">
                {new Date(state.available.releaseDate).toLocaleDateString()}
              </span>
            </div>
            {state.available.releaseNotes && (
              <>
                <button
                  onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                  className="flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  {showReleaseNotes
                    ? t("updater.hideNotes", "Hide release notes")
                    : t("updater.showNotes", "Show release notes")}
                  {showReleaseNotes ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {showReleaseNotes && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-bg-primary p-3 text-sm text-text-tertiary">
                    <p className="whitespace-pre-wrap">
                      {state.available.releaseNotes}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Download Progress */}
        {state.downloading && (
          <div className="mt-4 space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${state.downloadProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-tertiary">
              <span>{t("updater.downloading", "Downloading...")}</span>
              <span>{Math.round(state.downloadProgress)}%</span>
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            {state.error}
          </div>
        )}

        {/* Last Check */}
        {state.lastCheckDate && (
          <div className="mt-3 text-xs text-text-tertiary">
            {t("updater.lastCheck", "Last checked")}:{" "}
            {state.lastCheckDate.toLocaleString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={handleCheckNow}
          disabled={state.checking || state.downloading}
          className="bg-bg-tertiary text-text-primary border border-border-primary"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          {t("updater.checkNow", "Check Now")}
        </Button>

        {hasUpdate && !state.downloading && !state.readyToInstall && (
          <Button variant="primary" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1.5" />
            {t("updater.download", "Update Now")}
          </Button>
        )}

        {state.readyToInstall && (
          <Button variant="primary" onClick={handleInstall}>
            <Download className="h-4 w-4 mr-1.5" />
            {t("updater.installRestart", "Install & Restart")}
          </Button>
        )}

        {hasUpdate && (
          <Button variant="secondary" onClick={handleSkip} className="bg-bg-tertiary text-text-primary border border-border-primary">
            {t("updater.skip", "Skip")}
          </Button>
        )}
      </div>
    </div>
  );
}
