import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@shared/components/ui/Button";
import { Modal } from "@shared/components/ui/Modal";
import { TextField } from "@shared/components/ui/TextField";
import { Toggle } from "@shared/components/ui/Toggle";
import { useFormField } from "@shared/hooks/useFormField";
import { required as requiredValidator } from "@shared/utils/validators";
import type { DbCalendar } from "@features/calendar/db/calendars";
import { Calendar, ListTodo, Mail } from "lucide-react";
import { type IntegratedItemType } from "./EventCard";

interface EventCreateModalProps {
  calendars?: DbCalendar[];
  onClose: () => void;
  onCreate: (event: {
    summary: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    calendarId?: string;
    isAllDay?: boolean;
    type: IntegratedItemType;
  }) => void;
}

export function EventCreateModal({ calendars, onClose, onCreate }: EventCreateModalProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<IntegratedItemType>("event");
  const summaryField = useFormField({ validator: requiredValidator, initialValue: "" });
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(getDefaultStart());
  const [endTime, setEndTime] = useState(getDefaultEnd());
  const [calendarId, setCalendarId] = useState<string>(
    calendars?.find((c) => c.is_primary)?.id ?? calendars?.[0]?.id ?? "",
  );

  // End must not be before start (only meaningful for timed events).
  const timeError =
    type === "event" && !isAllDay && endTime < startTime
      ? "calendar.endBeforeStart"
      : undefined;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    summaryField.onBlur();
    if (!summaryField.value.trim() || timeError) return;
    onCreate({
      summary: summaryField.value.trim(),
      description,
      location,
      startTime,
      endTime,
      calendarId: calendarId || undefined,
      isAllDay: isAllDay || undefined,
      type,
    });
  }, [summaryField, description, location, startTime, endTime, calendarId, isAllDay, type, onCreate, timeError]);

  return (
    <Modal isOpen={true} onClose={onClose} title={t("common.create")} size="md">
      <div className="px-4 pt-4">
        <div className="flex bg-bg-tertiary rounded-lg p-1 mb-4">
          <button
            onClick={() => setType("event")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              type === "event" ? "bg-bg-primary text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <Calendar size={14} />
            {t("calendar.event")}
          </button>
          <button
            onClick={() => setType("task")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              type === "task" ? "bg-bg-primary text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <ListTodo size={14} />
            {t("calendar.task")}
          </button>
          <button
            onClick={() => setType("scheduled_email")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
              type === "scheduled_email" ? "bg-bg-primary text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <Mail size={14} />
            {t("calendar.email")}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3">
        <TextField
          label={type === 'event' ? t("calendar.eventTitle") : type === 'task' ? t("tasks.title") : t("mail.subject")}
          type="text"
          value={summaryField.value}
          onChange={(e) => summaryField.onChange(e.target.value)}
          onBlur={summaryField.onBlur}
          error={summaryField.error}
          placeholder={t("calendar.eventTitle")}
          autoFocus
        />
        {summaryField.error && (
          <p className="text-xs text-danger -mt-2 mb-1" role="alert">{t(summaryField.error)}</p>
        )}

        {type === 'event' && calendars && calendars.length > 0 && (
          <div>
            <label className="text-xs text-text-secondary block mb-1">{t("calendar.calendar")}</label>
            <div className="flex flex-wrap gap-2">
              {calendars.map((cal) => {
                const isSelected = cal.id === calendarId;
                const calColor = cal.color ?? "var(--color-accent)";
                return (
                  <button
                    key={cal.id}
                    type="button"
                    onClick={() => setCalendarId(cal.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-accent/10 ring-1 ring-accent text-text-primary"
                        : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: calColor }}
                    />
                    <span className="truncate max-w-[100px]">
                      {cal.display_name ?? t("calendar.calendar")}
                    </span>
                    {cal.is_primary && (
                      <span className="text-[0.5rem] uppercase tracking-wider text-text-tertiary ml-0.5">
                        {t("settings.default")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {type === 'event' && (
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">{t("calendar.allDay") ?? "All day"}</label>
            <Toggle checked={isAllDay} onChange={setIsAllDay} />
          </div>
        )}

        <div className={type === 'event' ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
          <TextField
            label={type === 'event' ? t("calendar.start") : type === 'task' ? t("tasks.dueDate") : t("calendar.sendAt")}
            type={(type === 'event' && isAllDay) ? "date" : "datetime-local"}
            value={(type === 'event' && isAllDay) ? startTime.slice(0, 10) : startTime}
            onChange={(e) => {
              const val = e.target.value;
              setStartTime((type === 'event' && isAllDay) ? val + "T00:00" : val);
            }}
          />
          {type === 'event' && (
            <TextField
              label={t("calendar.end")}
              type={isAllDay ? "date" : "datetime-local"}
              value={isAllDay ? endTime.slice(0, 10) : endTime}
              onChange={(e) => {
                const val = e.target.value;
                setEndTime(isAllDay ? val + "T23:59" : val);
              }}
              error={timeError}
            />
          )}
        </div>
        {timeError && (
          <p className="text-xs text-danger -mt-2 mb-1" role="alert">{t(timeError)}</p>
        )}

        {type === 'event' && (
          <TextField
            label={t("calendar.location")}
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("calendar.location")}
          />
        )}

        <div>
          <label className="text-xs text-text-secondary block mb-1">{t("common.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("common.description")}
            rows={3}
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!summaryField.value.trim() || !!timeError}
          >
            {t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function getDefaultStart(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toLocalISOString(now);
}

function getDefaultEnd(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 2);
  return toLocalISOString(now);
}

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

