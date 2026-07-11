import { useMemo } from 'react';
import { Archive, BellRing, Inbox, MailOpen, Pin } from 'lucide-react';
import { ThreadCard } from '@features/mail/components/ThreadCard';
import type { Thread } from '@features/mail/stores/threadStore';
import type { ThreadViewProps } from './ThreadViewTypes';

interface KanbanColumn {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  threads: Thread[];
}

function buildColumns(threads: Thread[], followUpThreadIds: Set<string>): KanbanColumn[] {
  return [
    {
      id: 'pinned',
      label: 'Pinned',
      description: 'High-context threads',
      icon: Pin,
      threads: threads.filter((thread) => thread.isPinned),
    },
    {
      id: 'unread',
      label: 'Unread',
      description: 'Needs a first pass',
      icon: Inbox,
      threads: threads.filter((thread) => !thread.isRead && !thread.isPinned),
    },
    {
      id: 'follow-up',
      label: 'Follow-up',
      description: 'Reminder-backed work',
      icon: BellRing,
      threads: threads.filter((thread) => followUpThreadIds.has(thread.id) && !thread.isPinned),
    },
    {
      id: 'read',
      label: 'Read',
      description: 'Processed conversations',
      icon: MailOpen,
      threads: threads.filter(
        (thread) => thread.isRead && !thread.isPinned && !followUpThreadIds.has(thread.id),
      ),
    },
  ];
}

export function ThreadKanbanView({
  threads,
  selectedThreadId,
  onThreadClick,
  onThreadContextMenu,
  categoryMap,
  followUpThreadIds,
  showCategoryBadges,
}: ThreadViewProps) {
  const columns = useMemo(
    () => buildColumns(threads, followUpThreadIds),
    [threads, followUpThreadIds],
  );

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Archive size={28} className="mb-3 text-text-tertiary/40" />
        <p className="text-sm text-text-secondary">No threads for this board</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="grid h-full grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const Icon = column.icon;

          return (
            <section
              key={column.id}
              className="flex min-h-0 flex-col rounded-lg border border-border-primary bg-bg-secondary/40"
              aria-label={`${column.label} threads`}
            >
              {/* Fixed header - won't scroll */}
              <div className="shrink-0 border-b border-border-secondary px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon size={15} className="text-accent" />
                  <h3 className="text-sm font-semibold text-text-primary">{column.label}</h3>
                  <span className="ml-auto rounded-full bg-bg-tertiary px-2 py-0.5 text-[0.6875rem] font-medium text-text-tertiary">
                    {column.threads.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-tertiary">{column.description}</p>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                {column.threads.length > 0 ? (
                  <div className="flex flex-col gap-1 p-1.5">
                    {column.threads.map((thread) => (
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
                ) : (
                  <div className="flex flex-col items-center justify-center px-3 py-8 text-center text-xs text-text-tertiary/60">
                    <div className="mb-1.5 h-6 w-6 rounded-full bg-bg-tertiary/50" />
                    <span>Nothing here</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

