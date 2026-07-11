import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePlatform } from "@shared/hooks/usePlatform";
import { ThreadCard } from "@features/mail/components/ThreadCard";
import { CategoryTabs } from "@features/mail/components/CategoryTabs";
import { EmailListSkeleton } from "@shared/components/ui/Skeleton";
import { InfiniteScrollSentinel } from "@shared/components/ui/InfiniteScrollSentinel";
import { MailTopBar } from "./MailTopBar";
import { useEmailThreads } from "../../hooks/useEmailThreads";
import {
  useArchiveThread,
  useDeleteThread,
  useMarkRead,
  useMarkUnread,
  useStarThread,
} from "../../hooks/useEmailMutations";
import { useThreadStore, type Thread } from "@features/mail/stores/threadStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useLayoutStore } from "@shared/stores/layoutStore";
import {
  useActiveLabel,
  useSelectedThreadId,
  useActiveCategory,
} from "@shared/hooks/useRouteNavigation";
import { navigateToThread, navigateToLabel } from "@/router/navigate";
import {
  getThreadsForAccount,
  getThreadsForCategory,
  getThreadLabelIds,
} from "@shared/services/db/threads";
import {
  getCategoriesForThreads,
  getCategoryUnreadCounts,
  getUserOverrides,
} from "@features/mail/db/threadCategories";
import { getActiveFollowUpThreadIds } from "@features/settings/db/followUpReminders";
import {
  getBundleRules,
  getHeldThreadIds,
  getBundleSummaries,
  type DbBundleRule,
} from "@features/deliverability/db/bundleRules";
import { getGmailClient } from "@features/mail/services/gmail/tokenManager";
import { useLabelStore } from "@features/mail/stores/labelStore";
import { useSmartFolderStore } from "@features/mail/stores/smartFolderStore";
import { useContextMenuStore } from "@features/mail/stores/contextMenuStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { isAiAvailable } from "@shared/services/ai/providerManager";
import { getMessagesForThread } from "@shared/services/db/messages";
import {
  getSmartFolderSearchQuery,
  mapSmartFolderRows,
  type SmartFolderRow,
} from "@features/mail/services/search/smartFolderQuery";
import { executeSearchQuery } from "@/shared/services/db/db-invoke";

import { BundleRow } from "@features/mail/components/bundles/BundleRow";
import { BundleCategoryTabs } from "@features/mail/components/bundles/BundleCategoryTabs";
import { ThreadAgendaView } from "./ThreadAgendaView";
import { ThreadCalendarView } from "./ThreadCalendarView";
import { ThreadKanbanView } from "./ThreadKanbanView";

import {
  Archive,
  Trash2,
  X,
  Ban,
  Filter,
  Package,
  FolderSearch,
} from "lucide-react";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { AddAccount } from "@features/accounts/components/AddAccount";
import { Button } from "@shared/components/ui/Button";
import { SwipeableRow } from "@shared/components/ui/SwipeableRow";
import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import { FilterBar, ViewModeToggle, AiSuggestionBanner } from "@shared/components/ui";
import { SavedViews } from "@features/mail/components/search/SavedViews";
import type { SwipeActions } from "@shared/hooks/useSwipeGesture";
import { triggerHaptic } from "@shared/hooks/useHaptics";
import { useGestureActions } from "@/shared/hooks/useGestureActions";
import { optimisticStore } from "@shared/stores/optimisticStore";
import { snoozeThread } from "@features/mail/services/snooze/snoozeManager";
import { getCurrentUnixTimestamp } from "@shared/utils/timestamp";
import "@features/mail/styles/threadAnimations.css";
import {
  InboxClearIllustration,
  NoSearchResultsIllustration,
  NoAccountIllustration,
  GenericEmptyIllustration,
} from "@shared/components/ui/illustrations";

const PAGE_SIZE = 50;

// Map sidebar labels to Gmail label IDs
const LABEL_MAP: Record<string, string> = {
  inbox: "INBOX",
  starred: "STARRED",
  sent: "SENT",
  drafts: "DRAFT",
  trash: "TRASH",
  spam: "SPAM",
  snoozed: "SNOOZED",
  all: "", // no filter
};

export function EmailList({
  width,
  listRef,
}: {
  width?: number;
  listRef?: React.Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const threads = useThreadStore((s) => s.threads);
  const selectedThreadId = useSelectedThreadId();
  const selectedThreadIds = useThreadStore((s) => s.selectedThreadIds);
  const setThreads = useThreadStore((s) => s.setThreads);
  const setLoading = useThreadStore((s) => s.setLoading);
  const removeThreads = useThreadStore((s) => s.removeThreads);
  const clearMultiSelect = useThreadStore((s) => s.clearMultiSelect);
  const selectAll = useThreadStore((s) => s.selectAll);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const activeLabel = useActiveLabel();
  const readFilter = useLayoutStore((s) => s.readFilter);
  const setReadFilter = useLayoutStore((s) => s.setReadFilter);
  const readingPanePosition = useLayoutStore((s) => s.readingPanePosition);
  const userLabels = useLabelStore((s) => s.labels);
  const smartFolders = useSmartFolderStore((s) => s.folders);

  // Detect smart folder mode
  const isSmartFolder = activeLabel.startsWith("smart-folder:");
  const smartFolderId = isSmartFolder
    ? activeLabel.replace("smart-folder:", "")
    : null;
  const activeSmartFolder = smartFolderId
    ? (smartFolders.find((f) => f.id === smartFolderId) ?? null)
    : null;

  const gmailLabelId = LABEL_MAP[activeLabel] ?? activeLabel;
  const { isLoading: rqLoading, refetch: refetchThreads } = useEmailThreads(
    isSmartFolder ? null : activeAccountId,
    gmailLabelId,
  );
  const storeLoading = useThreadStore((s) => s.isLoading);
  const isLoading = isSmartFolder ? storeLoading : rqLoading || storeLoading;

  const archiveMutation = useArchiveThread();
  const deleteMutation = useDeleteThread();
  const markReadMutation = useMarkRead();
  const markUnreadMutation = useMarkUnread();
  const starMutation = useStarThread();

  const { actions: gestureActions } = useGestureActions({
    context: 'mail',
    customActions: [
      {
        id: 'archive',
        label: t('email.archive'),
        icon: null,
        direction: 'left',
        color: 'bg-green-500',
        onAction: () => {},
      },
      {
        id: 'delete',
        label: t('common.delete'),
        icon: null,
        direction: 'long-left',
        destructive: true,
        color: 'bg-danger',
        onAction: () => {},
      },
      {
        id: 'snooze',
        label: t('email.snooze'),
        icon: null,
        direction: 'right',
        color: 'bg-blue-500',
        onAction: () => {},
      },
    ],
  });

  const inboxViewMode = useLayoutStore((s) => s.inboxViewMode);
  const routerCategory = useActiveCategory();

  // In split mode, use the router's category; in unified mode, always use "All"
  const activeCategory = inboxViewMode === "split" ? routerCategory : "All";
  const setActiveCategory =
    inboxViewMode === "split"
      ? (cat: string) => navigateToLabel("inbox", { category: cat })
      : () => {};

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const listWrapperRef = useRef<HTMLDivElement>(null);
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [categoryUnreadCounts, setCategoryUnreadCounts] = useState<
    Map<string, number>
  >(() => new Map());
  const [userOverrideCounts, setUserOverrideCounts] = useState<
    Map<string, number>
  >(() => new Map());
  const [followUpThreadIds, setFollowUpThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bundleRules, setBundleRules] = useState<DbBundleRule[]>([]);
  const [heldThreadIds, setHeldThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedBundles, setExpandedBundles] = useState<Set<string>>(
    () => new Set(),
  );
  const [bundleSummaries, setBundleSummaries] = useState<
    Map<
      string,
      {
        count: number;
        latestSubject: string | null;
        latestSender: string | null;
      }
    >
  >(() => new Map());
  const [activeBundleCategory, setActiveBundleCategory] = useState("All");

  const openMenu = useContextMenuStore((s) => s.openMenu);
  const multiSelectCount = selectedThreadIds.size;

  const openComposer = useComposerStore((s) => s.openComposer);
  const multiSelectBarRef = useRef<HTMLDivElement>(null);

  // Ref map for CSSTransition nodes (React 18 compatibility)
  // Prevents react-transition-group from calling deprecated findDOMNode
  const nodeRefsMap = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const setNodeRef = useCallback((threadId: string, node: HTMLDivElement | null) => {
    if (node) {
      nodeRefsMap.current.set(threadId, node);
    } else {
      nodeRefsMap.current.delete(threadId);
    }
  }, []);

  // View mode and filters
  const viewMode = useLayoutStore((s) => s.viewMode);
  const setViewMode = useLayoutStore((s) => s.setViewMode);
  const [filters, setFilters] = useState<Record<string, string>>({
    status: "all",
    priority: "all",
    sortBy: "date",
  });
  const [showAiSuggestion, setShowAiSuggestion] = useState(true);
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [aiAvailable, setAiAvailable] = useState(false);
  const aiAvailableRef = useRef(false);

  // Check whether an AI provider is actually configured (API key set, server URL, etc.)
  useEffect(() => {
    if (aiAvailableRef.current) return;
    aiAvailableRef.current = true;
    isAiAvailable().then(setAiAvailable);
  }, []);

  const handleThreadContextMenu = useCallback(
    (e: React.MouseEvent, threadId: string) => {
      e.preventDefault();
      openMenu("thread", { x: e.clientX, y: e.clientY }, { threadId });
    },
    [openMenu],
  );

  const handleDraftClick = useCallback(
    async (thread: Thread) => {
      if (!activeAccountId) return;
      try {
        const messages = await getMessagesForThread(activeAccountId, thread.id);
        // Get the last message (the draft)
        const draftMsg = messages[messages.length - 1];
        if (!draftMsg) return;

        // Look up the Gmail draft ID so auto-save can update the existing draft
        let draftId: string | null = null;
        try {
          const client = await getGmailClient(activeAccountId);
          const drafts = await client.listDrafts();
          const match = drafts.find((d) => d.message.id === draftMsg.id);
          if (match) draftId = match.id;
        } catch {
          // If we can't get draft ID, composer will create a new draft on save
        }

        const to = draftMsg.to_addresses
          ? draftMsg.to_addresses
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [];
        const cc = draftMsg.cc_addresses
          ? draftMsg.cc_addresses
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [];
        const bcc = draftMsg.bcc_addresses
          ? draftMsg.bcc_addresses
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [];

        openComposer({
          mode: "new",
          to,
          cc,
          bcc,
          subject: draftMsg.subject ?? "",
          bodyHtml: draftMsg.body_html ?? draftMsg.body_text ?? "",
          threadId: thread.id,
          draftId,
        });
      } catch (err) {
        console.error("Failed to open draft:", err);
      }
    },
    [activeAccountId, openComposer],
  );

  const handleThreadClick = useCallback(
    (thread: Thread) => {
      if (activeLabel === "drafts") {
        handleDraftClick(thread);
      } else {
        navigateToThread(thread.id);
      }
    },
    [activeLabel, handleDraftClick],
  );

  const handleBulkDelete = async () => {
    if (!activeAccountId || multiSelectCount === 0) return;
    const ids = [...selectedThreadIds];
    clearMultiSelect();
    await Promise.all(
      ids.map(async (id) => {
        await deleteMutation.mutateAsync({
          accountId: activeAccountId,
          threadId: id,
          permanent: activeLabel === "trash",
        });
      }),
    );
  };

  const handleBulkArchive = async () => {
    if (!activeAccountId || multiSelectCount === 0) return;
    const ids = [...selectedThreadIds];
    clearMultiSelect();
    await Promise.all(
      ids.map(async (id) => {
        await archiveMutation.mutateAsync({
          accountId: activeAccountId,
          threadId: id,
        });
      }),
    );
  };

  const handleBulkSpam = async () => {
    if (!activeAccountId || multiSelectCount === 0) return;
    const ids = [...selectedThreadIds];
    const isSpamView = activeLabel === "spam";
    removeThreads(ids);
    try {
      const client = await getGmailClient(activeAccountId);
      await Promise.all(
        ids.map((id) =>
          isSpamView
            ? client.modifyThread(id, ["INBOX"], ["SPAM"])
            : client.modifyThread(id, ["SPAM"], ["INBOX"]),
        ),
      );
    } catch (err) {
      console.error("Bulk spam failed:", err);
    }
  };

  // ─── Thread-level action handlers ──────────────────────────────────────
  const handleArchive = useCallback(
    (threadId: string) => {
      if (!activeAccountId) return;
      archiveMutation.mutateAsync({ accountId: activeAccountId, threadId })
        .catch((err) => console.error("Archive failed:", err));
    },
    [activeAccountId, archiveMutation],
  );

  const handleDelete = useCallback(
    (threadId: string) => {
      if (!activeAccountId) return;
      deleteMutation.mutateAsync({ accountId: activeAccountId, threadId, permanent: activeLabel === "trash" })
        .catch((err) => console.error("Delete failed:", err));
    },
    [activeAccountId, deleteMutation, activeLabel],
  );

  const handleMarkRead = useCallback(
    (threadId: string) => {
      if (!activeAccountId) return;
      markReadMutation.mutateAsync({ accountId: activeAccountId, threadId })
        .catch((err) => console.error("Mark read failed:", err));
    },
    [activeAccountId, markReadMutation],
  );

  const handleMarkUnread = useCallback(
    (threadId: string) => {
      if (!activeAccountId) return;
      markUnreadMutation.mutateAsync({ accountId: activeAccountId, threadId })
        .catch((err) => console.error("Mark unread failed:", err));
    },
    [activeAccountId, markUnreadMutation],
  );

  const handleStar = useCallback(
    (threadId: string, starred: boolean) => {
      if (!activeAccountId) return;
      starMutation.mutateAsync({ accountId: activeAccountId, threadId, starred })
        .catch((err) => console.error("Star failed:", err));
    },
    [activeAccountId, starMutation],
  );

  // ThreadCard-compatible wrapper for onStar (passes only threadId)
  const handleStarThread = useCallback(
    (threadId: string) => {
      const thread = useThreadStore.getState().threadMap.get(threadId);
      if (!thread) return;
      handleStar(threadId, !thread.isStarred);
    },
    [handleStar],
  );

  const searchThreadIds = useThreadStore((s) => s.searchThreadIds);
  const searchQuery = useThreadStore((s) => s.searchQuery);

  const filteredThreads = useMemo(() => {
    let filtered = threads;
    // Apply search filter
    if (searchThreadIds !== null) {
      filtered = filtered.filter((t) => searchThreadIds.has(t.id));
    }
    // Apply read filter
    if (readFilter === "unread") filtered = filtered.filter((t) => !t.isRead);
    else if (readFilter === "read") filtered = filtered.filter((t) => t.isRead);
    // Category filtering is now server-side (Phase 4) — no client-side filter needed
    if (filters.sortBy === "sender") {
      return [...filtered].sort((a, b) =>
        (a.fromName ?? a.fromAddress ?? "").localeCompare(
          b.fromName ?? b.fromAddress ?? "",
        ),
      );
    }
    return [...filtered].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [threads, readFilter, searchThreadIds, filters.sortBy]);

  // Pre-compute bundled category Set for O(1) lookups in filter
  const bundledCategorySet = useMemo(
    () => new Set(bundleRules.map((r) => r.category)),
    [bundleRules],
  );

  // Memoize visible threads (excludes bundled/held threads in "All" inbox view)
  const visibleThreads = useMemo(() => {
    // When a specific bundle category tab is active, hide the regular thread list
    // (bundled threads are shown in the pre-expanded bundle row above)
    if (
      activeLabel === "inbox" &&
      activeCategory === "All" &&
      activeBundleCategory !== "All"
    ) {
      return [];
    }
    if (activeLabel !== "inbox" || activeCategory !== "All")
      return filteredThreads;
    return filteredThreads.filter((t) => {
      const cat = categoryMap.get(t.id);
      if (cat && bundledCategorySet.has(cat)) return false;
      if (heldThreadIds.has(t.id)) return false;
      return true;
    });
  }, [
    filteredThreads,
    activeLabel,
    activeCategory,
    activeBundleCategory,
    categoryMap,
    bundledCategorySet,
    heldThreadIds,
  ]);

  const mapDbThreads = useCallback(
    async (
      dbThreads: Awaited<ReturnType<typeof getThreadsForAccount>>,
    ): Promise<Thread[]> => {
      return Promise.all(
        dbThreads.map(async (t) => {
          const labelIds = await getThreadLabelIds(t.account_id, t.id);
          return {
            id: t.id,
            accountId: t.account_id,
            subject: t.subject,
            snippet: t.snippet,
            lastMessageAt: t.last_message_at ?? 0,
            messageCount: t.message_count,
            isRead: t.is_read === 1,
            isStarred: t.is_starred === 1,
            isPinned: t.is_pinned === 1,
            isMuted: t.is_muted === 1,
            hasAttachments: t.has_attachments === 1,
            labelIds,
            fromName: t.from_name,
            fromAddress: t.from_address,
          };
        }),
      );
    },
    [],
  );

  const clearSearch = useThreadStore((s) => s.clearSearch);

  const loadThreads = useCallback(async () => {
    if (!activeAccountId) {
      setThreads([]);
      return;
    }

    clearSearch();
    setLoading(true);
    setHasMore(true);
    try {
      // Smart folder query path
      if (isSmartFolder && activeSmartFolder) {
        const { sql, params } = getSmartFolderSearchQuery(
          activeSmartFolder.query,
          activeAccountId,
          PAGE_SIZE,
        );
        const rows = (await executeSearchQuery(
          sql,
          params,
        )) as unknown as SmartFolderRow[];
        const mapped = await mapSmartFolderRows(rows);
        setThreads(mapped);
        setHasMore(false); // Smart folders load all at once
      } else {
        let dbThreads;
        // Server-side category filtering for inbox
        if (activeLabel === "inbox" && activeCategory !== "All") {
          dbThreads = await getThreadsForCategory(
            activeAccountId,
            activeCategory,
            PAGE_SIZE,
            0,
          );
        } else {
          const gmailLabelId = LABEL_MAP[activeLabel] ?? activeLabel;
          dbThreads = await getThreadsForAccount(
            activeAccountId,
            gmailLabelId || undefined,
            PAGE_SIZE,
            0,
          );
        }

        const mapped = await mapDbThreads(dbThreads);
        setThreads(mapped);
        setHasMore(dbThreads.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error("Failed to load threads:", err);
    } finally {
      setLoading(false);
    }
  }, [
    activeAccountId,
    activeLabel,
    activeCategory,
    isSmartFolder,
    activeSmartFolder,
    setThreads,
    setLoading,
    mapDbThreads,
    clearSearch,
  ]);

  const loadMore = useCallback(async () => {
    if (!activeAccountId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const offset = threads.length;
      let dbThreads;
      if (activeLabel === "inbox" && activeCategory !== "All") {
        dbThreads = await getThreadsForCategory(
          activeAccountId,
          activeCategory,
          PAGE_SIZE,
          offset,
        );
      } else {
        const gmailLabelId = LABEL_MAP[activeLabel] ?? activeLabel;
        dbThreads = await getThreadsForAccount(
          activeAccountId,
          gmailLabelId || undefined,
          PAGE_SIZE,
          offset,
        );
      }

      const mapped = await mapDbThreads(dbThreads);
      if (mapped.length > 0) {
        setThreads([...threads, ...mapped]);
      }
      setHasMore(dbThreads.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load more threads:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeAccountId,
    activeLabel,
    activeCategory,
    threads,
    loadingMore,
    hasMore,
    setThreads,
    mapDbThreads,
  ]);

  type CustomRowProps = {
    threads: Thread[];
    selectedThreadId: string | null;
    handleThreadClick: (thread: Thread) => void;
    handleThreadContextMenu: (e: React.MouseEvent, threadId: string) => void;
    categoryMap: Map<string, string>;
    followUpThreadIds: Set<string>;
    activeLabel: string;
    activeCategory: string;
    onArchive?: (threadId: string) => void;
    onDelete?: (threadId: string) => void;
    onMarkRead?: (threadId: string) => void;
    onMarkUnread?: (threadId: string) => void;
    onStar?: (threadId: string) => void;
  };

  const ThreadRow = ({
    index,
    style,
    ariaAttributes,
    threads,
    selectedThreadId,
    handleThreadClick,
    handleThreadContextMenu,
    categoryMap,
    followUpThreadIds,
    activeLabel,
    activeCategory,
    onArchive,
    onDelete,
    onMarkRead,
    onMarkUnread,
    onStar,
  }: {
    index: number;
    style: CSSProperties;
    ariaAttributes: Record<string, unknown>;
  } & CustomRowProps) => {
    const thread = threads[index]!;
    const prevThread = index > 0 ? threads[index - 1] : undefined;
    const showDivider = prevThread?.isPinned && !thread.isPinned;

    return (
      <div style={style} {...ariaAttributes} data-thread-id={thread.id}>
        {showDivider && (
          <div className="px-4 py-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-accent/10" />
              <span className="text-[0.625rem] font-medium text-text-tertiary/50 uppercase tracking-wider">
                {t("email.otherEmails")}
              </span>
              <div className="flex-1 h-px bg-accent/10" />
            </div>
          </div>
        )}
        <ThreadCard
          thread={thread}
          isSelected={thread.id === selectedThreadId}
          onClick={handleThreadClick}
          onContextMenu={handleThreadContextMenu}
          category={categoryMap.get(thread.id)}
          showCategoryBadge={
            activeLabel === "inbox" && activeCategory === "All"
          }
          hasFollowUp={followUpThreadIds.has(thread.id)}
          onArchive={onArchive}
          onDelete={onDelete}
          onMarkRead={onMarkRead}
          onMarkUnread={onMarkUnread}
          onStar={onStar}
        />
      </div>
    );
  };

  // ─── @tanstack/react-virtual based virtualizer for mobile ────────────────
  const parentRef = useRef<HTMLDivElement>(null);
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  
  const mobileVirtualizer = useVirtualizer({
    count: visibleThreads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: isMobileDevice ? 5 : 10,
    getItemKey: (index) => visibleThreads[index]!.id,
  });

  // Infinite scroll: load more when scroll nears the bottom
  const handleMobileScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const { scrollHeight, scrollTop, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 600) {
      loadMore();
    }
  }, [loadMore]);

  // ─── @tanstack/react-virtual based virtualizer for desktop ──────────────
  const desktopVirtualizer = useVirtualizer({
    count: visibleThreads.length,
    getScrollElement: () => listWrapperRef.current,
    estimateSize: () => 72,
    overscan: 5,
    getItemKey: (index) => visibleThreads[index]!.id,
  });

  // Infinite scroll for desktop via scroll events
  const handleDesktopScroll = useCallback(() => {
    const el = listWrapperRef.current;
    if (!el) return;
    const { scrollHeight, scrollTop, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 600) {
      loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Stable thread ID key — only changes when the actual set of thread IDs changes, not on every array reference
  const threadIdKey = useMemo(
    () => threads.map((t) => t.id).join(","),
    [threads],
  );

  // Load all thread metadata (categories, unread counts, follow-ups, bundles) in one coordinated effect
  useEffect(() => {
    let cancelled = false;

    if (!activeAccountId) {
      setCategoryMap(new Map());
      setCategoryUnreadCounts(new Map());
      setFollowUpThreadIds(new Set());
      setBundleRules([]);
      setHeldThreadIds(new Set());
      setBundleSummaries(new Map());
      return;
    }

    const threadIds = threadIdKey ? threadIdKey.split(",") : [];
    const isInbox = activeLabel === "inbox";
    const isAllCategory = activeCategory === "All";

    const loadMetadata = async () => {
      try {
        // Build all promises based on current view
        const promises: Promise<void>[] = [];

        // Categories (only for inbox "All" tab with threads)
        if (isInbox && isAllCategory && threadIds.length > 0) {
          promises.push(
            getCategoriesForThreads(activeAccountId, threadIds).then(
              (result) => {
                if (!cancelled) setCategoryMap(result);
              },
            ),
          );
        } else {
          setCategoryMap(new Map());
        }

        // Unread counts (only for inbox)
        if (isInbox) {
          promises.push(
            getCategoryUnreadCounts(activeAccountId).then((result) => {
              if (!cancelled) setCategoryUnreadCounts(result);
            }),
          );
        } else {
          setCategoryUnreadCounts(new Map());
        }

        // User override counts (only for inbox)
        if (isInbox) {
          promises.push(
            getUserOverrides(activeAccountId).then((overrides) => {
              if (!cancelled) {
                const counts = new Map<string, number>();
                for (const o of overrides) {
                  counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
                }
                setUserOverrideCounts(counts);
              }
            }),
          );
        } else {
          setUserOverrideCounts(new Map());
        }

        // Follow-up indicators
        if (threadIds.length > 0) {
          promises.push(
            getActiveFollowUpThreadIds(activeAccountId, threadIds)
              .then((result) => {
                if (!cancelled) setFollowUpThreadIds(result);
              })
              .catch(() => {
                if (!cancelled) setFollowUpThreadIds(new Set());
              }),
          );
        } else {
          setFollowUpThreadIds(new Set());
        }

        // Bundle rules + held threads (only for inbox)
        if (isInbox) {
          promises.push(
            getBundleRules(activeAccountId)
              .then(async (rules) => {
                if (cancelled) return;
                const bundled = rules.filter((r) => r.is_bundled);
                setBundleRules(bundled);
                // Batch-fetch all summaries in 2 queries instead of 2N
                if (bundled.length > 0) {
                  const summaries = await getBundleSummaries(
                    activeAccountId,
                    bundled.map((r) => r.category),
                  ).catch(() => new Map());
                  if (!cancelled) setBundleSummaries(summaries);
                } else {
                  if (!cancelled) setBundleSummaries(new Map());
                }
              })
              .catch(() => {
                if (!cancelled) setBundleRules([]);
              }),
          );
          promises.push(
            getHeldThreadIds(activeAccountId)
              .then((result) => {
                if (!cancelled) setHeldThreadIds(result);
              })
              .catch(() => {
                if (!cancelled) setHeldThreadIds(new Set());
              }),
          );
        } else {
          setBundleRules([]);
          setHeldThreadIds(new Set());
          setBundleSummaries(new Map());
        }

        await Promise.all(promises);
      } catch (err) {
        console.error("Failed to load thread metadata:", err);
      }
    };

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [threadIdKey, activeLabel, activeCategory, activeAccountId]);

  // Auto-scroll selected thread into view via virtual list (keyboard navigation)
  useEffect(() => {
    if (!selectedThreadId) return;
    const idx = visibleThreads.findIndex((t) => t.id === selectedThreadId);
    if (idx >= 0) {
      desktopVirtualizer.scrollToIndex(idx, { align: "start" });
    }
  }, [selectedThreadId, visibleThreads, desktopVirtualizer]);

  // Listen for sync completion to reload (debounced to avoid waterfall from multiple emitters)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refetchThreads(), 500);
    };
    window.addEventListener("smemaster-sync-done", handler);
    return () => {
      window.removeEventListener("smemaster-sync-done", handler);
      if (timer) clearTimeout(timer);
    };
  }, [refetchThreads]);

  // Clean up unused refs periodically to prevent memory leaks
  useEffect(() => {
    const threadIds = new Set(visibleThreads.map((t) => t.id));
    const refsToDelete: string[] = [];
    nodeRefsMap.current.forEach((_, key) => {
      if (!threadIds.has(key)) {
        refsToDelete.push(key);
      }
    });
    refsToDelete.forEach((key) => nodeRefsMap.current.delete(key));
  }, [visibleThreads]);

  // Keyboard shortcuts: V (cycle views), Escape (clear selection), Cmd+K/Ctrl+K (command)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Clear multi-select and dismiss banners
      if (e.key === "Escape") {
        if (multiSelectCount > 0) {
          clearMultiSelect();
        }
        if (showAiSuggestion) {
          setShowAiSuggestion(false);
        }
        return;
      }

      // Only trigger shortcuts when not typing in an input
      const target = e.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";
      if (isInputElement) return;

      // V: Cycle view modes (list → kanban → calendar → agenda)
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const modes: Array<typeof viewMode> = ["list", "kanban", "calendar", "agenda"];
        const currentIdx = modes.indexOf(viewMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        const nextMode = modes[nextIdx]!;
        setViewMode(nextMode);
        return;
      }

      // Cmd+K / Ctrl+K: Open command palette (TODO: implement command palette)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // TODO: Open command palette for mail actions
        console.log("Command palette shortcut triggered (Cmd+K / Ctrl+K)");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, setViewMode, multiSelectCount, clearMultiSelect, showAiSuggestion]);

  // ── Computed label display name ──────────────────────────────────────────
  const labelDisplayName = useMemo(() => {
    if (isSmartFolder) {
      return activeSmartFolder?.name ?? "Smart Folder";
    }
    if (
      activeLabel === "inbox" &&
      inboxViewMode === "split" &&
      activeCategory !== "All"
    ) {
      return t("email.inboxCategory", { category: activeCategory });
    }
    if (LABEL_MAP[activeLabel] !== undefined) {
      return activeLabel;
    }
    return userLabels.find((l) => l.id === activeLabel)?.name ?? activeLabel;
  }, [
    isSmartFolder,
    activeSmartFolder,
    activeLabel,
    inboxViewMode,
    activeCategory,
    t,
    userLabels,
  ]);

  return (
    <div
      ref={listRef}
      className={`flex flex-col h-screen ${
        isMobileDevice
          ? "w-full flex-1"
          : readingPanePosition === "right"
            ? "min-w-[240px] shrink-0"
            : readingPanePosition === "bottom"
              ? "w-full h-[40%] min-h-[200px]"
              : "w-full flex-1"
      }`}
      style={
        !isMobileDevice && readingPanePosition === "right" && width
          ? { width }
          : undefined
      }
    >
      {/* Mail Top Bar */}
      <MailTopBar
        activeLabel={activeLabel}
        labelDisplayName={labelDisplayName}
        conversationCount={filteredThreads.length}
        isSmartFolder={isSmartFolder}
        readFilter={readFilter}
        onReadFilterChange={(filter) => setReadFilter(filter)}
        onRefresh={refetchThreads}
      />

      {/* Saved views (split inbox) */}
      <SavedViews />

      {/* Category tabs (inbox + split mode only) */}
      {activeLabel === "inbox" && inboxViewMode === "split" && (
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          unreadCounts={Object.fromEntries(categoryUnreadCounts)}
          userOverrideCounts={Object.fromEntries(userOverrideCounts)}
        />
      )}

      {/* Bundle category tabs — shown when bundle rules are configured */}
      {activeLabel === "inbox" && bundleRules.length > 0 && (
        <BundleCategoryTabs
          activeBundleCategory={activeBundleCategory}
          onBundleCategoryChange={setActiveBundleCategory}
          bundleRules={bundleRules}
          unreadCounts={Object.fromEntries(categoryUnreadCounts)}
        />
      )}

      {/* Filter bar — single scrollable row (no wrap on mobile) */}
      <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 border-b border-border-primary bg-bg-secondary/40 overflow-x-auto hide-scrollbar flex-nowrap">
        <FilterBar
          config={{
            status: {
              label: "Status",
              value: readFilter,
              options: [
                { value: "all", label: "All" },
                { value: "unread", label: "Unread" },
                { value: "read", label: "Read" },
              ],
            },
            sortBy: {
              label: "Sort",
              value: filters.sortBy ?? "date",
              options: [
                { value: "date", label: "Date" },
                { value: "sender", label: "Sender" },
              ],
            },
          }}
          onFilterChange={(filterName, value) => {
            setFilters((prev) => ({ ...prev, [filterName]: value }));
            if (filterName === "status") {
              setReadFilter(value as "all" | "read" | "unread");
            }
          }}
          compact
          showLabel={false}
        />
        <span className="w-px h-5 bg-border-primary shrink-0" />
        <ViewModeToggle activeMode={viewMode} onChange={setViewMode} compact showLabels={false} />
      </div>

      {/* AI Suggestion Banner — only shown when AI feature is not locked */}
      {!isAiLocked && aiAvailable && showAiSuggestion && activeLabel === "inbox" && filteredThreads.length > 0 && (
        <div className="px-3 py-2">
          <AiSuggestionBanner
            suggestion={{
              id: "tasks-extract-001",
              title: "AI Task Detection",
              description: "3 action items detected in your recent emails",
              count: 3,
              type: "task",
            }}
            onReview={() => {
              // TODO: Open task extraction panel
              setShowAiSuggestion(false);
            }}
            onDismiss={() => setShowAiSuggestion(false)}
            variant="info"
          />
        </div>
      )}

      {/* Multi-select action bar */}
      <CSSTransition
        nodeRef={multiSelectBarRef}
        in={multiSelectCount > 0}
        timeout={150}
        classNames="slide-down"
        unmountOnExit
      >
        <div
          ref={multiSelectBarRef}
          className="px-3 py-2 border-b border-border-primary glass-accent-tint flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">
              {t("email.nSelected", { n: multiSelectCount })}
            </span>
            {multiSelectCount < filteredThreads.length && (
              <button
                onClick={selectAll}
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                {t("email.selectAll")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleBulkArchive}
              title={t("email.archiveSelected")}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:glass-accent-tint rounded transition-all duration-150"
            >
              <Archive size={14} />
            </button>
            <button
              onClick={handleBulkDelete}
              title={t("email.deleteSelected")}
              className="p-1.5 text-text-secondary hover:text-error hover:glass-accent-tint rounded transition-all duration-150"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={handleBulkSpam}
              title={
                activeLabel === "spam"
                  ? t("email.notSpam")
                  : t("email.reportSpam")
              }
              className="p-1.5 text-text-secondary hover:text-text-primary hover:glass-accent-tint rounded transition-all duration-150"
            >
              <Ban size={14} />
            </button>
            <button
              onClick={clearMultiSelect}
              title={t("email.clearSelection")}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:glass-accent-tint rounded transition-all duration-150"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </CSSTransition>

      {/* Thread list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search context indicator */}
        {searchQuery && (
          <div className="px-3 py-1 flex items-center gap-2 border-b border-border-primary/30 bg-accent-subtle/40">
            <span className="text-[0.625rem] font-medium text-accent">Search</span>
            <span className="text-[0.625rem] text-text-tertiary truncate">"{searchQuery}"</span>
          </div>
        )}
        {isLoading && threads.length === 0 ? (
          <EmailListSkeleton />
        ) : filteredThreads.length === 0 && bundleRules.length === 0 ? (
          <EmptyStateForContext
            searchQuery={searchQuery}
            activeAccountId={activeAccountId}
            activeLabel={activeLabel}
            readFilter={readFilter}
            activeCategory={activeCategory}
          />
        ) : (
          <>
            {/* Bundle rows — shown in "All" view or single bundle category view */}
            {viewMode === "list" &&
              activeLabel === "inbox" &&
              activeCategory === "All" &&
              (() => {
                // When a specific bundle category tab is active, show only that bundle pre-expanded
                if (activeBundleCategory !== "All") {
                  const rule = bundleRules.find(
                    (r) => r.category === activeBundleCategory,
                  );
                  if (!rule) return null;
                  const summary = bundleSummaries.get(rule.category);
                  if (!summary || summary.count === 0) return null;
                  const bundledThreads = filteredThreads.filter(
                    (t) => categoryMap.get(t.id) === rule.category,
                  );
                  return (
                    <div className="border-b border-border-primary/40 bg-accent/5">
                      <div className="px-4 py-2 flex items-center justify-between border-b border-border-primary/40">
                        <span className="text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                          <Package size={13} />
                          {rule.category} · {summary.count} thread
                          {summary.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <BundleRow
                        rule={rule}
                        summary={summary}
                        isExpanded={true}
                        onToggle={() => setActiveBundleCategory("All")}
                        bundledThreads={bundledThreads}
                        selectedThreadId={selectedThreadId}
                        onThreadClick={handleThreadClick}
                        onThreadContextMenu={handleThreadContextMenu}
                        followUpThreadIds={followUpThreadIds}
                      />
                    </div>
                  );
                }

                // Default "All" view: show each bundle as a collapsible row
                return bundleRules.map((rule) => {
                  const summary = bundleSummaries.get(rule.category);
                  if (!summary || summary.count === 0) return null;
                  const isExpanded = expandedBundles.has(rule.category);
                  const bundledThreads = isExpanded
                    ? filteredThreads.filter(
                        (t) => categoryMap.get(t.id) === rule.category,
                      )
                    : [];
                  return (
                    <BundleRow
                      key={`bundle-${rule.category}`}
                      rule={rule}
                      summary={summary}
                      isExpanded={isExpanded}
                      onToggle={(cat) => {
                        setExpandedBundles((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat)) next.delete(cat);
                          else next.add(cat);
                          return next;
                        });
                      }}
                      bundledThreads={bundledThreads}
                      selectedThreadId={selectedThreadId}
                      onThreadClick={handleThreadClick}
                      onThreadContextMenu={handleThreadContextMenu}
                      followUpThreadIds={followUpThreadIds}
                    />
                  );
                });
              })()}

            {/* Virtualized thread list */}
            {viewMode === "list" &&
              visibleThreads.length > 0 &&
              (isMobileDevice ? (
                /* ── Mobile: @tanstack/react-virtual ── */
                <PullToRefresh onRefresh={loadThreads}>
                  <div
                    ref={parentRef}
                    onScroll={handleMobileScroll}
                    className="flex-1 overflow-auto h-full"
                  >
                    <div
                      style={{
                        height: `${mobileVirtualizer.getTotalSize()}px`,
                        position: "relative",
                      }}
                    >
                      <TransitionGroup component={null}>
                        {mobileVirtualizer
                          .getVirtualItems()
                          .map((virtualItem) => {
                            const thread = visibleThreads[virtualItem.index]!;
                            const prevThread =
                              virtualItem.index > 0
                                ? visibleThreads[virtualItem.index - 1]
                                : undefined;
                            const showDivider =
                              prevThread?.isPinned && !thread.isPinned;

                            const leftAction = gestureActions.find(a => a.direction === 'left');
                            const longLeftAction = gestureActions.find(a => a.direction === 'long-left');
                            const rightAction = gestureActions.find(a => a.direction === 'right');

                            const swipeActions: SwipeActions = {};
                            if (leftAction || longLeftAction) {
                              swipeActions.left = {};
                              if (leftAction) {
                                swipeActions.left.primary = {
                                  label: leftAction.label,
                                  icon: leftAction.id,
                                  color: leftAction.color || 'bg-gray-500',
                                  onAction: () => {
                                    triggerHaptic("heavy");
                                    if (activeAccountId) {
                                      const prevThread = useThreadStore
                                        .getState()
                                        .threadMap.get(thread.id);
                                      optimisticStore
                                        .run({
                                          id: `archive-${thread.id}`,
                                          description: `Archive ${thread.id}`,
                                          apply: () => {
                                            useThreadStore
                                              .getState()
                                              .updateThread(thread.id, {
                                                isRead: true,
                                              });
                                          },
                                          execute: () =>
                                            archiveMutation.mutateAsync({
                                              accountId: activeAccountId,
                                              threadId: thread.id,
                                            }),
                                          rollback: () => {
                                            if (prevThread)
                                              useThreadStore
                                                .getState()
                                                .updateThread(
                                                  thread.id,
                                                  prevThread,
                                                );
                                          },
                                        })
                                        .catch((err) => console.error("Archive swipe failed:", err));
                                    }
                                  },
                                };
                              }
                              if (longLeftAction) {
                                swipeActions.left.secondary = {
                                  label: longLeftAction.label,
                                  icon: longLeftAction.id,
                                  color: longLeftAction.color || 'bg-gray-500',
                                  onAction: () => {
                                    triggerHaptic("heavy");
                                    if (activeAccountId) {
                                      const prevThread = useThreadStore
                                        .getState()
                                        .threadMap.get(thread.id);
                                      optimisticStore
                                        .run({
                                          id: `delete-${thread.id}`,
                                          description: `Delete ${thread.id}`,
                                          apply: () => {
                                            useThreadStore
                                              .getState()
                                              .updateThread(thread.id, {
                                                isRead: true,
                                              });
                                          },
                                          execute: () =>
                                            deleteMutation.mutateAsync({
                                              accountId: activeAccountId,
                                              threadId: thread.id,
                                              permanent:
                                                activeLabel === "trash",
                                            }),
                                          rollback: () => {
                                            if (prevThread)
                                              useThreadStore
                                                .getState()
                                                .updateThread(
                                                  thread.id,
                                                  prevThread,
                                                );
                                          },
                                        })
                                        .catch((err) => console.error("Delete swipe failed:", err));
                                    }
                                  },
                                  destructive: true,
                                };
                              }
                            }
                            if (rightAction) {
                              swipeActions.right = {
                                primary: {
                                  label: rightAction.label,
                                  icon: rightAction.id,
                                  color: rightAction.color || 'bg-gray-500',
                                  onAction: () => {
                                    triggerHaptic("heavy");
                                    if (activeAccountId) {
                                      // Default snooze: 8 hours (later today)
                                      const until =
                                        getCurrentUnixTimestamp() + 8 * 60 * 60;
                                      snoozeThread(
                                        activeAccountId,
                                        thread.id,
                                        until,
                                      ).catch(() => {});
                                      // Optimistically remove from current view
                                      useThreadStore
                                        .getState()
                                        .removeThread(thread.id);
                                    }
                                  },
                                },
                              };
                            }

                              const nodeRef = { current: nodeRefsMap.current.get(thread.id) ?? null };

                            return (
                              <CSSTransition
                                key={thread.id}
                                timeout={300}
                                classNames="thread-item"
                                nodeRef={nodeRef}
                              >
                                <div
                                  ref={(node) => setNodeRef(thread.id, node)}
                                  key={virtualItem.key}
                                  data-thread-id={thread.id}
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: `${virtualItem.size}px`,
                                    transform: `translateY(${virtualItem.start}px)`,
                                  }}
                                >
                                  {showDivider && (
                                    <div className="px-4 py-1.5">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-px bg-accent/10" />
                                        <span className="text-[0.625rem] font-medium text-text-tertiary/50 uppercase tracking-wider">
                                          {t("email.otherEmails")}
                                        </span>
                                        <div className="flex-1 h-px bg-accent/10" />
                                      </div>
                                    </div>
                                  )}
                                  <SwipeableRow
                                    actions={swipeActions}
                                    threshold={80}
                                  >
                                    <ThreadCard
                                      thread={thread}
                                      isSelected={
                                        thread.id === selectedThreadId
                                      }
                                      onClick={handleThreadClick}
                                      onContextMenu={handleThreadContextMenu}
                                      category={categoryMap.get(thread.id)}
                                      showCategoryBadge={
                                        activeLabel === "inbox" &&
                                        activeCategory === "All"
                                      }
                                      hasFollowUp={followUpThreadIds.has(
                                        thread.id,
                                      )}
                                      onArchive={handleArchive}
                                      onDelete={handleDelete}
                                      onMarkRead={handleMarkRead}
                                      onMarkUnread={handleMarkUnread}
                                      onStar={handleStarThread}
                                    />
                                  </SwipeableRow>
                                </div>
                              </CSSTransition>
                            );
                          })}
                      </TransitionGroup>
                    </div>
                  </div>
                </PullToRefresh>
              ) : (
                /* ── Desktop: @tanstack/react-virtual ── */
                <div
                  ref={listWrapperRef}
                  className="flex-1"
                  style={{ position: "relative", overflow: "auto" }}
                  onScroll={handleDesktopScroll}
                >
                  <div
                    style={{
                      height: `${desktopVirtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {desktopVirtualizer.getVirtualItems().map((virtualItem) => {
                      return (
                        <div
                          key={virtualItem.key}
                          data-index={virtualItem.index}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                        >
                          <ThreadRow
                            index={virtualItem.index}
                            style={{} as CSSProperties}
                            ariaAttributes={{}}
                            threads={visibleThreads}
                            selectedThreadId={selectedThreadId}
                            handleThreadClick={handleThreadClick}
                            handleThreadContextMenu={handleThreadContextMenu}
                            categoryMap={categoryMap}
                            followUpThreadIds={followUpThreadIds}
                            activeLabel={activeLabel}
                            activeCategory={activeCategory}
                            onArchive={handleArchive}
                            onDelete={handleDelete}
                            onMarkRead={handleMarkRead}
                            onMarkUnread={handleMarkUnread}
                            onStar={handleStarThread}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

            {viewMode === "kanban" && (
              <ThreadKanbanView
                threads={visibleThreads}
                selectedThreadId={selectedThreadId}
                onThreadClick={handleThreadClick}
                onThreadContextMenu={handleThreadContextMenu}
                categoryMap={categoryMap}
                followUpThreadIds={followUpThreadIds}
                showCategoryBadges={
                  activeLabel === "inbox" && activeCategory === "All"
                }
              />
            )}

            {viewMode === "calendar" && (
              <ThreadCalendarView
                threads={visibleThreads}
                selectedThreadId={selectedThreadId}
                onThreadClick={handleThreadClick}
                onThreadContextMenu={handleThreadContextMenu}
                categoryMap={categoryMap}
                followUpThreadIds={followUpThreadIds}
                showCategoryBadges={
                  activeLabel === "inbox" && activeCategory === "All"
                }
              />
            )}

            {viewMode === "agenda" && (
              <ThreadAgendaView
                threads={visibleThreads}
                selectedThreadId={selectedThreadId}
                onThreadClick={handleThreadClick}
                onThreadContextMenu={handleThreadContextMenu}
                categoryMap={categoryMap}
                followUpThreadIds={followUpThreadIds}
                showCategoryBadges={
                  activeLabel === "inbox" && activeCategory === "All"
                }
              />
            )}

            {/* Loading indicators */}
            {loadingMore && (
              <div className="px-4 py-3 text-center text-xs text-text-tertiary">
                {t("email.loadingMore")}
              </div>
            )}
            {!hasMore && threads.length > PAGE_SIZE && (
              <div className="px-4 py-3 text-center text-xs text-text-tertiary">
                {t("email.allConversationsLoaded")}
              </div>
            )}

            {/* Infinite scroll sentinel — triggers loadMore when scrolled into view */}
            {hasMore && (
              <InfiniteScrollSentinel
                onIntersect={loadMore}
                enabled={!loadingMore}
                loading={loadingMore}
                hasMore={hasMore}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}



function EmptyStateForContext({
  searchQuery,
  activeAccountId,
  activeLabel,
  readFilter,
  activeCategory,
}: {
  searchQuery: string | null;
  activeAccountId: string | null;
  activeLabel: string;
  readFilter: string;
  activeCategory: string;
}) {
  const { t } = useTranslation();
  const [showAddAccount, setShowAddAccount] = useState(false);
  if (searchQuery) {
    return (
      <EmptyState
        illustration={NoSearchResultsIllustration}
        title={t("email.noResultsFound")}
        subtitle={t("email.tryDifferentSearch")}
      />
    );
  }
  if (readFilter !== "all") {
    return (
      <EmptyState
        icon={Filter}
        title={t("email.noReadFilterEmails", { filter: readFilter })}
        subtitle={t("email.tryChangingFilter")}
      />
    );
  }
  if (!activeAccountId) {
    return (
      <>
        <EmptyState
          illustration={NoAccountIllustration}
          title={t("email.noAccountConnected")}
          subtitle={t("email.addAccountToStart")}
          action={
            <Button variant="primary" onClick={() => setShowAddAccount(true)}>
              {t("settings.addMailAccount")}
            </Button>
          }
        />
        {showAddAccount && (
          <AddAccount
            onClose={() => setShowAddAccount(false)}
            onSuccess={() => setShowAddAccount(false)}
          />
        )}
      </>
    );
  }

  switch (activeLabel) {
    case "inbox":
      if (activeCategory !== "All") {
        const categoryMessages: Record<
          string,
          { title: string; subtitle: string }
        > = {
          Primary: {
            title: t("email.primaryIsClear"),
            subtitle: t("empty.noImportantConversations"),
          },
          Updates: {
            title: t("empty.noUpdates"),
            subtitle: t("empty.updatesDescription"),
          },
          Promotions: {
            title: t("email.noPromotions"),
            subtitle: t("email.promotionsDescription"),
          },
          Social: {
            title: t("email.noSocialEmails"),
            subtitle: t("email.socialDescription"),
          },
          Newsletters: {
            title: t("email.noNewsletters"),
            subtitle: t("email.newslettersDescription"),
          },
        };
        const msg = categoryMessages[activeCategory];
        if (msg)
          return (
            <EmptyState
              illustration={InboxClearIllustration}
              title={msg.title}
              subtitle={msg.subtitle}
            />
          );
      }
      return (
        <EmptyState
          illustration={InboxClearIllustration}
          title={t("email.allCaughtUp")}
          subtitle={t("email.noNewConversations")}
        />
      );
    case "starred":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.noStarredConversations")}
          subtitle={t("email.starEmailsToFind")}
        />
      );
    case "snoozed":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.noSnoozedEmails")}
          subtitle={t("email.snoozedEmailsAppearHere")}
        />
      );
    case "sent":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.noSentMessages")}
        />
      );
    case "drafts":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.noDrafts")}
        />
      );
    case "trash":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.trashIsEmpty")}
        />
      );
    case "spam":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.noSpam")}
          subtitle={t("email.lookingGood")}
        />
      );
    case "all":
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.noEmailsYet")}
        />
      );
    default:
      if (activeLabel.startsWith("smart-folder:")) {
        return (
          <EmptyState
            icon={FolderSearch}
            title={t("email.noMatchingEmails")}
            subtitle={t("email.adjustSmartFolderQuery")}
          />
        );
      }
      return (
        <EmptyState
          illustration={GenericEmptyIllustration}
          title={t("email.nothingHere")}
          subtitle={t("email.noConversationsWithThisLabel")}
        />
      );
  }
}
