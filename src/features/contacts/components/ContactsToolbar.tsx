import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  Check,
  X,
  Tag as TagIcon,
  Users,
  Download,
  Trash2,
  GitMerge,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SortField, SortDirection } from "@features/contacts/hooks/useViewPrefs";
import { Button } from "@shared/components/ui/Button";

export type BulkAction =
  | "tag"
  | "group"
  | "export"
  | "delete"
  | "merge"
  | "clear";

interface ContactsToolbarProps {
  totalCount: number;
  selectedCount: number;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onImportClick: () => void;
  onMergeClick: () => void;
  onBulkAction: (action: BulkAction) => void;
  onExportAllCsv?: () => void;
  onExportAllVcard?: () => void;
  onExportAllTasks?: () => void;
  onExportAllCalendar?: () => void;
  onSelectAllToggle: () => void;
  allSelected: boolean;
  someSelected: boolean;
  children?: React.ReactNode;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "last_contact", label: "Last contact" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "frequency", label: "Frequency" },
];

interface DropdownItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  action: () => void;
  selected?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

function Dropdown({ trigger, items, align = "left" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-30 top-full mt-1 min-w-[180px] rounded-lg border border-border-primary bg-bg-primary shadow-lg py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.action();
                  close();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
              >
                {Icon ? <Icon size={12} /> : <span className="w-3" />}
                <span className="flex-1 text-left">{item.label}</span>
                {item.selected && <Check size={12} className="text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ContactsToolbar — appears at the top of the Contacts tab content.
 * Shows: Select All, Sort dropdown, ViewToggle slot, Import, Merge.
 * When items are selected, a bulk action bar appears below.
 */
export function ContactsToolbar({
  totalCount,
  selectedCount,
  sortField,
  sortDirection,
  onSortChange,
  onImportClick,
  onMergeClick,
  onBulkAction,
  onExportAllCsv,
  onExportAllVcard,
  onExportAllTasks,
  onExportAllCalendar,
  onSelectAllToggle,
  allSelected,
  someSelected,
  children,
}: ContactsToolbarProps) {
  const sortItems: DropdownItem[] = SORT_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    icon:
      sortField === opt.value
        ? sortDirection === "asc"
          ? ArrowUpDown
          : ArrowUpDown
        : undefined,
    action: () => {
      if (sortField === opt.value) {
        onSortChange(opt.value, sortDirection === "asc" ? "desc" : "asc");
      } else {
        onSortChange(opt.value, "desc");
      }
    },
    selected: sortField === opt.value,
  }));

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortField)?.label ?? "Sort";

  const showBulkBar = selectedCount > 0;

  return (
    <div className="border-b border-border-primary bg-bg-primary/20">
      {/* Primary toolbar row */}
      <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
        {/* Select all checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none min-h-[28px]">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={onSelectAllToggle}
            className="w-3.5 h-3.5 rounded border-border-primary text-accent focus:ring-accent focus:ring-offset-0"
            aria-label="Select all contacts"
          />
          <span className="text-[0.625rem] text-text-tertiary">
            {allSelected ? "All" : "Select"}
          </span>
        </label>

        <div className="w-px h-4 bg-border-primary" aria-hidden="true" />

        {/* Sort dropdown */}
        <Dropdown
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors min-h-[28px]"
              aria-label="Sort contacts"
            >
              <ArrowUpDown size={10} />
              <span>
                {currentSortLabel} {sortDirection === "asc" ? "↑" : "↓"}
              </span>
              <ChevronDown size={10} />
            </button>
          }
          items={sortItems}
        />

        {/* Slot for view toggle etc. */}
        {children}

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          icon={<GitMerge size={14} />}
          onClick={onMergeClick}
        >
          Merge
        </Button>
        {(onExportAllCsv || onExportAllVcard || onExportAllTasks || onExportAllCalendar) && (
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border-primary text-text-primary hover:bg-bg-hover rounded-lg transition-colors min-h-[28px]"
                aria-label="Export all data"
              >
                <Download size={14} />
                Export All
                <ChevronDown size={12} />
              </button>
            }
            items={(
              [
                onExportAllCsv && {
                  id: "all-csv",
                  label: "All Contacts (CSV)",
                  icon: Download,
                  action: onExportAllCsv,
                },
                onExportAllVcard && {
                  id: "all-vcard",
                  label: "All Contacts (vCard)",
                  icon: Download,
                  action: onExportAllVcard,
                },
                onExportAllTasks && {
                  id: "all-tasks",
                  label: "All Tasks (CSV)",
                  icon: Download,
                  action: onExportAllTasks,
                },
                onExportAllCalendar && {
                  id: "all-cal",
                  label: "All Calendar (ICS)",
                  icon: Download,
                  action: onExportAllCalendar,
                },
              ] as Array<DropdownItem | undefined>
            ).filter((x): x is DropdownItem => x !== undefined)}
          />
        )}
        <Button
          variant="primary"
          size="sm"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          }
          onClick={onImportClick}
        >
          Import
        </Button>
      </div>

      {/* Bulk action bar */}
      {showBulkBar && (
        <div
          className="flex items-center gap-2 px-5 py-2 bg-accent/5 border-t border-border-primary flex-wrap"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="text-xs font-medium text-text-primary">
            {selectedCount} selected
          </span>
          <div className="w-px h-4 bg-border-primary" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onBulkAction("tag")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-secondary hover:text-accent hover:bg-bg-hover rounded transition-colors min-h-[28px]"
          >
            <TagIcon size={10} />
            Tag
          </button>
          <button
            type="button"
            onClick={() => onBulkAction("group")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-secondary hover:text-accent hover:bg-bg-hover rounded transition-colors min-h-[28px]"
          >
            <Users size={10} />
            Group
          </button>
          <button
            type="button"
            onClick={() => onBulkAction("export")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-secondary hover:text-accent hover:bg-bg-hover rounded transition-colors min-h-[28px]"
          >
            <Download size={10} />
            Export
          </button>
          <button
            type="button"
            onClick={() => onBulkAction("merge")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-secondary hover:text-accent hover:bg-bg-hover rounded transition-colors min-h-[28px]"
          >
            <GitMerge size={10} />
            Merge
          </button>
          <button
            type="button"
            onClick={() => onBulkAction("delete")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-secondary hover:text-error hover:bg-error/10 rounded transition-colors min-h-[28px]"
          >
            <Trash2 size={10} />
            Delete
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onBulkAction("clear")}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.625rem] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors min-h-[28px]"
            aria-label="Clear selection"
          >
            <X size={10} />
            Clear
          </button>
        </div>
      )}

      {/* Hidden total for screen readers */}
      <span className="sr-only">{totalCount} contacts</span>
    </div>
  );
}
