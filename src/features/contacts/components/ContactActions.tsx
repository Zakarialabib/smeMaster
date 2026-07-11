import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Mail, Tag as TagIcon, Users, Filter, GitMerge, Trash2, MoreVertical, Download, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DbContact } from "@features/contacts/db/contacts";

export type ContactActionVariant = "inline" | "card" | "bulk";

export interface ContactActionsProps {
  contact?: DbContact;
  variant: ContactActionVariant;
  onCompose: (contact: DbContact) => void;
  onViewContact?: (contact: DbContact) => void;
  onAddTag?: (contact: DbContact) => void;
  onAddToGroup?: (contact: DbContact) => void;
  onAddToSegment?: (contact: DbContact) => void;
  onMerge?: (contact: DbContact) => void;
  onDelete?: (contact: DbContact) => void;
  onExportVcard?: (contact: DbContact) => void;
  /** Selected count for bulk variant */
  selectedCount?: number;
  /** Size override (defaults derived from variant) */
  size?: "sm" | "md";
  /** Stop click propagation to parent row */
  stopPropagation?: boolean;
}

interface DropdownItem {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const ICON_BUTTON =
  "inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-accent hover:bg-bg-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent min-w-[44px] min-h-[44px]";

/**
 * ContactActions — replaces hover-only action pattern.
 *
 * - inline: always-visible compose (primary) + ⋮ dropdown (secondary)
 * - card:   always-visible compose/tag/group (primary) + ⋮ dropdown
 * - bulk:   toolbar actions when items are selected
 *
 * All buttons meet 44px minimum tap target for touch devices.
 */
export function ContactActions({
  contact,
  variant,
  onCompose,
  onViewContact,
  onAddTag,
  onAddToGroup,
  onAddToSegment,
  onMerge,
  onDelete,
  onExportVcard,
  selectedCount,
  size = "sm",
  stopPropagation = true,
}: ContactActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, closeMenu]);

  const openMenu = useCallback((e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen((v) => !v);
  }, [stopPropagation]);

  const wrap = (handler: (() => void) | undefined) => () => {
    handler?.();
    closeMenu();
  };

  const iconSize = size === "sm" ? 14 : 16;
  const btnSize = size === "sm" ? "p-1.5" : "p-2";

  if (variant === "bulk") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap" data-testid="bulk-actions">
        {onAddTag && (
          <button
            type="button"
            onClick={() => onAddTag(contact!)}
            className={`${ICON_BUTTON} ${btnSize}`}
            title="Tag selected"
            aria-label="Tag selected contacts"
          >
            <TagIcon size={iconSize} />
            {selectedCount !== undefined && (
              <span className="ml-1 text-[0.625rem] font-medium">{selectedCount}</span>
            )}
          </button>
        )}
        {onAddToGroup && (
          <button
            type="button"
            onClick={() => onAddToGroup(contact!)}
            className={`${ICON_BUTTON} ${btnSize}`}
            title="Group selected"
            aria-label="Add selected to group"
          >
            <Users size={iconSize} />
          </button>
        )}
        {onExportVcard && (
          <button
            type="button"
            onClick={() => onExportVcard(contact!)}
            className={`${ICON_BUTTON} ${btnSize}`}
            title="Export CSV"
            aria-label="Export selected as CSV"
          >
            <Download size={iconSize} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(contact!)}
            className={`${ICON_BUTTON} ${btnSize} hover:text-error hover:bg-error/10`}
            title="Delete selected"
            aria-label="Delete selected contacts"
          >
            <Trash2 size={iconSize} />
          </button>
        )}
      </div>
    );
  }

  // Build dropdown items based on variant
  const dropdownItems: DropdownItem[] = [];
  if (variant === "inline") {
    if (onViewContact)
      dropdownItems.push({
        id: "view",
        label: "View contact",
        icon: Eye,
        onClick: wrap(() => contact && onViewContact(contact)),
      });
    if (onAddTag)
      dropdownItems.push({
        id: "tag",
        label: "Add tag",
        icon: TagIcon,
        onClick: wrap(() => contact && onAddTag(contact)),
      });
    if (onAddToGroup)
      dropdownItems.push({
        id: "group",
        label: "Add to group",
        icon: Users,
        onClick: wrap(() => contact && onAddToGroup(contact)),
      });
    if (onAddToSegment)
      dropdownItems.push({
        id: "segment",
        label: "Add to segment",
        icon: Filter,
        onClick: wrap(() => contact && onAddToSegment(contact)),
      });
    if (onMerge)
      dropdownItems.push({
        id: "merge",
        label: "Merge…",
        icon: GitMerge,
        onClick: wrap(() => contact && onMerge(contact)),
      });
    if (onExportVcard)
      dropdownItems.push({
        id: "vcard",
        label: "Export vCard",
        icon: Download,
        onClick: wrap(() => contact && onExportVcard(contact)),
      });
    if (onDelete)
      dropdownItems.push({
        id: "delete",
        label: "Delete",
        icon: Trash2,
        danger: true,
        onClick: wrap(() => contact && onDelete(contact)),
      });
  } else if (variant === "card") {
    if (onViewContact)
      dropdownItems.push({
        id: "view",
        label: "View contact",
        icon: Eye,
        onClick: wrap(() => contact && onViewContact(contact)),
      });
    if (onAddToSegment)
      dropdownItems.push({
        id: "segment",
        label: "Add to segment",
        icon: Filter,
        onClick: wrap(() => contact && onAddToSegment(contact)),
      });
    if (onMerge)
      dropdownItems.push({
        id: "merge",
        label: "Merge…",
        icon: GitMerge,
        onClick: wrap(() => contact && onMerge(contact)),
      });
    if (onExportVcard)
      dropdownItems.push({
        id: "vcard",
        label: "Export vCard",
        icon: Download,
        onClick: wrap(() => contact && onExportVcard(contact)),
      });
    if (onDelete)
      dropdownItems.push({
        id: "delete",
        label: "Delete",
        icon: Trash2,
        danger: true,
        onClick: wrap(() => contact && onDelete(contact)),
      });
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onClick={(e) => stopPropagation && e.stopPropagation()}
    >
      {/* Primary: Compose (always visible) */}
      <button
        type="button"
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation();
          if (contact) onCompose(contact);
        }}
        className={`${ICON_BUTTON} ${btnSize}`}
        title="Compose email"
        aria-label="Compose email"
      >
        <Mail size={iconSize} />
      </button>

      {/* Card variant: also show tag + group inline */}
      {variant === "card" && onAddTag && (
        <button
          type="button"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            if (contact) onAddTag(contact);
          }}
          className={`${ICON_BUTTON} ${btnSize}`}
          title="Add tag"
          aria-label="Add tag"
        >
          <TagIcon size={iconSize} />
        </button>
      )}
      {variant === "card" && onAddToGroup && (
        <button
          type="button"
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation();
            if (contact) onAddToGroup(contact);
          }}
          className={`${ICON_BUTTON} ${btnSize}`}
          title="Add to group"
          aria-label="Add to group"
        >
          <Users size={iconSize} />
        </button>
      )}

      {/* Dropdown trigger */}
      {dropdownItems.length > 0 && (
        <div className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={openMenu}
            className={`${ICON_BUTTON} ${btnSize}`}
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreVertical size={iconSize} />
          </button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
              className="min-w-[180px] rounded-lg border border-border-primary bg-bg-primary shadow-lg py-1"
            >
              {dropdownItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      item.danger
                        ? "text-error hover:bg-error/10"
                        : "text-text-primary hover:bg-bg-hover"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
