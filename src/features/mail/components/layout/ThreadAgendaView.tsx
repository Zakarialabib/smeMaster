import { useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { ThreadCard } from "@features/mail/components/ThreadCard";
import type { Thread } from "@features/mail/stores/threadStore";
import type { ThreadViewProps } from "./ThreadViewTypes";

type AgendaGroupKey = "today" | "yesterday" | "thisWeek" | "older";

interface AgendaGroup {
  key: AgendaGroupKey;
  label: string;
  threads: Thread[];
}

function daysBetween(thread: Thread, today: Date): number {
  const threadDate = new Date(thread.lastMessageAt * 1000);
  const threadStart = new Date(
    threadDate.getFullYear(),
    threadDate.getMonth(),
    threadDate.getDate(),
  );
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.floor((todayStart.getTime() - threadStart.getTime()) / 86400000);
}

function groupThreads(threads: Thread[]): AgendaGroup[] {
  const today = new Date();
  const groups: Record<AgendaGroupKey, Thread[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  threads.forEach((thread) => {
    const age = daysBetween(thread, today);
    if (age === 0) groups.today.push(thread);
    else if (age === 1) groups.yesterday.push(thread);
    else if (age <= 7) groups.thisWeek.push(thread);
    else groups.older.push(thread);
  });

  const labels: Record<AgendaGroupKey, string> = {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    older: "Older",
  };

  return (Object.keys(groups) as AgendaGroupKey[])
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, label: labels[key], threads: groups[key] }));
}

export function ThreadAgendaView({
  threads,
  selectedThreadId,
  onThreadClick,
  onThreadContextMenu,
  categoryMap,
  followUpThreadIds,
  showCategoryBadges,
}: ThreadViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(["older"]),
  );
  const groups = useMemo(() => groupThreads(threads), [threads]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox size={28} className="mb-3 text-text-tertiary/40" />
        <p className="text-sm text-text-secondary">No threads in agenda</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {groups.map((group) => {
        const isCollapsed = collapsedGroups.has(group.key);

        return (
          <section
            key={group.key}
            className="border-b border-border-secondary last:border-b-0"
          >
            <button
              type="button"
              onClick={() =>
                setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.key)) next.delete(group.key);
                  else next.add(group.key);
                  return next;
                })
              }
              className="flex w-full items-center gap-2 bg-bg-secondary/30 px-4 py-2.5 transition-colors hover:bg-bg-hover"
              aria-expanded={!isCollapsed}
            >
              <Calendar size={14} className="shrink-0 text-accent" />
              <span className="flex-1 text-left text-xs font-semibold uppercase text-text-tertiary">
                {group.label}
              </span>
              <span className="rounded-full bg-bg-tertiary px-1.5 py-0.5 text-[0.625rem] font-medium text-text-tertiary">
                {group.threads.length}
              </span>
              {isCollapsed ? (
                <ChevronDown size={14} className="text-text-tertiary" />
              ) : (
                <ChevronUp size={14} className="text-text-tertiary" />
              )}
            </button>

            {!isCollapsed && (
              <div className="divide-y divide-border-secondary">
                {group.threads.map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    isSelected={thread.id === selectedThreadId}
                    onClick={onThreadClick}
                    onContextMenu={onThreadContextMenu}
                    category={categoryMap.get(thread.id)}
                    showCategoryBadge={showCategoryBadges}
                    hasFollowUp={followUpThreadIds.has(thread.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}


