import { useTranslation } from "react-i18next";
import { Activity, PauseCircle } from "lucide-react";
import { SettingGroup, ToggleRow } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { QueueInspector } from "@features/settings/components/QueueInspector";
import { QueueStatusIndicator } from "@features/settings/components/QueueStatusIndicator";
import { useScreenInfo } from "@shared/hooks/usePlatform";
import { useSetting } from "@shared/hooks/useSetting";

export default function QueueTab() {
  const { t } = useTranslation();
  const screen = useScreenInfo();
  const isMobile = screen.category === "phone" || screen.category === "phone-folded";
  const [queuePaused, setQueuePaused] = useSetting("queue_paused", "false");

  return (
    <div className="space-y-6">
      <SettingGroup
        title={t('settings.tabs.queue', 'Queue')}
        description={t('settings.queueDesc', 'Pending operations, sync status, and retry queue.')}
      >
        {/* Queue pause/resume toggle */}
        <ToggleRow
          label={queuePaused === "true" ? "Queue Paused" : "Queue Active"}
          description={queuePaused === "true"
            ? "Outgoing messages and background sync operations are paused. Resume to continue processing."
            : "The queue is running normally. Incoming sync and outgoing sends are processed in the background."
          }
          checked={queuePaused !== "true"}
          onToggle={() => setQueuePaused(queuePaused === "true" ? "false" : "true")}
        />

        {/* Status indicator */}
        <div className="flex items-center gap-3 py-3 px-4 bg-bg-tertiary/30 rounded-lg border border-border-primary/40">
          <div className={`p-2 rounded-full ${queuePaused === "true" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
            {queuePaused === "true" ? <PauseCircle size={18} /> : <Activity size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {queuePaused === "true" ? "Operations Paused" : "Processing Normally"}
            </p>
            <p className="text-xs text-text-tertiary">
              {queuePaused === "true"
                ? "No outgoing sends or background syncs will occur until resumed."
                : "Emails are being sent and accounts synced according to schedule."}
            </p>
          </div>
        </div>

        {isMobile ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <QueueStatusIndicator />
          </div>
        ) : (
          <QueueInspector />
        )}

        <HelpCard
          items={[
            { type: "why", text: "The queue manages all outgoing email sends, database sync operations, and retry logic. Monitoring it helps diagnose delivery delays and sync issues." },
            { type: "how", text: "The queue processes items in FIFO order. Failed operations are automatically retried with exponential backoff. Use the inspector to view pending, processing, and failed items." },
            { type: "when", text: "Check the queue if emails aren't sending, sync seems stuck, or you want to pause operations temporarily (e.g., before a demo or presentation)." },
            { type: "tip", text: "Pause the queue before making major configuration changes to prevent partial states. Resume after changes are saved." },
          ]}
        />
      </SettingGroup>
    </div>
  );
}
