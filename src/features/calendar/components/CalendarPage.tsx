import { useState, useEffect, useCallback, useRef } from "react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getCalendarEventsInRangeMulti, upsertCalendarEvent, type DbCalendarEvent } from "@features/calendar/db/calendarEvents";
import { getVisibleCalendars, getCalendarsForAccount, upsertCalendar, type DbCalendar } from "@features/calendar/db/calendars";
import { getCalendarProvider, hasCalendarSupport } from "@features/calendar/services/providerFactory";
import type { CalendarEventData, CreateEventInput } from "@features/calendar/services/types";
import { getSetting, setSetting } from "@features/settings/db/settings";
import { getTasksForAccount, type DbTask } from "@features/tasks/db/tasks";
import { getCampaigns, type DbCampaign } from "@features/campaigns/db/campaigns";
import { getScheduledEmailsForAccount, type DbScheduledEmail } from "@features/mail/db/scheduledEmails";
import { usePlatform } from "@shared/hooks/usePlatform";
import { CalendarToolbar, type CalendarView, type CalendarType } from "./CalendarToolbar";
import { type IntegratedItemType } from "./EventCard";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { AgendaView } from "./AgendaView";
import { EventCreateModal } from "./EventCreateModal";
import { EventDetailModal } from "./EventDetailModal";
import { EventDetailSheet } from "./EventDetailSheet";
import { CalendarList } from "./CalendarList";
import { CalendarReauthBanner } from "./CalendarReauthBanner";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, CalendarDays } from "lucide-react";
import { SkeletonPage, GlassPanel } from "@shared/components/ui";

export function CalendarPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mobile: isMobileDevice } = usePlatform();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(isMobileDevice ? "agenda" : "month");
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);
  const [integratedItems, setIntegratedItems] = useState<(DbTask | DbCampaign | DbScheduledEmail)[]>([]);
  const [calendars, setCalendars] = useState<DbCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DbCalendarEvent | null>(null);
  const [selectedType, setSelectedType] = useState<IntegratedItemType>("event");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [showCalendarList, setShowCalendarList] = useState(false);
  const [hasCalendar, setHasCalendar] = useState(true);
  const [calendarType, setCalendarType] = useState<CalendarType>("gregorian");
  const reauthDoneRef = useRef(false);

  useEffect(() => {
    getSetting("calendar_type").then((val) => {
      if (val) setCalendarType(val as CalendarType);
    });
  }, []);

  const handleCalendarTypeChange = useCallback((type: CalendarType) => {
    setCalendarType(type);
    setSetting("calendar_type", type);
  }, []);

  const getRange = useCallback((): { start: Date; end: Date } => {
    const d = new Date(currentDate);
    if (view === "month" || view === "agenda") {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === "week") {
      const start = new Date(d);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [currentDate, view]);

  const loadCalendars = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const supported = await hasCalendarSupport(activeAccountId);
      setHasCalendar(supported);
      if (!supported) return;

      const cals = await getCalendarsForAccount(activeAccountId);
      setCalendars(cals);
    } catch {
      // ignore
    }
  }, [activeAccountId]);

  const loadEvents = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { start, end } = getRange();
    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);

    // Load from local cache first
    try {
      const visibleCals = await getVisibleCalendars(activeAccountId);
      const calendarIds = visibleCals.map((c) => c.id);
      const cached = await getCalendarEventsInRangeMulti(activeAccountId, calendarIds, startTs, endTs);
      setEvents(cached);
    } catch {
      // ignore cache errors
    }

    // Load integrated items (tasks, campaigns, scheduled emails)
    try {
      const showTasks = await getSetting("calendar_show_tasks").then(v => v !== "false");
      const showCampaigns = await getSetting("calendar_show_campaigns").then(v => v !== "false");
      const showScheduledEmails = await getSetting("calendar_show_scheduled_emails").then(v => v !== "false");

      let items: (DbTask | DbCampaign | DbScheduledEmail)[] = [];

      if (showTasks) {
        const tasks = await getTasksForAccount(activeAccountId, true);
        items = [...items, ...tasks.filter(t => t.due_date && t.due_date >= startTs && t.due_date <= endTs)];
      }

      if (showCampaigns) {
        const campaigns = await getCampaigns(activeAccountId);
        items = [...items, ...campaigns.filter(c => c.sent_at && c.sent_at >= startTs && c.sent_at <= endTs)];
      }

      if (showScheduledEmails) {
        const emails = await getScheduledEmailsForAccount(activeAccountId);
        items = [...items, ...emails.filter(e => e.scheduled_at >= startTs && e.scheduled_at <= endTs)];
      }

      setIntegratedItems(items);
    } catch (err) {
      console.error("Failed to load integrated calendar items:", err);
    }

    // Fetch from provider API
    try {
      const supported = await hasCalendarSupport(activeAccountId);
      if (!supported) {
        setLoading(false);
        return;
      }

      const provider = await getCalendarProvider(activeAccountId);

      // Discover/update calendars
      const providerCalendars = await provider.listCalendars();
      for (const cal of providerCalendars) {
        await upsertCalendar({
          companyId: activeAccountId,
          provider: provider.type,
          remoteId: cal.remoteId,
          displayName: cal.displayName,
          color: cal.color,
          isPrimary: cal.isPrimary,
        });
      }

      // Reload calendars from DB
      const allCals = await getCalendarsForAccount(activeAccountId);
      setCalendars(allCals);

      // Fetch events for visible calendars
      const visibleCals = await getVisibleCalendars(activeAccountId);
      for (const cal of visibleCals) {
        const apiEvents = await provider.fetchEvents(
          cal.remote_id,
          start.toISOString(),
          end.toISOString(),
        );

        for (const event of apiEvents) {
          await upsertCalendarEventFromProvider(activeAccountId, cal.id, event);
        }
      }

      // Reload events from DB
      const calendarIds = visibleCals.map((c) => c.id);
      const fresh = await getCalendarEventsInRangeMulti(activeAccountId, calendarIds, startTs, endTs);
      setEvents(fresh);
      setNeedsReauth(false);
      setCalendarError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("403") || message.includes("insufficient")) {
        if (reauthDoneRef.current) {
          reauthDoneRef.current = false;
          setCalendarError(
            "Calendar access is still denied after re-authorization. " +
            "Make sure the Google Calendar API is enabled in your Google Cloud Console project. " +
            "Visit console.cloud.google.com Ã¢â€ â€™ APIs & Services Ã¢â€ â€™ Enable the \"Google Calendar API\".",
          );
        } else {
          setNeedsReauth(true);
        }
      } else {
        console.error("Failed to load calendar events:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, getRange]);

  useEffect(() => {
    loadCalendars();
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId, currentDate, view]);

  const handlePrev = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month" || view === "agenda") next.setMonth(next.getMonth() - 1);
      else if (view === "week") next.setDate(next.getDate() - 7);
      else next.setDate(next.getDate() - 1);
      return next;
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month" || view === "agenda") next.setMonth(next.getMonth() + 1);
      else if (view === "week") next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 1);
      return next;
    });
  }, [view]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleCreateEvent = useCallback(async (eventData: {
    summary: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    calendarId?: string;
    isAllDay?: boolean;
    type: IntegratedItemType;
  }) => {
    if (!activeAccountId) return;

    if (eventData.type === 'task') {
      const { insertTask } = await import("@features/tasks/db/tasks");
      await insertTask({
        accountId: activeAccountId,
        title: eventData.summary,
        description: eventData.description,
        dueDate: Math.floor(new Date(eventData.startTime).getTime() / 1000),
      });
      setShowCreate(false);
      loadEvents();
      return;
    }

    if (eventData.type === 'scheduled_email') {
      const { insertScheduledEmail } = await import("@features/mail/db/scheduledEmails");
      await insertScheduledEmail({
        accountId: activeAccountId,
        toAddresses: "", // Placeholder, will need full composer later
        ccAddresses: null,
        bccAddresses: null,
        subject: eventData.summary,
        bodyHtml: eventData.description || "",
        replyToMessageId: null,
        threadId: null,
        scheduledAt: Math.floor(new Date(eventData.startTime).getTime() / 1000),
        signatureId: null,
      });
      setShowCreate(false);
      loadEvents();
      return;
    }

    // Try to save via provider; fall back to local-only creation
    try {
      const provider = await getCalendarProvider(activeAccountId);

      // Find the target calendar
      let calendarRemoteId: string | undefined;
      let calendarDbId: string | undefined;
      if (eventData.calendarId) {
        const cal = calendars.find((c) => c.id === eventData.calendarId);
        if (cal) {
          calendarRemoteId = cal.remote_id;
          calendarDbId = cal.id;
        }
      }

      // Fallback to primary calendar
      if (!calendarRemoteId) {
        const primary = calendars.find((c) => c.is_primary) ?? calendars[0];
        if (primary) {
          calendarRemoteId = primary.remote_id;
          calendarDbId = primary.id;
        }
      }

      if (!calendarRemoteId) {
        // For Google, use "primary" as fallback
        calendarRemoteId = "primary";
      }

      const input: CreateEventInput = {
        summary: eventData.summary,
        description: eventData.description || undefined,
        location: eventData.location || undefined,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        isAllDay: eventData.isAllDay,
      };

      const created = await provider.createEvent(calendarRemoteId, input);

      // Save to local DB
      await upsertCalendarEventFromProvider(activeAccountId, calendarDbId ?? null, created);
    } catch {
      // No provider configured â€” create event locally only
      const startSecs = Math.floor(new Date(eventData.startTime).getTime() / 1000);
      const endSecs = Math.floor(new Date(eventData.endTime).getTime() / 1000);
      await upsertCalendarEvent({
        companyId: activeAccountId,
        googleEventId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        summary: eventData.summary,
        description: eventData.description || null,
        location: eventData.location || null,
        startTime: startSecs,
        endTime: endSecs,
        isAllDay: eventData.isAllDay ?? false,
        status: "confirmed",
        organizerEmail: null,
        attendeesJson: null,
        htmlLink: null,
        calendarId: eventData.calendarId ?? null,
        remoteEventId: null,
        etag: null,
        icalData: null,
        uid: null,
      });
    }

    setShowCreate(false);
    loadEvents();
  }, [activeAccountId, calendars, loadEvents]);

  const handleEventClick = useCallback((item: any, type: IntegratedItemType) => {
    setSelectedType(type);
    if (type === 'event') {
      setSelectedEvent(item);
    } else if (type === 'task') {
      // Convert task to quasi-event for detail view
      setSelectedEvent({
        ...item,
        summary: item.title,
        start_time: item.due_date,
        end_time: item.due_date,
        is_all_day: false,
      });
    } else if (type === 'campaign') {
      setSelectedEvent({
        ...item,
        summary: item.name,
        start_time: item.sent_at,
        end_time: item.sent_at,
        is_all_day: false,
      });
    } else if (type === 'scheduled_email') {
      setSelectedEvent({
        ...item,
        summary: item.subject,
        start_time: item.scheduled_at,
        end_time: item.scheduled_at,
        is_all_day: false,
      });
    }
  }, []);

  const handleEventUpdated = useCallback(() => {
    setSelectedEvent(null);
    loadEvents();
  }, [loadEvents]);

  if (!activeAccountId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-tertiary text-sm">
        <p>{t('calendar.connectAccount')}</p>
        <button
          onClick={() => navigate({ to: "/settings/$tab", params: { tab: "accounts" } })}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          Connect Account
        </button>
      </div>
    );
  }

  return (
    <div className="calendar-page flex flex-col flex-1 min-w-0 overflow-hidden bg-bg-primary">
      {/* Banner when no CalDAV is configured â€” still show full calendar with local events */}
      {!hasCalendar && (
        <div className="mx-4 mt-3 mb-0 px-3 py-2 rounded-lg bg-accent/5 border border-accent/15 flex items-center gap-2">
          <span className="text-xs text-accent font-medium">
            {t('calendar.notConfigured')}
          </span>
          <span className="text-[11px] text-text-tertiary hidden sm:inline">
            {t('calendar.imapCalDavHint')}
          </span>
        </div>
      )}

      <CalendarToolbar
        currentDate={currentDate}
        view={view}
        calendarType={calendarType}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={setView}
        onCalendarTypeChange={handleCalendarTypeChange}
        onCreateEvent={() => setShowCreate(true)}
        onToggleCalendarList={() => setShowCalendarList((v) => !v)}
        onRefresh={loadEvents}
        showCalendarListButton={calendars.length > 1}
        isMobile={isMobileDevice}
      />

      {needsReauth && activeAccount && (
        <CalendarReauthBanner
          accountId={activeAccount.id}
          email={activeAccount.email}
          onReauthSuccess={() => {
            reauthDoneRef.current = true;
            setNeedsReauth(false);
            setCalendarError(null);
            loadEvents();
          }}
        />
      )}

      {calendarError && !needsReauth && (
        <div className="mx-6 my-4 p-4 rounded-lg bg-danger/10 border border-danger/30 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{t('calendar.accessError')}</p>
            <p className="text-xs text-text-secondary mt-1">{calendarError}</p>
          </div>
          <button
            onClick={loadEvents}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors shrink-0 mt-0.5"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      )}

      {loading && events.length === 0 && (
        <SkeletonPage />
      )}

      {!loading && events.length === 0 && integratedItems.length === 0 && !needsReauth && !calendarError && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center p-8">
          <CalendarDays size={36} className="text-text-tertiary/40" />
          <div>
            <p className="text-sm font-medium text-text-primary">{t('calendar.noEvents')}</p>
            <p className="text-xs text-text-tertiary mt-1">Create an event or connect a calendar provider</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
          >
            Create Event
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop: sidebar calendar list */}
        {!isMobileDevice && showCalendarList && calendars.length > 1 && (
          <CalendarList
            calendars={calendars}
            onVisibilityChange={async (calendarId, visible) => {
              const { setCalendarVisibility } = await import("@features/calendar/db/calendars");
              await setCalendarVisibility(calendarId, visible);
              await loadCalendars();
              loadEvents();
            }}
          />
        )}

        {/* Mobile: overlay calendar list */}
        {isMobileDevice && showCalendarList && calendars.length > 1 && (
          <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center" onClick={() => setShowCalendarList(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div
              className="relative bg-bg-primary rounded-t-xl w-full max-h-[60vh] overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
                <h3 className="text-sm font-semibold text-text-primary">{t('calendar.calendars')}</h3>
                <button
                  onClick={() => setShowCalendarList(false)}
                  className="p-1 text-text-tertiary hover:text-text-primary rounded"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-4">
                <CalendarList
                  calendars={calendars}
                  onVisibilityChange={async (calendarId, visible) => {
                    const { setCalendarVisibility } = await import("@features/calendar/db/calendars");
                    await setCalendarVisibility(calendarId, visible);
                    await loadCalendars();
                    loadEvents();
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <GlassPanel variant="card" className="flex-1 min-w-0 mx-2 mb-2 overflow-hidden">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              events={events}
              integratedItems={integratedItems}
              calendars={calendars}
              onEventClick={handleEventClick}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              events={events}
              integratedItems={integratedItems}
              calendars={calendars}
              onEventClick={handleEventClick}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              events={events}
              integratedItems={integratedItems}
              calendars={calendars}
              onEventClick={handleEventClick}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              events={events}
              integratedItems={integratedItems}
              calendars={calendars}
              onEventClick={handleEventClick}
              onRefresh={loadEvents}
              refreshing={loading}
            />
          )}
        </GlassPanel>
      </div>

      {showCreate && (
        <EventCreateModal
          calendars={calendars}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateEvent}
        />
      )}

      {selectedEvent && (isMobileDevice ? (
        <EventDetailSheet
          event={selectedEvent}
          calendars={calendars}
          isOpen={true}
          onClose={() => setSelectedEvent(null)}
        />
      ) : (
        <EventDetailModal
          event={selectedEvent}
          type={selectedType}
          calendars={calendars}
          accountId={activeAccountId}
          onClose={() => setSelectedEvent(null)}
          onUpdated={handleEventUpdated}
        />
      ))}
    </div>
  );
}

async function upsertCalendarEventFromProvider(
  accountId: string,
  calendarId: string | null,
  event: CalendarEventData,
): Promise<void> {
  await upsertCalendarEvent({
    companyId: accountId,
    googleEventId: event.remoteEventId,
    summary: event.summary,
    description: event.description,
    location: event.location,
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: event.isAllDay,
    status: event.status,
    organizerEmail: event.organizerEmail,
    attendeesJson: event.attendeesJson,
    htmlLink: event.htmlLink,
    calendarId,
    remoteEventId: event.remoteEventId,
    etag: event.etag,
    icalData: event.icalData,
    uid: event.uid,
  });
}

