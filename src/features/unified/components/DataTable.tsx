import { memo, type ReactNode } from "react";
import { cn } from "@shared/utils/cn";

export interface DataTableColumn<T> {
  /** Stable id — also the CSS var hook for column-specific styling. */
  id: string;
  /** Header label. */
  header: string;
  /** Cell renderer. */
  cell: (row: T, rowIndex: number) => ReactNode;
  /** Column width (any CSS width). Optional. */
  width?: string;
  /** Horizontal alignment. */
  align?: "start" | "center" | "end";
  /** Hide below this viewport width (px). Optional responsive guard. */
  hideBelow?: number;
  /** Extra classes. */
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Optional row key. */
  rowKey?: (row: T, index: number) => string;
  /** Row click. */
  onRowClick?: (row: T, index: number) => void;
  /** Empty state. */
  empty?: ReactNode;
  /** Density. */
  density?: "compact" | "comfortable";
  className?: string;
}

/**
 * Unified data table — the single list/table grammar for the Unified Inbox.
 * Columns are plain config objects (vars): every column id maps to a
 * `--col-<id>` CSS variable hook so callers can theme individual columns
 * without forking the component. Frosted Glass styling only.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  density = "comfortable",
  className,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div className={cn("unified-table-empty", className)}>{empty}</div>;
  }

  return (
    <div
      className={cn(
        "unified-table w-full overflow-hidden rounded-[--radius-lg] border border-border-secondary bg-bg-secondary shadow-[var(--elevation-sm)]",
        className,
      )}
      role="table"
    >
      <div className="unified-table-head flex items-center gap-3 px-4 py-2.5 border-b border-border-secondary bg-bg-tertiary/40 text-xs font-semibold text-text-secondary uppercase tracking-wide">
        {columns.map((col) => (
          <div
            key={col.id}
            role="columnheader"
            className={cn(
              "min-w-0 flex-1 truncate",
              col.align === "center" && "text-center",
              col.align === "end" && "text-end",
              col.className,
            )}
            style={{ width: col.width, flex: col.width ? "0 0 auto" : undefined }}
          >
            {col.header}
          </div>
        ))}
      </div>

      <div className="unified-table-body">
        {rows.map((row, i) => (
          <div
            key={rowKey ? rowKey(row, i) : i}
            role="row"
            onClick={onRowClick ? () => onRowClick(row, i) : undefined}
            className={cn(
              "unified-table-row flex items-center gap-3 px-4 border-b border-border-secondary/70 last:border-b-0 transition-colors",
              density === "compact" ? "py-2" : "py-3",
              onRowClick && "cursor-pointer hover:bg-bg-hover",
            )}
          >
            {columns.map((col) => (
              <div
                key={col.id}
                role="cell"
                className={cn(
                  "min-w-0 flex-1 truncate",
                  col.align === "center" && "text-center",
                  col.align === "end" && "text-end",
                  col.className,
                )}
                style={{ width: col.width, flex: col.width ? "0 0 auto" : undefined }}
              >
                {col.cell(row, i)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const UnifiedDataTable = memo(DataTable) as typeof DataTable;
