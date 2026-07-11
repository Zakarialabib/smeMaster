import { MapPin, Clock, User } from "lucide-react";
import { AdaptiveBottomSheet } from "@shared/components/ui/AdaptiveBottomSheet";
import type { DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import type { DbCalendar } from "@features/calendar/db/calendars";

interface EventDetailSheetProps {
  event: DbCalendarEvent;
  calendars: DbCalendar[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Formats a Unix timestamp (seconds) to a human-readable date/time string.
 */
function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Touch-friendly event detail presented in an AdaptiveBottomSheet.
 * On mobile this renders as a bottom sheet; on larger screens as a side panel.
 */
export function EventDetailSheet({
  event,
  calendars,
  isOpen,
  onClose,
}: EventDetailSheetProps) {
  const calendar = calendars.find((c) => c.id === event.calendar_id);
  const attendees = event.attendees_json
    ? (JSON.parse(event.attendees_json) as {
        email: string;
        displayName?: string;
      }[])
    : [];

  return (
    <AdaptiveBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={event.summary ?? "Event"}
    >
      <div className="p-4 space-y-3">
        {/* Calendar info */}
        {calendar && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  calendar.color ?? "var(--color-accent)",
              }}
            />
            {calendar.display_name}
          </div>
        )}

        {/* Time */}
        <div className="flex items-start gap-2.5 text-sm text-text-secondary">
          <Clock size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
          <div>
            <div>{formatTime(event.start_time)}</div>
            <div>{formatTime(event.end_time)}</div>
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-start gap-2.5 text-sm text-text-secondary">
            <MapPin size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
            <span>{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="text-sm text-text-secondary whitespace-pre-wrap border-t border-border-primary pt-3">
            {event.description}
          </div>
        )}

        {/* Attendees */}
        {attendees.length > 0 && (
          <div className="border-t border-border-primary pt-3">
            <div className="text-xs text-text-tertiary mb-1.5">
              Attendees
            </div>
            <div className="space-y-1">
              {attendees.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-text-secondary"
                >
                  <User size={12} className="text-text-tertiary shrink-0" />
                  <span>{a.displayName ?? a.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Touch-friendly close action */}
        <div className="pt-2 border-t border-border-primary">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 text-sm font-medium text-center
              text-white bg-accent hover:bg-accent-hover
              rounded-lg transition-colors
              active:scale-[0.98] active:bg-accent-hover
              min-h-[44px]"
          >
            Close
          </button>
        </div>
      </div>
    </AdaptiveBottomSheet>
  );
}
