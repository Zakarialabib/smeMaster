import { ChevronLeft, ChevronRight, Plus, CalendarDays, Settings2, ListTodo, Send, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { i18n } from "@/locales/i18n";
import { useState, useEffect } from "react";
import { getSetting, setSetting } from "@features/settings/db/settings";

export type CalendarView = "day" | "week" | "month" | "agenda";

export type CalendarType = "gregorian" | "islamic" | "islamic-umalqura" | "islamic-civil";

// ── Sub-components ──────────────────────────────────────────────────────────

function CalendarNavButtons({
  onPrev,
  onNext,
  onToday,
  todayLabel,
  size = "default",
}: {
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  todayLabel?: string;
  size?: "default" | "small";
}) {
  const iconSize = size === "small" ? 14 : 16;
  const btnClass =
    size === "small"
      ? "p-1 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors shrink-0"
      : "p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors";
  const todayClass =
    size === "small"
      ? "px-2 py-1 text-[0.625rem] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
      : "px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors";

  return (
    <>
      <button onClick={onPrev} className={btnClass} aria-label="Previous">
        <ChevronLeft size={iconSize} />
      </button>
      {onToday && todayLabel && (
        <button onClick={onToday} className={todayClass}>
          {todayLabel}
        </button>
      )}
      <button onClick={onNext} className={btnClass} aria-label="Next">
        <ChevronRight size={iconSize} />
      </button>
    </>
  );
}

function CalendarTypeToggle({
  calendarType,
  onChange,
  t,
}: {
  calendarType: CalendarType;
  onChange: (type: CalendarType) => void;
  t: (key: string) => string;
}) {
  return (
    <select
      value={calendarType}
      onChange={(e) => onChange(e.target.value as CalendarType)}
      className="bg-bg-tertiary text-text-primary text-xs font-medium rounded-md px-2 py-1 outline-none border-none focus:ring-1 focus:ring-accent"
    >
      <option value="gregorian">{t("calendar.gregorian")}</option>
      <option value="islamic">{t("calendar.islamic")}</option>
      <option value="islamic-umalqura">{t("calendar.islamic-umalqura")}</option>
      <option value="islamic-civil">{t("calendar.islamic-civil")}</option>
    </select>
  );
}

function ViewSwitcher<T extends string>({
  view,
  views,
  onChange,
  size = "default",
}: {
  view: T;
  views: Array<{ value: T; label: string }>;
  onChange: (view: T) => void;
  size?: "default" | "small";
}) {
  const btnClass =
    size === "small"
      ? "px-2 py-1 text-[0.625rem] font-medium rounded transition-colors"
      : "px-3 py-1 text-xs font-medium rounded transition-colors";

  return (
    <div className="flex bg-bg-tertiary rounded-md p-0.5">
      {views.map((v) => (
        <button
          key={v.value}
          onClick={() => onChange(v.value)}
          className={`${btnClass} capitalize ${
            view === v.value
              ? "bg-bg-primary text-text-primary shadow-sm"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function CreateEventButton({
  onClick,
  size = "default",
}: {
  onClick: () => void;
  size?: "default" | "small";
}) {
  if (size === "small") {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-center w-7 h-7 text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        aria-label="Create event"
      >
        <Plus size={14} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
    >
      <Plus size={14} />
      Create
    </button>
  );
}

// ── Main toolbar ────────────────────────────────────────────────────────────

interface CalendarToolbarProps {
  currentDate: Date;
  view: CalendarView;
  calendarType: CalendarType;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onCalendarTypeChange: (type: CalendarType) => void;
  onCreateEvent: () => void;
  onToggleCalendarList?: () => void;
  onRefresh?: () => void;
  showCalendarListButton?: boolean;
  isMobile?: boolean;
}

export function CalendarToolbar({
  currentDate,
  view,
  calendarType,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onCalendarTypeChange,
  onCreateEvent,
  onToggleCalendarList,
  onRefresh,
  showCalendarListButton,
  isMobile = false,
}: CalendarToolbarProps) {
  const { t } = useTranslation();
  const title = formatTitle(currentDate, view, calendarType);
  const [showSettings, setShowSettings] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(true);
  const [showScheduledEmails, setShowScheduledEmails] = useState(true);

  useEffect(() => {
    getSetting("calendar_show_tasks").then((val) => setShowTasks(val !== "false"));
    getSetting("calendar_show_campaigns").then((val) => setShowCampaigns(val !== "false"));
    getSetting("calendar_show_scheduled_emails").then((val) => setShowScheduledEmails(val !== "false"));
  }, []);

  const toggleSetting = (key: string, current: boolean, setter: (v: boolean) => void) => {
    const next = !current;
    setter(next);
    setSetting(key, next ? "true" : "false");
    if (onRefresh) onRefresh();
  };

  // ── Desktop toolbar ────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="calendar-header sticky top-0 z-10 bg-bg-primary flex items-center justify-between px-6 py-3 border-b border-border-primary">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <CalendarNavButtons
            onPrev={onPrev}
            onToday={onToday}
            onNext={onNext}
            todayLabel={t("date.today")}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded transition-colors ${showSettings ? "bg-accent/10 text-accent" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"}`}
              title="Calendar Settings"
            >
              <Settings2 size={16} />
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-1 w-56 bg-bg-primary border border-border-primary rounded-lg shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-1">
                <div className="px-2 py-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Integrations</div>
                <button
                  onClick={() => toggleSetting("calendar_show_tasks", showTasks, setShowTasks)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ListTodo size={14} className="text-[#8b5cf6]" />
                    <span>Tasks</span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${showTasks ? "bg-accent border-accent" : "border-border-primary"}`}>
                    {showTasks && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </button>
                <button
                  onClick={() => toggleSetting("calendar_show_campaigns", showCampaigns, setShowCampaigns)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Send size={14} className="text-[#10b981]" />
                    <span>Campaigns</span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${showCampaigns ? "bg-accent border-accent" : "border-border-primary"}`}>
                    {showCampaigns && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </button>
                <button
                  onClick={() => toggleSetting("calendar_show_scheduled_emails", showScheduledEmails, setShowScheduledEmails)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-[#3b82f6]" />
                    <span>Scheduled Emails</span>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${showScheduledEmails ? "bg-accent border-accent" : "border-border-primary"}`}>
                    {showScheduledEmails && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </button>
                <div className="h-px bg-border-primary my-1" />
                <div className="px-2 py-1.5 text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Calendar System</div>
                <div className="px-1 py-1">
                  <CalendarTypeToggle
                    calendarType={calendarType}
                    onChange={onCalendarTypeChange}
                    t={t}
                  />
                </div>
              </div>
            )}
          </div>

          {showCalendarListButton && onToggleCalendarList && (
            <button
              onClick={onToggleCalendarList}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Toggle calendar list"
            >
              <CalendarDays size={16} />
            </button>
          )}
          <ViewSwitcher
            view={view}
            views={[
              { value: "day", label: "day" },
              { value: "week", label: "week" },
              { value: "month", label: "month" },
            ]}
            onChange={onViewChange}
          />
          <CreateEventButton onClick={onCreateEvent} />
        </div>
      </div>
    );
  }

  // ── Mobile toolbar ─────────────────────────────────────────────────────
  return (
    <div className="calendar-header sticky top-0 z-10 bg-bg-primary flex items-center justify-between px-3 py-2 border-b border-border-primary gap-2">
      {/* Left: title + nav */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <CalendarNavButtons onPrev={onPrev} onNext={onNext} size="small" />
        <h2 className="text-sm font-semibold text-text-primary truncate">
          {title}
        </h2>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {showCalendarListButton && onToggleCalendarList && (
          <button
            onClick={onToggleCalendarList}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Toggle calendar list"
            aria-label="Toggle calendar list"
          >
            <CalendarDays size={14} />
          </button>
        )}
        <ViewSwitcher
          view={view}
          views={[
            { value: "month", label: t("calendar.month") },
            { value: "week", label: t("calendar.week") },
            { value: "day", label: t("calendar.day") },
            { value: "agenda", label: "List" },
          ]}
          onChange={onViewChange}
          size="small"
        />
        <CreateEventButton onClick={onCreateEvent} size="small" />
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTitle(
  date: Date,
  view: CalendarView,
  calendarType: CalendarType,
): string {
  const calendar = calendarType === "gregorian" ? "gregory" : calendarType;

  if (view === "month" || view === "agenda") {
    return new Intl.DateTimeFormat(i18n.language, {
      calendar,
      year: "numeric",
      month: "long",
    }).format(date);
  }

  if (view === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const fmt = new Intl.DateTimeFormat(i18n.language, {
      calendar,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  return new Intl.DateTimeFormat(i18n.language, {
    calendar,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
