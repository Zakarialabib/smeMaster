import { useMemo } from "react";
import type { DbContact } from "@features/contacts/db/contacts";
import type { Density } from "@features/contacts/hooks/useViewPrefs";
import { ContactGridCard } from "@features/contacts/components/ContactGridCard";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Users } from "lucide-react";

interface ContactGridViewProps {
  contacts: DbContact[];
  density: Density;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
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

const GRID_MIN_WIDTH: Record<Density, string> = {
  compact: "160px",
  normal: "200px",
  comfortable: "240px",
};

/**
 * ContactGridView — responsive grid of ContactGridCard.
 * CSS grid auto-fills based on density-controlled min card width.
 */
export function ContactGridView({
  contacts,
  density,
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
}: ContactGridViewProps) {
  const minWidth = GRID_MIN_WIDTH[density];

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}, 1fr))`,
    }),
    [minWidth],
  );

  if (contacts.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          icon={Users}
          title="No contacts to display"
          subtitle="Adjust your search or filters to see contacts."
          size="sm"
        />
      </div>
    );
  }

  return (
    <div
      className="grid gap-3 p-3"
      style={gridStyle}
      role="grid"
      aria-label="Contacts grid"
    >
      {contacts.map((contact) => (
        <ContactGridCard
          key={contact.id}
          contact={contact}
          density={density}
          selected={selectedIds.has(contact.id)}
          onToggleSelect={() => onToggleSelect(contact.id)}
          onClick={() => onContactClick(contact.id)}
          onCompose={onCompose}
          onViewContact={onViewContact}
          onAddTag={onAddTag}
          onAddToGroup={onAddToGroup}
          onAddToSegment={onAddToSegment}
          onMerge={onMerge}
          onDelete={onDelete}
          onExportVcard={onExportVcard}
        />
      ))}
    </div>
  );
}
