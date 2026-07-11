import type { DbContact } from "@features/contacts/db/contacts";
import type { Density } from "@features/contacts/hooks/useViewPrefs";
import { ContactAvatar } from "@features/contacts/components/ContactAvatar";
import { ContactActions } from "@features/contacts/components/ContactActions";
import { formatRelativeDate } from "@shared/utils/date";

interface ContactGridCardProps {
  contact: DbContact;
  density: Density;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onCompose: (contact: DbContact) => void;
  onViewContact?: (contact: DbContact) => void;
  onAddTag: (contact: DbContact) => void;
  onAddToGroup: (contact: DbContact) => void;
  onAddToSegment: (contact: DbContact) => void;
  onMerge: (contact: DbContact) => void;
  onDelete: (contact: DbContact) => void;
  onExportVcard: (contact: DbContact) => void;
}

const DENSITY_AVA: Record<Density, 32 | 40 | 48> = {
  compact: 32,
  normal: 40,
  comfortable: 48,
};

const DENSITY_PADDING: Record<Density, string> = {
  compact: "p-2",
  normal: "p-3",
  comfortable: "p-4",
};

const DENSITY_NAME: Record<Density, string> = {
  compact: "text-xs",
  normal: "text-sm",
  comfortable: "text-base",
};

/**
 * ContactGridCard — single card in the grid view.
 * Selectable via checkbox, primary action is always visible.
 */
export function ContactGridCard({
  contact,
  density,
  selected,
  onToggleSelect,
  onClick,
  onCompose,
  onViewContact,
  onAddTag,
  onAddToGroup,
  onAddToSegment,
  onMerge,
  onDelete,
  onExportVcard,
}: ContactGridCardProps) {
  const avatarSize = DENSITY_AVA[density];

  return (
    <div
      className={`group relative flex flex-col ${DENSITY_PADDING[density]} rounded-lg border transition-all cursor-pointer ${
        selected
          ? "border-accent bg-accent/5 shadow-sm"
          : "border-border-primary bg-bg-primary/40 hover:border-accent/40 hover:bg-bg-hover"
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Checkbox (top-left) */}
      <div className="flex items-start justify-between mb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-border-primary text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
          aria-label={`Select ${contact.display_name ?? contact.email}`}
        />
        {contact.frequency > 0 && (
          <span className="text-[0.625rem] text-text-tertiary tabular-nums">
            {contact.frequency}×
          </span>
        )}
      </div>

      {/* Avatar centered */}
      <div className="flex items-center justify-center mb-2">
        <ContactAvatar
          name={contact.display_name}
          email={contact.email}
          imageUrl={contact.avatar_url}
          size={avatarSize}
        />
      </div>

      {/* Name + email */}
      <div className="text-center min-w-0 mb-3">
        <h3
          className={`${DENSITY_NAME[density]} font-semibold text-text-primary truncate`}
          title={contact.display_name ?? contact.email}
        >
          {contact.display_name ?? contact.email}
        </h3>
        <p className="text-[0.625rem] text-text-tertiary truncate" title={contact.email}>
          {contact.email}
        </p>
      </div>

      {/* Footer: last contact + actions */}
      <div className="mt-auto pt-2 border-t border-border-primary/50 flex items-center justify-between gap-1">
        <span className="text-[0.625rem] text-text-tertiary shrink-0">
          {contact.last_contacted_at
            ? `Last: ${formatRelativeDate(contact.last_contacted_at)}`
            : "Never contacted"}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <ContactActions
            contact={contact}
            variant="card"
            onCompose={onCompose}
            onViewContact={onViewContact}
            onAddTag={onAddTag}
            onAddToGroup={onAddToGroup}
            onAddToSegment={onAddToSegment}
            onMerge={onMerge}
            onDelete={onDelete}
            onExportVcard={onExportVcard}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}
