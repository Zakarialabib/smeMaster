import { useEffect, useState } from "react";
import {
  Send,
  Mail,
  Eye,
  CheckCheck,
  Plus,
  UserPlus,
  Megaphone,
  Calendar,
  Activity,
} from "lucide-react";
import { dashboardRecentActivity } from "@shared/services/db/db-invoke";
import type { EngagementLog } from "@shared/services/db/schema";
import { WidgetHeader, WidgetError } from "./WidgetHelpers";

// ─── Event type → icon mapping ──────────────────────────────────────────────

function ActivityIcon({ eventType, className }: { eventType: string; className?: string }) {
  switch (eventType) {
    case "email_sent":
      return <Send className={className} />;
    case "email_received":
      return <Mail className={className} />;
    case "email_opened":
      return <Eye className={className} />;
    case "task_completed":
      return <CheckCheck className={className} />;
    case "task_created":
      return <Plus className={className} />;
    case "contact_created":
      return <UserPlus className={className} />;
    case "campaign_sent":
      return <Megaphone className={className} />;
    case "calendar_event":
      return <Calendar className={className} />;
    default:
      return <Activity className={className} />;
  }
}

// ─── Event color helpers ────────────────────────────────────────────────────

function getEventBgColor(eventType: string): string {
  switch (eventType) {
    case "email_sent":
    case "email_received":
    case "email_opened":
      return "bg-accent";
    case "task_completed":
    case "contact_created":
      return "bg-success";
    case "task_created":
      return "bg-primary";
    case "campaign_sent":
    case "call_made":
    case "meeting_held":
      return "bg-warning";
    case "calendar_event":
      return "bg-info";
    default:
      return "bg-text-tertiary";
  }
}

// ─── Event type label formatting ────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  email_sent: "Email Sent",
  email_received: "Email Received",
  email_opened: "Email Opened",
  call_made: "Call Made",
  meeting_held: "Meeting Held",
  note_added: "Note Added",
  task_completed: "Task Completed",
  task_created: "Task Created",
  contact_created: "Contact Created",
  campaign_sent: "Campaign Sent",
  calendar_event: "Calendar Event",
};

function formatEventType(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Relative time formatting ───────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ─── Skeleton for timeline ──────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 relative pb-4 animate-pulse">
          <div className="w-[22px] h-[22px] rounded-full bg-bg-tertiary flex-shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-3 bg-bg-tertiary rounded w-3/4" />
            <div className="h-2 bg-bg-tertiary rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Activity className="w-8 h-8 text-text-tertiary mb-2" />
      <p className="text-sm text-text-tertiary font-medium">No recent activity</p>
      <p className="text-xs text-text-quaternary mt-1">Activity from your contacts will appear here</p>
    </div>
  );
}

// ─── Main widget component ──────────────────────────────────────────────────

export function RecentActivityWidget() {
  const [activities, setActivities] = useState<EngagementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await dashboardRecentActivity();
        if (!cancelled) setActivities(rows);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <WidgetError message={error} />;
  if (activities.length === 0) return <EmptyState />;

  return (
    <>
      <WidgetHeader icon={<Activity size={16} />} title="Recent Activity" />
      <div className="max-h-64 overflow-y-auto">
        <div className="relative space-y-0">
          {activities.map((event, i) => (
            <div key={event.id} className="flex gap-3 relative pb-4">
              {/* Timeline line connecting events */}
              {i < activities.length - 1 && (
                <div className="absolute left-[11px] top-5 bottom-0 w-px bg-border" />
              )}
              {/* Colored dot with icon */}
              <div
                className={`mt-1.5 w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 ${getEventBgColor(event.event_type)}`}
              >
                <ActivityIcon eventType={event.event_type} className="w-3 h-3 text-white" />
              </div>
              {/* Event content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{formatEventType(event.event_type)}</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {formatRelativeTime(event.created_at)}
                </p>
              </div>
              {/* Score delta */}
              {event.score_delta !== 0 && (
                <span className="text-xs text-text-tertiary flex-shrink-0 self-center">
                  {event.score_delta > 0 ? `+${event.score_delta}` : event.score_delta}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Smaller local states (kept here for simplicity) ────────────────────────

function LoadingState() {
  return (
    <>
      <WidgetHeader icon={<Activity size={16} />} title="Recent Activity" />
      <TimelineSkeleton />
    </>
  );
}

function EmptyState() {
  return (
    <>
      <WidgetHeader icon={<Activity size={16} />} title="Recent Activity" />
      <EmptyActivity />
    </>
  );
}
