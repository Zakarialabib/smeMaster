import { useState, useEffect } from "react";
import { Mail, MessageSquare, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { getRecentThreadsWithContact } from "@features/contacts/db/contacts";
import { formatRelativeDate } from "@shared/utils/date";
import { EmptyState } from "@shared/components/ui/EmptyState";

export interface ContactEmailsTabProps {
  email: string;
}

export function ContactEmailsTab({ email }: ContactEmailsTabProps) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<
    { thread_id: string; subject: string | null; last_message_at: number | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getRecentThreadsWithContact(email, 20)
      .then((data) => {
        if (!cancelled) setThreads(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load emails");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-bg-tertiary shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-bg-tertiary rounded w-3/4" />
              <div className="h-3 bg-bg-tertiary rounded w-1/2" />
              <div className="h-2.5 bg-bg-tertiary rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 px-4">
        <AlertCircle size={32} className="text-danger/60" />
        <p className="text-sm font-medium text-text-primary">Failed to load emails</p>
        <p className="text-xs text-text-tertiary text-center max-w-sm">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            getRecentThreadsWithContact(email, 20)
              .then(setThreads)
              .catch((err) => setError(err instanceof Error ? err.message : "Failed to load emails"))
              .finally(() => setLoading(false));
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  // ── Empty state ──
  if (threads.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No emails yet"
        subtitle="Email threads with this contact will appear here"
      />
    );
  }

  // ── Thread list ──
  return (
    <div className="divide-y divide-border-primary">
      {threads.map((thread) => (
        <button
          key={thread.thread_id}
          onClick={() =>
            navigate({
              to: "/mail/$label/thread/$threadId",
              params: { label: "inbox", threadId: thread.thread_id },
            })
          }
          className="flex items-start gap-3 w-full px-5 py-3 hover:bg-bg-hover transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
            <Mail size={14} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary truncate">
              {thread.subject ?? "(No subject)"}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {thread.last_message_at && (
                <span className="flex items-center gap-1 text-[0.6rem] text-text-tertiary">
                  <Clock size={9} />
                  {formatRelativeDate(thread.last_message_at)}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
