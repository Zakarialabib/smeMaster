import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDroppable } from "@dnd-kit/core";
import { LabelForm } from "@features/mail/components/labels/LabelForm";
import { InputDialog } from "@shared/components/ui/InputDialog";
import { useDensity } from "@shared/hooks/useDensity";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useSyncStore } from "@shared/stores/syncStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { useLabelStore, type Label } from "@features/mail/stores/labelStore";
import { useContextMenuStore } from "@features/mail/stores/contextMenuStore";
import { useSmartFolderStore } from "@features/mail/stores/smartFolderStore";
import {
  useActiveLabel,
  useActiveCategory,
} from "@shared/hooks/useRouteNavigation";
import { navigateToLabel } from "@/router/navigate";
import { getCategoryUnreadCounts } from "@features/mail/db/threadCategories";

import { isDevProMode } from "@/constants/featureFlags";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useTaskStore } from "@features/tasks/stores/taskStore";
import { AccountSwitcher } from "@features/accounts/components/AccountSwitcher";
import { AddAccount } from "@features/accounts/components/AddAccount";
import { ALL_NAV_ITEMS } from "./navConfig";
import type { NavRailGroup } from "./NavRail";
import {
  Plus,
  Tag,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Columns2,
  Bell,
  Users,
  Newspaper,
  Search,
  MailOpen,
  Paperclip,
  FolderSearch,
  Loader2,
  Star,
  Clock,
  Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PremiumSidebarProps {
  groups: NavRailGroup[];
  activeGroupId: string;
  activeSubItemId: string | null;
  onGroupSelect: (groupId: string) => void;
  onSubItemSelect: (groupId: string, subItemId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIVIDER_ID = "__divider__";
const DENSITY_GAP_MAP: Record<string, string> = {
  "gap-6 p-6": "gap-3",
  "gap-4 p-4": "gap-2",
  "gap-2 p-2": "gap-1",
};

const CATEGORY_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "Primary", label: "categories.primary", icon: Inbox },
  { id: "Updates", label: "categories.updates", icon: Bell },
  { id: "Promotions", label: "categories.promotions", icon: Tag },
  { id: "Social", label: "categories.social", icon: Users },
  { id: "Newsletters", label: "categories.newsletters", icon: Newspaper },
];

const LABELS_COLLAPSED_COUNT = 3;

const SMART_FOLDER_ICON_MAP: Record<string, LucideIcon> = {
  Search,
  MailOpen,
  Paperclip,
  Star,
  FolderSearch,
  Inbox,
  Clock,
  Tag,
};

function getSmartFolderIcon(iconName: string): LucideIcon {
  return SMART_FOLDER_ICON_MAP[iconName] ?? Search;
}

// ─── DroppableNavItem ─────────────────────────────────────────────────────────

function DroppableNavItem({
  id,
  isActive,
  collapsed,
  onClick,
  onContextMenu,
  title,
  children,
}: {
  id: string;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  title?: string;
  children: (isOver: boolean) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      className={`sidebar-nav-item flex items-center w-full py-2 text-sm transition-all duration-150 press-scale ${collapsed ? "justify-center px-0" : "gap-3 px-3 text-left"
        } ${isOver
          ? "glass-accent-tint ring-1 ring-accent"
          : isActive
            ? "glass-accent-tint text-accent font-medium"
            : "hover:glass-accent-tint text-sidebar-text hover:text-text-primary"
        }`}
    >
      {children(isOver)}
    </button>
  );
}

// ─── DroppableLabelItem ───────────────────────────────────────────────────────

function DroppableLabelItem({
  label,
  isActive,
  collapsed,
  unreadCount,
  onClick,
  onContextMenu,
  onEditClick,
}: {
  label: Label;
  isActive: boolean;
  collapsed: boolean;
  unreadCount?: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onEditClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: label.id });
  const initial = (label.name[0] ?? "?").toUpperCase();

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={collapsed ? label.name : undefined}
      className={`sidebar-nav-item group flex items-center w-full py-2 text-sm transition-all duration-150 ${collapsed ? "justify-center px-0" : "gap-3 px-3 text-start"
        } ${isOver
          ? "glass-accent-tint ring-1 ring-accent"
          : isActive
            ? "glass-accent-tint text-accent font-medium"
            : "hover:glass-accent-tint text-sidebar-text hover:text-text-primary"
        }`}
    >
      {collapsed ? (
        <span
          className="relative w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0"
          style={
            label.colorBg
              ? {
                backgroundColor: label.colorBg,
                color: label.colorFg ?? "#ffffff",
              }
              : undefined
          }
        >
          {label.colorBg ? initial : <Tag size={14} />}
          {unreadCount !== undefined && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center bg-accent text-white text-[0.5rem] font-bold rounded-full transition-all duration-300">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </span>
      ) : (
        <>
          {label.colorBg ? (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: label.colorBg }}
            />
          ) : (
            <Tag size={14} className="shrink-0 text-text-tertiary" />
          )}
          <span className="flex-1 truncate text-start">{label.name}</span>
          {unreadCount !== undefined && unreadCount > 0 && (
            <span className="text-[0.625rem] bg-accent/15 text-accent px-1.5 rounded-full leading-normal transition-all duration-300 me-0.5">
              {unreadCount}
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onEditClick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onEditClick();
              }
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-sidebar-text/40 hover:text-sidebar-text transition-opacity"
            title="Edit label"
          >
            <Pencil size={12} />
          </span>
        </>
      )}
    </button>
  );
}

// ─── PendingOpsIndicator ──────────────────────────────────────────────────────

function PendingOpsIndicator({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const pendingOpsCount = useSyncStore((s) => s.pendingOpsCount);
  if (pendingOpsCount <= 0) return null;

  return (
    <div className="px-3 py-2 border-t border-border-primary">
      {collapsed ? (
        <div className="flex justify-center">
          <span className="bg-accent/20 text-accent text-xs font-medium px-1.5 py-0.5 rounded-full">
            {pendingOpsCount}
          </span>
        </div>
      ) : (
        <div className="text-xs text-text-tertiary">
          {t("nav.nPending", { n: pendingOpsCount })}
        </div>
      )}
    </div>
  );
}

// ─── PremiumSidebar ───────────────────────────────────────────────────────────

export function PremiumSidebar({
  groups,
  activeGroupId,
  activeSubItemId,
  onGroupSelect,
  onSubItemSelect,
}: PremiumSidebarProps) {
  const { t } = useTranslation();
  const { spacingClass } = useDensity();
  const gapClass = DENSITY_GAP_MAP[spacingClass] ?? "gap-2";

  // ── Layout store ────────────────────────────────────────────────────────
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const sidebarNavConfig = useLayoutStore((s) => s.sidebarNavConfig);
  const inboxViewMode = useLayoutStore((s) => s.inboxViewMode);
  const setInboxViewMode = useLayoutStore((s) => s.setInboxViewMode);

  // ── Route state ─────────────────────────────────────────────────────────
  const activeLabel = useActiveLabel();
  const activeCategory = useActiveCategory();

  // ── Account store ───────────────────────────────────────────────────────
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountId),
    [accounts, activeAccountId],
  );

  // ── Composer store ──────────────────────────────────────────────────────
  const openComposer = useComposerStore((s) => s.openComposer);

  // ── Label store ─────────────────────────────────────────────────────────
  const labels = useLabelStore((s) => s.labels);
  const loadLabels = useLabelStore((s) => s.loadLabels);
  const deleteLabel = useLabelStore((s) => s.deleteLabel);

  // ── Smart folder store ──────────────────────────────────────────────────
  const smartFolders = useSmartFolderStore((s) => s.folders);
  const smartFolderCounts = useSmartFolderStore((s) => s.unreadCounts);
  const loadSmartFolders = useSmartFolderStore((s) => s.loadFolders);
  const refreshSmartFolderCounts = useSmartFolderStore(
    (s) => s.refreshUnreadCounts,
  );
  const createSmartFolder = useSmartFolderStore((s) => s.createFolder);

  // ── Thread store ────────────────────────────────────────────────────────
  const threadUnreadCounts = useThreadStore((s) => s.unreadCounts);
  const loadUnreadCounts = useThreadStore((s) => s.loadUnreadCounts);

  // ── Sync store ──────────────────────────────────────────────────────────
  const isSyncingFolder = useSyncStore((s) => s.isSyncingFolder);

  // ── Task store ──────────────────────────────────────────────────────────
  const taskIncompleteCount = useTaskStore((s) => s.incompleteCount);

  // ── Context menu ────────────────────────────────────────────────────────
  const openMenu = useContextMenuStore((s) => s.openMenu);

  // ── Icon rail state ─────────────────────────────────────────────────────
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [focusedSubItemIndex, setFocusedSubItemIndex] = useState(-1);
  const navRef = useRef<HTMLDivElement>(null);
  const subItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // ── Labels state ────────────────────────────────────────────────────────
  const [labelsExpanded, setLabelsExpanded] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [showNewLabelForm, setShowNewLabelForm] = useState(false);
  const [showSmartFolderModal, setShowSmartFolderModal] = useState(false);

  // ── Category unread counts ──────────────────────────────────────────────
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(
    {},
  );

  // ── Add account modal ──────────────────────────────────────────────────
  const [showAddAccount, setShowAddAccount] = useState(false);

  // ── Derived: visible nav items from sidebarNavConfig ────────────────────
  const SECTION_IDS = useMemo(() => new Set(["smart-folders", "labels"]), []);

  const { visibleNavItems, showSmartFolders, showLabels } = useMemo(() => {
    if (!sidebarNavConfig) {
      const navOnly = ALL_NAV_ITEMS.filter((i) => !SECTION_IDS.has(i.id));
      return {
        visibleNavItems: navOnly,
        showSmartFolders: true,
        showLabels: true,
      };
    }
    const itemMap = new Map(ALL_NAV_ITEMS.map((item) => [item.id, item]));
    const result: typeof ALL_NAV_ITEMS = [];
    const seen = new Set<string>();
    let smartFoldersVisible = true;
    let labelsVisible = true;
    for (const entry of sidebarNavConfig) {
      seen.add(entry.id);
      if (entry.id === "smart-folders") {
        smartFoldersVisible = entry.visible;
        continue;
      }
      if (entry.id === "labels") {
        labelsVisible = entry.visible;
        continue;
      }
      if (entry.visible && itemMap.has(entry.id)) {
        result.push(itemMap.get(entry.id)!);
      }
    }
    for (const item of ALL_NAV_ITEMS) {
      if (!seen.has(item.id) && !SECTION_IDS.has(item.id)) result.push(item);
    }
    return {
      visibleNavItems: result,
      showSmartFolders: smartFoldersVisible,
      showLabels: labelsVisible,
    };
  }, [sidebarNavConfig, SECTION_IDS]);

  // ── Separate bottom groups (settings, help) from main groups ────────────
  const bottomIds = useMemo(() => new Set(["settings", "help"]), []);
  const bottomGroups = useMemo(
    () => groups.filter((g) => bottomIds.has(g.id)),
    [groups, bottomIds],
  );
  const mainGroups = useMemo(
    () => groups.filter((g) => !bottomIds.has(g.id)),
    [groups, bottomIds],
  );

  // ── Collapse only hides mail content panel ────────────────────────────
  // Icon rail is always visible on all pages. Settings/Help have their own
  // navigation panels that always show regardless of collapse state.
  // Only the mail content panel (folders, labels, smart folders) is affected
  // by sidebar collapse — this leaves 2 panels (icon rail + content) on all
  // pages, and 3 panels (icon rail + mail nav + email list) on mail expanded.

  // ── Ordered group IDs for keyboard navigation ──────────────────────────
  const orderedGroupIds = useMemo(
    () => [...mainGroups.map((g) => g.id), ...bottomGroups.map((g) => g.id)],
    [mainGroups, bottomGroups],
  );

  // ── Open panel for active group on mount / route change ────────────────
  useEffect(() => {
    const group = groups.find((g) => g.id === activeGroupId);
    if (group && group.items.length > 0) {
      setOpenGroupId(activeGroupId);
    } else {
      setOpenGroupId(null);
    }
    setFocusedSubItemIndex(-1);
  }, [activeGroupId, groups]);

  // ── Click outside to close the panel ───────────────────────────────────
  useEffect(() => {
    if (!openGroupId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroupId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openGroupId]);

  // ── Load data when account changes ─────────────────────────────────────
  const refreshCategoryCounts = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      const counts = await getCategoryUnreadCounts(activeAccountId);
      const merged: Record<string, number> = {};
      for (const [cat, count] of counts) {
        merged[cat] = count;
      }
      setCategoryCounts(merged);
    } catch (err) {
      console.error("Failed to refresh category counts:", err);
    }
  }, [activeAccountId]);

  useEffect(() => {
    if (activeAccountId) {
      loadLabels(activeAccountId);
      loadUnreadCounts(activeAccountId);
    }
  }, [activeAccountId, loadLabels, loadUnreadCounts]);

  useEffect(() => {
    loadSmartFolders(activeAccountId ?? undefined);
    if (activeAccountId) {
      refreshSmartFolderCounts(activeAccountId);
      refreshCategoryCounts();
    }
  }, [
    activeAccountId,
    loadSmartFolders,
    refreshSmartFolderCounts,
    refreshCategoryCounts,
  ]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (activeAccountId) {
          loadLabels(activeAccountId);
          loadUnreadCounts(activeAccountId);
          refreshSmartFolderCounts(activeAccountId);
          refreshCategoryCounts();
        }
        useSyncStore.getState().setSyncingFolder(null);
      }, 500);
    };
    window.addEventListener("smemaster-sync-done", handler);
    return () => {
      window.removeEventListener("smemaster-sync-done", handler);
      if (timer) clearTimeout(timer);
    };
  }, [
    activeAccountId,
    loadLabels,
    loadUnreadCounts,
    refreshSmartFolderCounts,
    refreshCategoryCounts,
  ]);

  // ── Keyboard navigation: icon rail ────────────────────────────────────
  const handleIconKeyDown = useCallback(
    (e: React.KeyboardEvent, currentId: string) => {
      const currentIndex = orderedGroupIds.indexOf(currentId);
      let nextIndex = -1;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          nextIndex = (currentIndex + 1) % orderedGroupIds.length;
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          nextIndex =
            (currentIndex - 1 + orderedGroupIds.length) %
            orderedGroupIds.length;
          break;
        }
        case "Home": {
          e.preventDefault();
          nextIndex = 0;
          break;
        }
        case "End": {
          e.preventDefault();
          nextIndex = orderedGroupIds.length - 1;
          break;
        }
        default:
          return;
      }

      const nextId = orderedGroupIds[nextIndex];
      if (nextId) {
        const btn = document.querySelector<HTMLButtonElement>(
          `[data-nav-icon-id="${nextId}"]`,
        );
        btn?.focus();
      }
    },
    [orderedGroupIds],
  );

  // ── Group icon click ──────────────────────────────────────────────────
  const handleGroupClick = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      const hasItems = group && group.items.length > 0;

      // Don't open flyout for settings/help — their content panel handles
      // navigation with search, sections, and richer UI.
      if (hasItems && groupId !== "settings" && groupId !== "help") {
        setOpenGroupId((prev) => (prev === groupId ? null : groupId));
      } else {
        setOpenGroupId(null);
      }

      onGroupSelect(groupId);
    },
    [groups, onGroupSelect],
  );

  // ── Panel keyboard navigation ────────────────────────────────────────
  const currentItems = useMemo(() => {
    const group = groups.find((g) => g.id === openGroupId);
    return group ? group.items : [];
  }, [groups, openGroupId]);

  const visibleItems = useMemo(
    () => currentItems.filter((item) => item.id !== DIVIDER_ID),
    [currentItems],
  );

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!openGroupId || visibleItems.length === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedSubItemIndex((prev) => (prev + 1) % visibleItems.length);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedSubItemIndex(
            (prev) => (prev - 1 + visibleItems.length) % visibleItems.length,
          );
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (
            focusedSubItemIndex >= 0 &&
            focusedSubItemIndex < visibleItems.length
          ) {
            const item = visibleItems[focusedSubItemIndex]!;
            onSubItemSelect(openGroupId, item.id);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setOpenGroupId(null);
          const iconBtn = document.querySelector<HTMLButtonElement>(
            `[data-nav-icon-id="${openGroupId}"]`,
          );
          iconBtn?.focus();
          break;
        }
      }
    },
    [openGroupId, visibleItems, focusedSubItemIndex, onSubItemSelect],
  );

  useEffect(() => {
    if (focusedSubItemIndex < 0) return;
    const visible = currentItems.filter((i) => i.id !== DIVIDER_ID);
    const item = visible[focusedSubItemIndex];
    if (item) {
      const btn = subItemRefs.current.get(item.id);
      btn?.focus();
    }
  }, [focusedSubItemIndex, currentItems]);

  const setSubItemRef = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      if (el) {
        subItemRefs.current.set(id, el);
      } else {
        subItemRefs.current.delete(id);
      }
    },
    [],
  );

  // ── Label handlers ───────────────────────────────────────────────────
  const handleDeleteLabel = useCallback(
    async (labelId: string) => {
      if (!activeAccountId) return;
      try {
        await deleteLabel(activeAccountId, labelId);
        if (editingLabelId === labelId) setEditingLabelId(null);
      } catch {
        // Silently fail in sidebar — user can use Settings for detailed errors
      }
    },
    [activeAccountId, deleteLabel, editingLabelId],
  );

  const handleFormDone = useCallback(() => {
    setEditingLabelId(null);
    setShowNewLabelForm(false);
  }, []);

  const handleEditLabel = useCallback((labelId: string) => {
    setShowNewLabelForm(false);
    setEditingLabelId(labelId);
  }, []);

  const handleAddLabel = useCallback(() => {
    setEditingLabelId(null);
    setShowNewLabelForm(true);
  }, []);

  const handleAddSmartFolder = useCallback(() => {
    setShowSmartFolderModal(true);
  }, []);

  const handleNavContextMenu = useCallback(
    (e: React.MouseEvent, navId: string) => {
      e.preventDefault();
      openMenu("sidebarNav", { x: e.clientX, y: e.clientY }, { navId });
    },
    [openMenu],
  );

  const handleLabelContextMenu = useCallback(
    (e: React.MouseEvent, labelId: string) => {
      e.preventDefault();
      openMenu(
        "sidebarLabel",
        { x: e.clientX, y: e.clientY },
        {
          labelId,
          onEdit: () => handleEditLabel(labelId),
          onDelete: () => handleDeleteLabel(labelId),
        },
      );
    },
    [openMenu, handleEditLabel, handleDeleteLabel],
  );

  const editingLabel = editingLabelId
    ? (labels.find((l) => l.id === editingLabelId) ?? null)
    : null;

  // ── Render: icon items ───────────────────────────────────────────────
  const renderIconItem = (group: NavRailGroup) => {
    const Icon = group.icon;
    const isActive = group.id === activeGroupId;

    return (
      <div
        key={group.id}
        className="relative group flex items-center justify-center w-full"
      >
        {isActive && (
          <div className="absolute inset-inline-start-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r bg-accent" />
        )}

        <button
          data-nav-icon-id={group.id}
          onClick={() => handleGroupClick(group.id)}
          onKeyDown={(e) => handleIconKeyDown(e, group.id)}
          aria-current={isActive ? "page" : undefined}
          aria-label={t(group.label)}
          aria-expanded={openGroupId === group.id ? true : undefined}
          aria-haspopup={group.items.length > 0 ? ("true" as const) : undefined}
          className={`relative flex items-center justify-center w-10 h-10 rounded-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent ${isActive
              ? "text-accent glass-accent-tint"
              : "text-text-tertiary hover:text-text-primary hover:glass-accent-tint"
            }`}
        >
          <Icon size={20} aria-hidden="true" />

          {group.badge !== undefined && group.badge > 0 && (
            <span className="absolute -top-0.5 -inset-inline-end-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-medium text-white bg-danger rounded-full leading-none">
              {group.badge > 99 ? "99+" : group.badge}
            </span>
          )}
        </button>

        <div
          className="absolute inset-s-full ms-3 px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-50 glass-dropdown shadow-lg text-text-primary"
        >
          {t(group.label)}
        </div>
      </div>
    );
  };

  // ── Render: flyout panel (when group has items) ──────────────────────
  const renderPanel = () => {
    if (!openGroupId) return null;

    const group = groups.find((g) => g.id === openGroupId);
    if (!group) return null;

    return (
      <div
        className="shrink-0 w-[260px] h-full glass-panel-sidebar flex flex-col overflow-hidden animate-in slide-in-from-start-1 duration-200"
        role="group"
        aria-label={`${t(group.label)} navigation`}
      >
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-semibold text-text-primary">
            {t(group.label)}
          </h2>
        </div>

        <div
          className="flex-1 overflow-y-auto py-1"
          onKeyDown={handlePanelKeyDown}
          role="listbox"
          aria-label={`${t(group.label)} items`}
        >
          {group.items.length === 0 && (
            <p className="px-4 py-6 text-xs text-text-tertiary text-center">
              {t("nav.noItems")}
            </p>
          )}

          {group.items.map((item, index) => {
            if (item.id === DIVIDER_ID) {
              return (
                <hr
                  key={DIVIDER_ID}
                  className="mx-3 my-2 border-t border-border-primary"
                />
              );
            }

            const ItemIcon = item.icon;
            const isSubItemActive = item.id === activeSubItemId;
            const isFocused = index === focusedSubItemIndex;

            return (
              <button
                key={item.id}
                ref={(el) => setSubItemRef(item.id, el)}
                onClick={() => onSubItemSelect(openGroupId, item.id)}
                role="option"
                aria-selected={isSubItemActive}
                tabIndex={isFocused ? 0 : -1}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${isSubItemActive
                    ? "glass-accent-tint text-accent font-medium"
                    : isFocused
                      ? "bg-bg-tertiary text-text-primary"
                      : "text-text-tertiary hover:glass-accent-tint hover:text-text-primary"
                  }`}
              >
                {ItemIcon && (
                  <span className="flex items-center justify-center w-5 h-5 shrink-0">
                    <ItemIcon size={16} aria-hidden="true" />
                  </span>
                )}

                <span className="truncate flex-1 text-start">{t(item.label)}</span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-medium text-white bg-danger rounded-full leading-none shrink-0">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render: mail content panel ─────────────────────────────────────────
  const renderContentPanel = () => (
    <div className="shrink-0 w-[280px] h-full glass-panel-sidebar flex flex-col overflow-hidden">
      {/* Account Switcher */}
      <div className="px-3 pt-2">
        <AccountSwitcher
          collapsed={false}
          onAddAccount={() => setShowAddAccount(true)}
        />
        {activeAccount?.company && (
          <p className="text-xs text-text-tertiary mt-1 px-1 truncate">
            {activeAccount.company}
          </p>
        )}
      </div>

      {/* Compose button — toggle moved to icon rail for always-visible access */}
      <div className="flex gap-x-2 px-3 py-2">
        <button
          onClick={() => openComposer()}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-lg py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97]"
        >
          <Plus size={16} />
          <span>{t("nav.compose")}</span>
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Mail folders">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isInbox = item.id === "inbox";
          return (
            <div key={item.id}>
              <DroppableNavItem
                id={item.id}
                isActive={
                  isInbox
                    ? activeLabel === "inbox" &&
                    (inboxViewMode === "unified" ||
                      activeCategory === "Primary")
                    : activeLabel === item.id
                }
                collapsed={false}
                onClick={() => {
                  if (isInbox && inboxViewMode === "split") {
                    navigateToLabel(item.id, { category: "Primary" });
                  } else {
                    navigateToLabel(item.id);
                  }
                }}
                onContextMenu={(e) => handleNavContextMenu(e, item.id)}
              >
                {() => (
                  <>
                    {isSyncingFolder === item.id ? (
                      <Loader2
                        size={18}
                        className="shrink-0 animate-spin text-accent"
                      />
                    ) : (
                      <Icon size={18} className="shrink-0" />
                    )}
                    <span className="flex-1 truncate text-start">
                      {t(item.label)}
                    </span>
                    {isInbox && (threadUnreadCounts["INBOX"] ?? 0) > 0 && (
                      <span className="bg-danger text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {threadUnreadCounts["INBOX"]}
                      </span>
                    )}
                    {item.id === "productivity" && taskIncompleteCount > 0 && (
                      <span className="text-[0.625rem] bg-accent/15 text-accent px-1.5 rounded-full leading-normal">
                        {taskIncompleteCount}
                      </span>
                    )}
                    {isInbox && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInboxViewMode(
                            inboxViewMode === "split" ? "unified" : "split",
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setInboxViewMode(
                              inboxViewMode === "split" ? "unified" : "split",
                            );
                          }
                        }}
                        title={
                          inboxViewMode === "split"
                            ? t("email.switchToUnifiedInbox")
                            : t("email.switchToSplitInbox")
                        }
                        className={`p-1 rounded transition-colors shrink-0 ${inboxViewMode === "split"
                            ? "text-accent hover:bg-accent/10"
                            : "text-sidebar-text/40 hover:text-sidebar-text hover:bg-bg-tertiary"
                          }`}
                      >
                        <Columns2 size={14} />
                      </span>
                    )}
                  </>
                )}
              </DroppableNavItem>

              {/* Category sub-items when split mode */}
              {isInbox && inboxViewMode === "split" && (
                <div>
                  {CATEGORY_ITEMS.map((cat) => {
                    const CatIcon = cat.icon;
                    const isCatActive =
                      activeLabel === "inbox" && activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          navigateToLabel("inbox", { category: cat.id });
                        }}
                        className={`flex items-center gap-2 w-full py-1.5 pl-7 pr-3 text-left text-[0.8125rem] transition-all duration-150 ${isCatActive
                            ? "text-accent font-medium glass-accent-tint"
                            : "text-text-tertiary/70 hover:text-text-tertiary hover:glass-accent-tint"
                          }`}
                      >
                        <CatIcon size={14} className="shrink-0" />
                        <span className="flex-1 truncate">
                          {t(cat.label)}
                        </span>
                        {(categoryCounts[cat.id] ?? 0) > 0 && (
                          <span className="me-auto bg-danger text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {categoryCounts[cat.id] ?? 0}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Smart Folders */}
        {showSmartFolders && smartFolders.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 pt-4 pb-1">
              <span className="text-xs font-medium text-text-tertiary/60 uppercase tracking-wider">
                {t("nav.smartFolders")}
              </span>
              <button
                onClick={handleAddSmartFolder}
                className="p-0.5 text-sidebar-text/40 hover:text-sidebar-text transition-colors"
                title={t("nav.addSmartFolder")}
              >
                <Plus size={14} />
              </button>
            </div>
            {smartFolders.map((folder) => {
              const Icon = getSmartFolderIcon(folder.icon);
              const isActive = activeLabel === `smart-folder:${folder.id}`;
              const count = smartFolderCounts[folder.id] ?? 0;
              return (
                <button
                  key={folder.id}
                  onClick={() => navigateToLabel(`smart-folder:${folder.id}`)}
                  className={`flex items-center gap-3 w-full px-3 py-2 text-sm transition-all duration-150 ${isActive
                      ? "glass-accent-tint text-accent font-medium"
                      : "text-text-tertiary hover:glass-accent-tint hover:text-text-primary"
                    }`}
                >
                  <Icon
                    size={18}
                    className="shrink-0"
                    style={folder.color ? { color: folder.color } : undefined}
                  />
                  <span className="flex-1 truncate text-start">
                    {folder.name}
                  </span>
                  {count > 0 && (
                    <span className="me-auto bg-danger text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}

        {/* Smart Folders - empty state */}
        {showSmartFolders && smartFolders.length === 0 && (
          <div className="flex items-center justify-between px-3 pt-4 pb-1">
            <span className="text-xs font-medium text-text-tertiary/60 uppercase tracking-wider">
              {t("nav.smartFolders")}
            </span>
            <button
              onClick={handleAddSmartFolder}
              className="p-0.5 text-sidebar-text/40 hover:text-sidebar-text transition-colors"
              title={t("nav.addSmartFolder")}
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Labels */}
        {showLabels && labels.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 pt-4 pb-1">
              <span className="text-xs font-medium text-text-tertiary/60 uppercase tracking-wider">
                {t("nav.labels")}
              </span>
              <button
                onClick={handleAddLabel}
                className="p-0.5 text-sidebar-text/40 hover:text-sidebar-text transition-colors"
                title={t("nav.addLabel")}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Always-visible labels */}
            {labels.slice(0, LABELS_COLLAPSED_COUNT).map((label) => (
              <div key={label.id}>
                <DroppableLabelItem
                  label={label}
                  isActive={activeLabel === label.id}
                  collapsed={false}
                  unreadCount={threadUnreadCounts[label.id] ?? 0}
                  onClick={() => navigateToLabel(label.id)}
                  onContextMenu={(e) => handleLabelContextMenu(e, label.id)}
                  onEditClick={() => handleEditLabel(label.id)}
                />
                {editingLabelId === label.id && activeAccountId && (
                  <LabelForm
                    accountId={activeAccountId}
                    label={editingLabel}
                    onDone={handleFormDone}
                    variant="sidebar"
                  />
                )}
              </div>
            ))}

            {/* Collapsible labels */}
            {labels.length > LABELS_COLLAPSED_COUNT && (
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${labelsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  {labels.slice(LABELS_COLLAPSED_COUNT).map((label) => (
                    <div key={label.id}>
                      <DroppableLabelItem
                        label={label}
                        isActive={activeLabel === label.id}
                        collapsed={false}
                        unreadCount={threadUnreadCounts[label.id] ?? 0}
                        onClick={() => navigateToLabel(label.id)}
                        onContextMenu={(e) =>
                          handleLabelContextMenu(e, label.id)
                        }
                        onEditClick={() => handleEditLabel(label.id)}
                      />
                      {editingLabelId === label.id && activeAccountId && (
                        <LabelForm
                          accountId={activeAccountId}
                          label={editingLabel}
                          onDone={handleFormDone}
                          variant="sidebar"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expand/collapse toggle */}
            {labels.length > LABELS_COLLAPSED_COUNT && (
              <button
                onClick={() => setLabelsExpanded((v) => !v)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-tertiary/60 hover:text-text-tertiary transition-colors"
              >
                {labelsExpanded ? (
                  <>
                    <ChevronUp size={12} />
                    <span>{t("nav.showLess")}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} />
                    <span>
                      {t("nav.nMore", {
                        n: labels.length - LABELS_COLLAPSED_COUNT,
                      })}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* New label form */}
            {showNewLabelForm && activeAccountId && (
              <LabelForm
                accountId={activeAccountId}
                onDone={handleFormDone}
                variant="sidebar"
              />
            )}
          </>
        )}

        {/* Labels - empty state */}
        {showLabels && labels.length === 0 && (
          <>
            <div className="flex items-center justify-between px-3 pt-4 pb-1">
              <span className="text-xs font-medium text-text-tertiary/60 uppercase tracking-wider">
                {t("nav.labels")}
              </span>
              <button
                onClick={handleAddLabel}
                className="p-0.5 text-sidebar-text/40 hover:text-sidebar-text transition-colors"
                title={t("nav.addLabel")}
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="px-3 py-2 text-xs text-text-tertiary/50 italic">
              {t("nav.addYourFirstLabel")}
            </p>
            {showNewLabelForm && activeAccountId && (
              <LabelForm
                accountId={activeAccountId}
                onDone={handleFormDone}
                variant="sidebar"
              />
            )}
          </>
        )}
      </nav>

      {/* Pending operations indicator */}
      <PendingOpsIndicator collapsed={false} />
    </div>
  );

  // ── Smart folder dialog handler ──────────────────────────────────────
  const handleSmartFolderSubmit = useCallback(
    (values: Record<string, string>) => {
      createSmartFolder(
        values.name!.trim(),
        values.query!.trim(),
        activeAccountId ?? undefined,
      );
      setShowSmartFolderModal(false);
    },
    [createSmartFolder, activeAccountId],
  );

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={navRef}
        className={`flex h-full shrink-0 ${activeGroupId === "mail" && !collapsed ? "w-[344px]" : "w-16"}`}
      >
        {/* Icon rail — always visible on every page */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          className="hidden md:flex flex-col h-full w-16 glass-nav-rail shrink-0 overflow-hidden"
        >
          {/* Main groups — top-aligned */}
          <div className={`flex-1 flex flex-col items-center ${gapClass} py-3`}>
            {mainGroups.map(renderIconItem)}
          </div>

          {/* Toggle sidebar + Compose */}
          <div className="flex flex-col items-center py-2 border-t border-border-primary">
            {/* Toggle — always visible on the icon rail (never self-hiding) */}
            <div className="relative group flex items-center justify-center w-full">
              <button
                onClick={toggleSidebar}
                aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
                title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
                className="relative flex h-10 w-10 items-center justify-center rounded-md text-text-tertiary transition-all duration-150 hover:glass-accent-tint hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                {collapsed ? (
                  <PanelLeftOpen size={20} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={20} aria-hidden="true" />
                )}
              </button>
              <div className="absolute start-full ms-3 whitespace-nowrap rounded-md glass-dropdown px-2.5 py-1.5 text-xs font-medium text-text-primary opacity-0 shadow-lg transition-all duration-150 pointer-events-none invisible group-hover:visible group-hover:opacity-100">
                {collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
              </div>
            </div>
            <div className="relative group flex items-center justify-center w-full">
              <button
                onClick={() => openComposer()}
                aria-label={t("nav.compose")}
                className="relative flex items-center justify-center w-10 h-10 rounded-md text-text-tertiary hover:text-accent hover:glass-accent-tint transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
              <div
                className="absolute start-full ms-3 px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-50 glass-dropdown shadow-lg text-text-primary"
              >
                {t("nav.compose")}
              </div>
            </div>
          </div>

          {/* Bottom groups — settings, help, etc. */}
          {bottomGroups.length > 0 && (
            <div className="flex flex-col items-center py-3 border-t border-border-primary">
              {bottomGroups.map(renderIconItem)}
            </div>
          )}

          {/* Dev Pro badge */}
          {isDevProMode() && (
            <div className="flex items-center justify-center py-1.5 border-t border-border-primary">
              <span className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                DEV PRO
              </span>
            </div>
          )}
        </nav>

        {/* Flyout panel — shown when collapsed on mail pages for groups with sub-items */}
        {activeGroupId !== "settings" && activeGroupId !== "help" && collapsed && renderPanel()}

        {/* Mail content panel — only shown on mail pages when expanded */}
        {activeGroupId === "mail" && !collapsed && renderContentPanel()}
      </div>

      {/* Smart folder creation dialog */}
      {/* Smart folder creation dialog */}
      <InputDialog
        isOpen={showSmartFolderModal}
        onClose={() => setShowSmartFolderModal(false)}
        onSubmit={handleSmartFolderSubmit}
        title={t("nav.newSmartFolder")}
        fields={[
          {
            key: "name",
            label: t("common.name"),
            placeholder: t("nav.nameExample"),
          },
          {
            key: "query",
            label: t("nav.searchQuery"),
            placeholder: t("nav.searchQueryExample"),
          },
        ]}
      />

      {/* Add Account modal */}
      {showAddAccount && (
        <AddAccount
          onClose={() => setShowAddAccount(false)}
          onSuccess={() => setShowAddAccount(false)}
        />
      )}
    </>
  );
}

