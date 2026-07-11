import { Send, Calendar, Repeat } from "lucide-react";
import type { ScheduleMode, RecurringFrequency } from "@features/campaigns/stores/campaignComposerStore";

interface ScheduleStepProps {
  scheduleMode: ScheduleMode;
  onScheduleModeChange: (mode: ScheduleMode) => void;
  scheduledDate: string;
  onDateChange: (date: string) => void;
  scheduledTime: string;
  onTimeChange: (time: string) => void;
  recurringFrequency: RecurringFrequency;
  onFrequencyChange: (freq: RecurringFrequency) => void;
  trackingEnabled: boolean;
  onToggleTracking: () => void;
  gdprConsent: boolean;
  onGdprChange: (consent: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function ScheduleStep({
  scheduleMode,
  onScheduleModeChange,
  scheduledDate,
  onDateChange,
  scheduledTime,
  onTimeChange,
  recurringFrequency,
  onFrequencyChange,
  trackingEnabled,
  onToggleTracking,
  gdprConsent,
  onGdprChange,
  t,
}: ScheduleStepProps) {
  return (
    <div className="space-y-4">
      <label className="text-sm text-text-primary font-medium">{t('campaign.sendSchedule')}</label>
      <div className="flex gap-2">
        {(["immediate", "scheduled", "recurring"] as ScheduleMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onScheduleModeChange(mode)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
              scheduleMode === mode
                ? "bg-accent/10 border-accent text-accent"
                : "bg-bg-secondary border-border-primary text-text-secondary hover:border-accent/50"
            }`}
          >
            {mode === "immediate" ? (
              <span className="flex items-center justify-center gap-1"><Send size={14} />{t('campaign.now')}</span>
            ) : mode === "scheduled" ? (
              <span className="flex items-center justify-center gap-1"><Calendar size={14} />{t('campaign.later')}</span>
            ) : (
              <span className="flex items-center justify-center gap-1"><Repeat size={14} />{t('campaign.recurring')}</span>
            )}
          </button>
        ))}
      </div>

      {scheduleMode === "scheduled" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-text-tertiary mb-1 block">{t('campaign.date')}</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-text-tertiary mb-1 block">{t('campaign.time')}</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      )}

      {scheduleMode === "recurring" && (
        <div>
          <label className="text-xs text-text-tertiary mb-1 block">{t('campaign.frequency')}</label>
          <div className="flex gap-2">
            {(["daily", "weekly", "monthly"] as const).map((freq) => (
              <button
                key={freq}
                onClick={() => onFrequencyChange(freq)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-colors ${
                  recurringFrequency === freq
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-bg-secondary border-border-primary text-text-secondary hover:border-accent/50"
                }`}
              >
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GDPR tracking toggle */}
      <div className="border-t border-border-primary pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-text-primary font-medium">{t('campaign.openClickTracking')}</span>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t('campaign.trackingDescription')}
            </p>
          </div>
          <button
            onClick={onToggleTracking}
            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ml-4 ${
              trackingEnabled ? "bg-accent" : "bg-bg-tertiary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                trackingEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
        {trackingEnabled && !gdprConsent && (
          <div className="glass-panel rounded-lg p-3 space-y-2">
            <p className="text-xs text-text-tertiary leading-relaxed">
              {t('campaign.gdprDescription')}
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gdprConsent}
                onChange={(e) => onGdprChange(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span className="text-xs text-text-secondary">
                {t('campaign.gdprConsent')}
              </span>
            </label>
          </div>
        )}
        {trackingEnabled && gdprConsent && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {t('campaign.gdprConfirmed')}
          </div>
        )}
      </div>
    </div>
  );
}
