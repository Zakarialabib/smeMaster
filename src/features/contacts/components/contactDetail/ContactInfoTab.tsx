import { useState, useEffect } from "react";
import { Tags, Users, Activity, Mail, Building2, ShieldCheck, StickyNote, ChevronRight, Clock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatRelativeDate } from "@shared/utils/date";
import { ContactStatsSummary } from "@features/contacts/components/ContactStatsSummary";
import { EngagementSparkline } from "@features/contacts/components/EngagementSparkline";
import { EngagementScoreBar } from "@features/contacts/components/EngagementScoreBar";
import { getRecentThreadsWithContact, getContactsFromSameDomain, getLatestAuthResult } from "@features/contacts/db/contacts";
import type { DbContact, ContactEngagementRow, ContactStats, SameDomainContact } from "@features/contacts/db/contacts";
import type { ContactTag, ContactGroupInfo } from "./types";
import { useClickOutside } from "@shared/hooks/useClickOutside";
import { useRef } from "react";

export interface ContactInfoTabProps {
  contact: DbContact;
  engagement: ContactEngagementRow | null;
  stats: ContactStats | null;
  contactTags: ContactTag[];
  contactGroups: ContactGroupInfo[];
}

export function ContactInfoTab({
  contact,
  engagement,
  stats,
  contactTags,
  contactGroups,
}: ContactInfoTabProps) {
  const navigate = useNavigate();
  const [recentThreads, setRecentThreads] = useState<
    { thread_id: string; subject: string | null; last_message_at: number | null }[]
  >([]);
  const [sameDomainContacts, setSameDomainContacts] = useState<SameDomainContact[]>([]);
  const [authResult, setAuthResult] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const notesRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(notesRef, () => setShowNotes(false));

  useEffect(() => {
    let cancelled = false;
    getRecentThreadsWithContact(contact.email, 5).then((data) => {
      if (!cancelled) setRecentThreads(data);
    });
    getContactsFromSameDomain(contact.email, 6).then((data) => {
      if (!cancelled) setSameDomainContacts(data);
    });
    getLatestAuthResult(contact.email).then((result) => {
      if (!cancelled) setAuthResult(result);
    });
    return () => { cancelled = true; };
  }, [contact.email]);

  return (
    <div className="p-5 space-y-5">
      {/* Stats + Engagement row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ContactStatsSummary stats={stats} />
        {engagement && (
          <EngagementScoreBar
            score={engagement.engagement_score ?? 0}
            healthStatus={engagement.health_status}
            lastEngagedAt={engagement.last_engaged_at}
            size="sm"
          />
        )}
      </div>

      {/* Frequency & last contacted */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-tertiary/40 rounded-lg px-3 py-2.5 border border-border-primary/30">
          <p className="text-[0.625rem] font-medium uppercase tracking-wider text-text-tertiary mb-0.5">
            Contact Frequency
          </p>
          <p className="text-sm font-semibold text-text-primary">{contact?.frequency ?? 0}x</p>
        </div>
        <div className="bg-bg-tertiary/40 rounded-lg px-3 py-2.5 border border-border-primary/30">
          <p className="text-[0.625rem] font-medium uppercase tracking-wider text-text-tertiary mb-0.5">
            Last Contacted
          </p>
          <p className="text-sm font-semibold text-text-primary">
            {contact?.last_contacted_at
              ? formatRelativeDate(contact.last_contacted_at)
              : "Never"}
          </p>
        </div>
      </div>

      {/* Engagement trend */}
      <div className="bg-bg-tertiary/20 rounded-lg p-3 border border-border-primary/20">
        <h4 className="text-[0.625rem] font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
          <Activity size={11} />
          30-Day Engagement
        </h4>
        <EngagementSparkline contactId={contact.id} days={30} />
      </div>

      {/* Auth result badge */}
      {authResult && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary/30 border border-border-primary/30">
          <ShieldCheck size={14} className="text-green-500 shrink-0" />
          <span className="text-[0.65rem] text-text-secondary">{authResult}</span>
        </div>
      )}

      {/* Tags */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
          <Tags size={12} />
          Tags {contactTags.length > 0 && <span className="text-text-tertiary font-normal">({contactTags.length})</span>}
        </h4>
        {contactTags.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">No tags assigned</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {contactTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 text-[0.625rem] font-medium rounded-full bg-accent/10 text-accent"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Groups */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
          <Users size={12} />
          Groups {contactGroups.length > 0 && <span className="text-text-tertiary font-normal">({contactGroups.length})</span>}
        </h4>
        {contactGroups.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">Not assigned to any group</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {contactGroups.map((group) => (
              <span
                key={group.id}
                className="inline-flex items-center px-2 py-0.5 text-[0.625rem] font-medium rounded-full bg-bg-tertiary text-text-secondary border border-border-primary"
              >
                {group.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Same-domain contacts */}
      {sameDomainContacts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
            <Building2 size={12} />
            Same Domain
          </h4>
          <div className="flex flex-wrap gap-2">
            {sameDomainContacts.map((sdc) => (
              <div
                key={sdc.email}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[0.65rem] bg-bg-tertiary/50 rounded-md border border-border-primary/40"
              >
                <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center text-[0.5rem] font-bold text-accent">
                  {sdc.display_name?.[0] ?? sdc.email[0]}
                </span>
                <span className="text-text-primary">{sdc.display_name ?? sdc.email.split("@")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent threads */}
      {recentThreads.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
            <Mail size={12} />
            Recent Emails
          </h4>
          <div className="divide-y divide-border-primary/50 border border-border-primary/40 rounded-lg overflow-hidden">
            {recentThreads.map((thread) => (
              <button
                key={thread.thread_id}
                onClick={() =>
                  navigate({
                    to: "/mail/$label/thread/$threadId",
                    params: { label: "inbox", threadId: thread.thread_id },
                  })
                }
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover transition-colors text-left"
              >
                <Mail size={12} className="text-text-tertiary shrink-0" />
                <span className="flex-1 text-xs text-text-primary truncate">
                  {thread.subject ?? "(No subject)"}
                </span>
                <span className="flex items-center gap-1 text-[0.55rem] text-text-tertiary shrink-0">
                  <Clock size={8} />
                  {thread.last_message_at ? formatRelativeDate(thread.last_message_at) : ""}
                </span>
                <ChevronRight size={10} className="text-text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes preview */}
      {contact.notes && (
        <div ref={notesRef} className="relative">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2 flex items-center gap-1.5">
            <StickyNote size={12} />
            Notes
          </h4>
          <div
            className={`text-xs text-text-secondary bg-bg-tertiary/30 rounded-lg border border-border-primary/30 p-3 ${
              showNotes ? "" : "line-clamp-3"
            }`}
          >
            {contact.notes}
          </div>
          {contact.notes.length > 150 && !showNotes && (
            <button
              onClick={() => setShowNotes(true)}
              className="text-[0.6rem] text-accent hover:underline mt-1"
            >
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
