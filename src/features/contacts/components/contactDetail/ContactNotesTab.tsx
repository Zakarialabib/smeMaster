import { StickyNote, Clock } from "lucide-react";
import { EmptyState } from "@shared/components/ui/EmptyState";

export interface ContactNotesTabProps {
  notes: string;
  notesDirty: boolean;
  onNotesChange: (value: string) => void;
  onNotesBlur: () => void;
}

export function ContactNotesTab({
  notes,
  notesDirty,
  onNotesChange,
  onNotesBlur,
}: ContactNotesTabProps) {
  return (
    <div className="p-5">
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        onBlur={onNotesBlur}
        placeholder="Add notes about this contact..."
        rows={12}
        className="w-full text-sm bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent resize-y"
        aria-label="Contact notes"
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-[0.6rem] text-text-tertiary">
          Notes are auto-saved
        </p>
        {notesDirty && (
          <span className="text-[0.6rem] text-accent flex items-center gap-1">
            <Clock size={9} />
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}

/** Empty state variant shown when contact has no notes */
export function ContactNotesEmpty() {
  return (
    <EmptyState
      icon={StickyNote}
      title="No notes"
      subtitle="Start writing notes about this contact above"
    />
  );
}
