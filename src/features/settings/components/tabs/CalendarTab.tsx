import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ListTodo, Send, Mail } from "lucide-react";
import { SettingGroup, ToggleRow, SettingRow } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { getSetting, setSetting } from "@features/settings/db/settings";
import type { CalendarType } from "@features/calendar/components/CalendarToolbar";

export default function CalendarTab() {
  const { t } = useTranslation();
  const [calendarType, setCalendarType] = useState<CalendarType>("gregorian");
  const [showTasks, setShowTasks] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(true);
  const [showScheduledEmails, setShowScheduledEmails] = useState(true);

  useEffect(() => {
    getSetting("calendar_type").then((val) => {
      if (val) setCalendarType(val as CalendarType);
    });
    getSetting("calendar_show_tasks").then((val) => {
      setShowTasks(val !== "false");
    });
    getSetting("calendar_show_campaigns").then((val) => {
      setShowCampaigns(val !== "false");
    });
    getSetting("calendar_show_scheduled_emails").then((val) => {
      setShowScheduledEmails(val !== "false");
    });
  }, []);

  const handleTypeChange = (type: CalendarType) => {
    setCalendarType(type);
    setSetting("calendar_type", type);
  };

  const handleToggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    setSetting(key, value ? "true" : "false");
  };

  return (
    <div className="space-y-6">
      <SettingGroup
        title={t("settings.calendar", "Calendar")}
        description={t(
          "settings.calendarDesc",
          "Configure calendar and integration settings.",
        )}
      >
        <SettingRow label={t("calendar.calendarType", "Calendar Type")}>
          <select
            value={calendarType}
            onChange={(e) => handleTypeChange(e.target.value as CalendarType)}
            className="glass-select text-text-primary text-sm font-medium rounded-md px-3 py-1.5"
          >
            <option value="gregorian">{t("calendar.gregorian", "Gregorian")}</option>
            <option value="islamic">{t("calendar.islamic", "Islamic (Standard)")}</option>
            <option value="islamic-umalqura">{t("calendar.islamic-umalqura", "Islamic (Umm al-Qura)")}</option>
            <option value="islamic-civil">{t("calendar.islamic-civil", "Islamic (Civil)")}</option>
          </select>
        </SettingRow>
        <HelpCard
          items={[
            { type: "why", text: "Choice of calendar type determines how dates, months, and years are displayed across the app — important for regional and religious observance alignment." },
            { type: "how", text: "Select your preferred calendar system. All date displays in calendar views, scheduling, and email timestamps will reflect this choice." },
            { type: "when", text: "Set on first use to match your cultural/regional calendar system. Gregorian is the international standard; Islamic variants follow the lunar Hijri calendar." },
          ]}
        />
      </SettingGroup>

      <SettingGroup
        title={t("calendar.integrations", "Integrations")}
        description={t("calendar.integrationsDesc", "Choose what to display on your calendar view.")}
      >
        <ToggleRow
          label={t("calendar.showTasks", "Show Tasks")}
          description={t("calendar.showTasksDesc", "Display your tasks with due dates on the calendar.")}
          checked={showTasks}
          onToggle={() => handleToggle("calendar_show_tasks", !showTasks, setShowTasks)}
        />
        <ToggleRow
          label={t("calendar.showCampaigns", "Show Campaigns")}
          description={t("calendar.showCampaignsDesc", "Display scheduled and sent marketing campaigns.")}
          checked={showCampaigns}
          onToggle={() => handleToggle("calendar_show_campaigns", !showCampaigns, setShowCampaigns)}
        />
        <ToggleRow
          label={t("calendar.showScheduledEmails", "Show Scheduled Emails")}
          description={t("calendar.showScheduledEmailsDesc", "Display emails scheduled to be sent in the future.")}
          checked={showScheduledEmails}
          onToggle={() => handleToggle("calendar_show_scheduled_emails", !showScheduledEmails, setShowScheduledEmails)}
        />
        <HelpCard
          items={[
            { type: "why", text: "Overlaying tasks, campaigns, and scheduled emails on your calendar gives a unified view of time-sensitive commitments alongside events." },
            { type: "how", text: "Each overlay type appears as a distinct colored block on the calendar. Toggle them on/off independently to reduce visual clutter." },
            { type: "when", text: "Enable task overlay for deadline tracking. Show campaigns for marketing timeline visibility. Scheduled emails help plan send cadence." },
            { type: "tip", text: "Use the unified calendar view during daily planning — it replaces the need to check separate tools for tasks and email scheduling." },
          ]}
        />
      </SettingGroup>

      <div className="bg-bg-tertiary/20 border border-border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <div className="flex gap-4 mb-4">
          <div className="p-3 bg-accent/10 rounded-lg text-accent">
            <ListTodo size={20} />
          </div>
          <div className="p-3 bg-success/10 rounded-lg text-success">
            <Send size={20} />
          </div>
          <div className="p-3 bg-info/10 rounded-lg text-info">
            <Mail size={20} />
          </div>
        </div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">
          Unified Calendar Management
        </h4>
        <p className="text-xs text-text-tertiary max-w-sm leading-relaxed">
          Manage your schedule, tasks, and communications from a single view. Items will appear as different colored events on your calendar.
        </p>
      </div>
    </div>
  );
}
