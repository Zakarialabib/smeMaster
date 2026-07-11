import type { Thread } from "@features/mail/stores/threadStore";

export interface ThreadViewProps {
  threads: Thread[];
  selectedThreadId: string | null;
  onThreadClick: (thread: Thread) => void;
  onThreadContextMenu: (e: React.MouseEvent, threadId: string) => void;
  categoryMap: Map<string, string>;
  followUpThreadIds: Set<string>;
  showCategoryBadges: boolean;
}

