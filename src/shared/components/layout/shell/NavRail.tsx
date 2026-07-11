import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDensity } from "@shared/hooks/useDensity";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavRailItem {
  id: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

export interface NavRailSubItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  path?: string;
}

export interface NavRailGroup {
  id: string;
  icon: LucideIcon;
  label: string;
  items: NavRailSubItem[];
  badge?: number;
}

export interface NavRailProps {
  groups: NavRailGroup[];
  activeGroupId: string;
  activeSubItemId: string | null;
  onGroupSelect: (groupId: string) => void;
  onSubItemSelect: (groupId: string, subItemId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIVIDER_ID = "__divider__";

const DENSITY_GAP_MAP: Record<string, string> = {
  "gap-6 p-6": "gap-3",
  "gap-4 p-4": "gap-2",
  "gap-2 p-2": "gap-1",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NavRail({
  groups,
  activeGroupId,
  activeSubItemId,
  onGroupSelect,
  onSubItemSelect,
}: NavRailProps) {
  const { t } = useTranslation();
  const { spacingClass } = useDensity();
  const gapClass = DENSITY_GAP_MAP[spacingClass] ?? "gap-2";

  // ── Panel open/close state ──────────────────────────────────────────────
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [focusedSubItemIndex, setFocusedSubItemIndex] = useState(-1);
  const navRef = useRef<HTMLDivElement>(null);
  const subItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Open panel for the active group on mount / route change (if it has items)
  useEffect(() => {
    const group = groups.find((g) => g.id === activeGroupId);
    if (group && group.items.length > 0) {
      setOpenGroupId(activeGroupId);
    } else {
      setOpenGroupId(null);
    }
    // Reset sub-item focus when active group changes
    setFocusedSubItemIndex(-1);
  }, [activeGroupId, groups]);

  // Click outside to close the panel
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

  // Separate bottom groups (settings, help) from main groups
  const bottomIds = new Set(["settings", "help"]);
  const bottomGroups = groups.filter((g) => bottomIds.has(g.id));
  const mainGroups = groups.filter((g) => !bottomIds.has(g.id));

  // Ordered group IDs for keyboard navigation on the icon rail
  const orderedGroupIds = useMemo(
    () => [
      ...mainGroups.map((g) => g.id),
      ...bottomGroups.map((g) => g.id),
    ],
    [mainGroups, bottomGroups],
  );

  // ── Icon rail keyboard navigation ───────────────────────────────────────
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
            (currentIndex - 1 + orderedGroupIds.length) % orderedGroupIds.length;
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

  // ── Group icon click ────────────────────────────────────────────────────
  const handleGroupClick = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      const hasItems = group && group.items.length > 0;

      if (hasItems) {
        setOpenGroupId((prev) => (prev === groupId ? null : groupId));
      } else {
        setOpenGroupId(null);
      }

      onGroupSelect(groupId);
    },
    [groups, onGroupSelect],
  );

  // ── Panel keyboard navigation ───────────────────────────────────────────
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
          // Focus back on the active group icon
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

  // Focus the correct sub-item button when focus index changes
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

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderIconItem = (group: NavRailGroup) => {
    const Icon = group.icon;
    const isActive = group.id === activeGroupId;

    return (
      <div
        key={group.id}
        className="relative group flex items-center justify-center w-full"
      >
        {/* Active accent bar */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-r bg-accent" />
        )}

        <button
          data-nav-icon-id={group.id}
          onClick={() => handleGroupClick(group.id)}
          onKeyDown={(e) => handleIconKeyDown(e, group.id)}
          aria-current={isActive ? "page" : undefined}
          aria-label={t(group.label)}
          aria-expanded={openGroupId === group.id ? true : undefined}
          aria-haspopup={
            group.items.length > 0 ? ("true" as const) : undefined
          }
          className={`relative flex items-center justify-center w-10 h-10 rounded-md transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
            isActive
              ? "text-accent glass-accent-tint"
              : "text-text-secondary hover:text-text-primary hover:glass-accent-tint"
          }`}
        >
          {/* size=20 matches --icon-md (20px) */}
          <Icon size={20} aria-hidden="true" />

          {/* Badge */}
          {group.badge !== undefined && group.badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-medium text-white bg-danger rounded-full leading-none">
              {group.badge > 99 ? "99+" : group.badge}
            </span>
          )}
        </button>

        {/* Tooltip — positioned right, visible on hover */}
        <div
          className="absolute left-full ml-3 px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-50 glass-dropdown shadow-lg text-text-primary"
        >
          {t(group.label)}
        </div>
      </div>
    );
  };

  const renderPanel = () => {
    if (!openGroupId) return null;

    const group = groups.find((g) => g.id === openGroupId);
    if (!group) return null;

    return (
      <div
        className="flex-shrink-0 w-[260px] h-full glass-panel-sidebar flex flex-col overflow-hidden animate-in slide-in-from-left-1 duration-200"
        role="group"
        aria-label={`${t(group.label)} navigation`}
      >
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-semibold text-text-primary">
            {t(group.label)}
          </h2>
        </div>

        {/* Sub-items list */}
        <div
          className="flex-1 overflow-y-auto py-1"
          onKeyDown={handlePanelKeyDown}
          role="listbox"
          aria-label={`${t(group.label)} items`}
        >
          {group.items.length === 0 && (
            <p className="px-4 py-6 text-xs text-text-secondary text-center">
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
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px] ${
                  isSubItemActive
                    ? "glass-accent-tint text-accent font-medium"
                    : isFocused
                      ? "bg-bg-tertiary text-text-primary"
                      : "text-text-secondary hover:glass-accent-tint hover:text-text-primary"
                }`}
              >
                {ItemIcon && (
                  <span className="flex items-center justify-center w-5 h-5 shrink-0">
                    <ItemIcon size={16} aria-hidden="true" />
                  </span>
                )}

                <span className="truncate flex-1 text-left">{t(item.label)}</span>

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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div ref={navRef} className="flex h-full shrink-0">
      {/* Icon rail */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="hidden md:flex flex-col h-full w-16 hover:w-[72px] glass-nav-rail liquid-glass transition-all duration-150 shrink-0 overflow-hidden"
      >
        {/* Main groups — top-aligned */}
        <div className={`flex-1 flex flex-col items-center ${gapClass} py-3`}>
          {mainGroups.map(renderIconItem)}
        </div>

        {/* Bottom groups — settings, help, etc. */}
        {bottomGroups.length > 0 && (
          <div className="flex flex-col items-center py-3 border-t border-border-primary">
            {bottomGroups.map(renderIconItem)}
          </div>
        )}
      </nav>

      {/* Group panel */}
      {renderPanel()}
    </div>
  );
}

