import { useMemo, useCallback, useRef } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DbContact } from "@features/contacts/db/contacts";
import type { Density, SortField, SortDirection } from "@features/contacts/hooks/useViewPrefs";
import { ContactAvatar } from "@features/contacts/components/ContactAvatar";
import { ContactActions } from "@features/contacts/components/ContactActions";
import { formatRelativeDate } from "@shared/utils/date";

interface ContactListViewProps {
  contacts: DbContact[];
  density: Density;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onContactClick: (id: string) => void;
  onCompose: (contact: DbContact) => void;
  onViewContact?: (contact: DbContact) => void;
  onAddTag: (contact: DbContact) => void;
  onAddToGroup: (contact: DbContact) => void;
  onAddToSegment: (contact: DbContact) => void;
  onMerge: (contact: DbContact) => void;
  onDelete: (contact: DbContact) => void;
  onExportVcard: (contact: DbContact) => void;
}

interface DensityConfig {
  avatar: 24 | 28 | 32;
  rowClass: string;
  cellTextClass: string;
  nameClass: string;
  checkboxClass: string;
  showSecondary: boolean;
  /// Estimated row height in pixels (used by the virtualizer).
  rowHeight: number;
}

const DENSITY_CONFIGS: Record<Density, DensityConfig> = {
  compact: {
    avatar: 24,
    rowClass: "py-1 px-2",
    cellTextClass: "text-[0.6875rem]",
    nameClass: "text-xs",
    checkboxClass: "w-3 h-3",
    showSecondary: false,
    rowHeight: 36,
  },
  normal: {
    avatar: 28,
    rowClass: "py-2 px-3",
    cellTextClass: "text-xs",
    nameClass: "text-sm",
    checkboxClass: "w-3.5 h-3.5",
    showSecondary: true,
    rowHeight: 48,
  },
  comfortable: {
    avatar: 32,
    rowClass: "py-2.5 px-4",
    cellTextClass: "text-sm",
    nameClass: "text-sm",
    checkboxClass: "w-4 h-4",
    showSecondary: true,
    rowHeight: 56,
  },
};

interface ColumnDef {
  id: SortField | "select" | "contact" | "actions";
  label: string;
  sortable: boolean;
  width: string;
  align?: "left" | "right" | "center";
}

const COLUMNS: ColumnDef[] = [
  { id: "select", label: "", sortable: false, width: "32px" },
  { id: "contact", label: "Contact", sortable: false, width: "" },
  { id: "email", label: "Email", sortable: true, width: "200px" },
  { id: "frequency", label: "Freq.", sortable: true, width: "70px", align: "right" },
  { id: "last_contact", label: "Last Contact", sortable: true, width: "110px", align: "right" },
  { id: "actions", label: "", sortable: false, width: "auto" },
];

function sortContacts(
  contacts: DbContact[],
  field: SortField,
  direction: SortDirection,
): DbContact[] {
  const dir = direction === "asc" ? 1 : -1;
  const sorted = [...contacts];
  sorted.sort((a, b) => {
    switch (field) {
      case "name": {
        const an = (a.display_name ?? a.email).toLowerCase();
        const bn = (b.display_name ?? b.email).toLowerCase();
        return an.localeCompare(bn) * dir;
      }
      case "email":
        return a.email.localeCompare(b.email) * dir;
      case "frequency":
        return (a.frequency - b.frequency) * dir;
      case "last_contact": {
        const av = a.last_contacted_at ?? 0;
        const bv = b.last_contacted_at ?? 0;
        return (av - bv) * dir;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

/**
 * ContactListView — density-aware table with:
 * - Per-row checkbox with shift+click range select
 * - Sortable column headers
 * - Always-visible primary actions (no hover-only)
 * - Health dot on name column
 * - Avatar sized to density
 */
export function ContactListView({
  contacts,
  density,
  sortField,
  sortDirection,
  onSortChange,
  selectedIds,
  onToggleSelect,
  onContactClick,
  onCompose,
  onViewContact,
  onAddTag,
  onAddToGroup,
  onAddToSegment,
  onMerge,
  onDelete,
  onExportVcard,
}: ContactListViewProps) {
  const cfg = DENSITY_CONFIGS[density];


  const sortedContacts = useMemo(
    () => sortContacts(contacts, sortField, sortDirection),
    [contacts, sortField, sortDirection],
  );

  const handleHeaderSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        onSortChange(field, sortDirection === "asc" ? "desc" : "asc");
      } else {
        onSortChange(field, "asc");
      }
    },
    [sortField, sortDirection, onSortChange],
  );

  // Virtualize the row list — only visible rows are rendered to the DOM.
  // The grid uses CSS grid (display: grid) to align columns; the virtualizer
  // handles row-level scroll/positioning inside the scroll container.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: sortedContacts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => cfg.rowHeight,
    overscan: 8,
    getItemKey: (idx) => sortedContacts[idx]?.id ?? idx,
  });

  // Column width tokens shared by header and body cells
  const gridStyle = {
    gridTemplateColumns:
      "32px minmax(180px, 1fr) 200px 70px 110px auto",
  } as const;

  const renderRow = (contact: DbContact, isSelected: boolean) => (
    <div
      role="row"
      aria-selected={isSelected}
      onClick={() => onContactClick(contact.id)}
      className={`group transition-colors ${
        isSelected ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-bg-hover"
      } cursor-pointer grid items-center`}
      style={gridStyle}
    >
      {/* Checkbox — always visible */}
      <div
        role="cell"
        className={cfg.rowClass}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) =>
            onToggleSelect(contact.id, (e.nativeEvent as MouseEvent).shiftKey)
          }
          className={`${cfg.checkboxClass} rounded border-border-primary text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer`}
          aria-label={`Select ${contact.display_name ?? contact.email}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Contact: avatar + name */}
      <div role="cell" className={cfg.rowClass}>
        <div className="flex items-center gap-2 min-w-0">
          <ContactAvatar
            name={contact.display_name}
            email={contact.email}
            imageUrl={contact.avatar_url}
            size={cfg.avatar}
          />
          <span
            className={`${cfg.nameClass} font-medium text-text-primary truncate`}
          >
            {contact.display_name ?? contact.email}
          </span>
        </div>
      </div>

      {/* Email */}
      <div
        role="cell"
        className={`${cfg.rowClass} ${cfg.cellTextClass} text-text-tertiary truncate max-w-[200px]`}
      >
        {contact.email}
      </div>

      {/* Frequency */}
      <div
        role="cell"
        className={`${cfg.rowClass} ${cfg.cellTextClass} text-text-tertiary text-right tabular-nums`}
      >
        {contact.frequency > 0 ? contact.frequency : "—"}
      </div>

      {/* Last contact */}
      <div
        role="cell"
        className={`${cfg.rowClass} ${cfg.cellTextClass} text-text-tertiary text-right`}
      >
        {contact.last_contacted_at ? (
          <span>{formatRelativeDate(contact.last_contacted_at)}</span>
        ) : (
          <span className="text-text-tertiary/50">Never</span>
        )}
      </div>

      {/* Actions — always visible */}
      <div
        role="cell"
        className={cfg.rowClass}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end">
          <ContactActions
            contact={contact}
            variant="inline"
            onCompose={onCompose}
            onViewContact={onViewContact}
            onAddTag={onAddTag}
            onAddToGroup={onAddToGroup}
            onAddToSegment={onAddToSegment}
            onMerge={onMerge}
            onDelete={onDelete}
            onExportVcard={onExportVcard}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div role="region" aria-label="Contacts list" className="flex flex-col h-full min-h-0">
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      {/* Sticky header */}
      <div
        role="row"
        className="grid border-b border-border-primary text-left sticky top-0 z-10 bg-bg-primary"
        style={gridStyle}
      >
        {COLUMNS.map((col) => {
          const sortable = col.sortable;
          const isSorted = sortable && col.id === sortField;
          const align =
            col.align === "right"
              ? "text-right"
              : col.align === "center"
                ? "text-center"
                : "text-left";
          return (
            <div
              key={col.id}
              role="columnheader"
              className={`${align} pb-2 font-medium text-text-tertiary text-[0.625rem] uppercase tracking-wider px-2`}
              style={col.width ? { width: col.width } : undefined}
            >
              {sortable ? (
                <button
                  type="button"
                  onClick={() => handleHeaderSort(col.id as SortField)}
                  className={`inline-flex items-center gap-1 hover:text-text-primary transition-colors ${
                    isSorted ? "text-accent" : ""
                  }`}
                >
                  <span>{col.label}</span>
                  {isSorted &&
                    (sortDirection === "asc" ? (
                      <ArrowUp size={10} />
                    ) : (
                      <ArrowDown size={10} />
                    ))}
                </button>
              ) : (
                col.label
              )}
            </div>
          );
        })}
      </div>

      {/* Virtualized scroll body */}
      <div
        ref={scrollRef}
        role="rowgroup"
        className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-border-primary"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const contact = sortedContacts[virtualRow.index];
            if (!contact) return null;
            const isSelected = selectedIds.has(contact.id);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                className="animate-[fadeSlideIn_200ms_ease-out]"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  animationDelay: `${virtualRow.index * 20}ms`,
                }}
              >
                {renderRow(contact, isSelected)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helper export so parents can pass `lastSelectedId` for shift-select
export { sortContacts };
