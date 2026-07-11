import { X } from "lucide-react";

export interface ActiveFilter {
  id: string;
  label: string;
  color?: string;
  onRemove: () => void;
}

interface FilterChipBarProps {
  filters: ActiveFilter[];
  onClearAll?: () => void;
}

/**
 * FilterChipBar — shows active tag/group/segment filters as removable chips.
 * Appears at the top of the Contacts tab content when filters are applied.
 */
export function FilterChipBar({ filters, onClearAll }: FilterChipBarProps) {
  if (filters.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-5 py-2 border-b border-border-primary bg-accent/5 flex-wrap"
      role="region"
      aria-label="Active filters"
    >
      <span className="text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider">
        Filtered by:
      </span>
      {filters.map((f) => (
        <span
          key={f.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium"
          style={
            f.color
              ? {
                  backgroundColor: `${f.color}20`,
                  color: f.color,
                }
              : { backgroundColor: "var(--color-accent, #3b82f6)20" }
          }
        >
          {f.label}
          <button
            type="button"
            onClick={f.onRemove}
            className="ml-0.5 hover:opacity-70 transition-opacity"
            aria-label={`Remove filter ${f.label}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-[0.625rem] text-text-tertiary hover:text-text-primary underline ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
