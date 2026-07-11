import { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { getContactActivity, type ActivityEvent } from "@features/contacts/services/activity";
import { ContactTimeline } from "@features/contacts/components/ContactTimeline";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { ErrorState } from "@shared/components/ui/ErrorState";

export interface ContactActivityTabProps {
  email: string;
  accountId: string;
}

export function ContactActivityTab({ email, accountId }: ContactActivityTabProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getContactActivity(accountId, email, 20)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, accountId]);

  // â”€â”€ Loading â”€â”€
  if (loading) {
    return (
      <div className="p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
          Recent Activity
        </h4>
        <ContactTimeline events={[]} isLoading={true} />
      </div>
    );
  }

  // â”€â”€ Error â”€â”€
  if (error) {
    return (
      <ErrorState
        title="Failed to load activity"
        message={error}
        onRetry={() => {
          if (!accountId) return;
          setLoading(true);
          setError(null);
          getContactActivity(accountId, email, 20)
            .then(setEvents)
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to load activity"))
            .finally(() => setLoading(false));
        }}
        retryLabel="Retry"
      />
    );
  }

  // â”€â”€ Empty â”€â”€
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        subtitle="Emails, tasks, and calendar events with this contact will appear here"
      />
    );
  }

  // â”€â”€ Timeline â”€â”€
  return (
    <div className="p-5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
        Recent Activity
      </h4>
      <ContactTimeline events={events} isLoading={false} />
    </div>
  );
}
