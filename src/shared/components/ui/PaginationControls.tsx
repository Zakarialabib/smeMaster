/**
 * PaginationControls — glass-styled pagination component for page-based navigation.
 *
 * Renders a compact pagination bar with:
 *  - "Showing X-Y of Z" label on the left
 *  - Page number buttons with ellipsis for large page counts
 *  - Previous / Next buttons
 *  - Optional page size selector
 *
 * @example
 * ```tsx
 * <PaginationControls
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   pageSize={pageSize}
 *   totalItems={total}
 *   onPageChange={goToPage}
 *   onPageSizeChange={setPageSize}
 * />
 * ```
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@shared/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaginationControlsProps {
  /** Current active page (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items across all pages */
  totalItems: number;
  /** Called when user clicks a page button */
  onPageChange: (page: number) => void;
  /** Called when user selects a new page size */
  onPageSizeChange?: (size: number) => void;
  /** Available page size options for the select. Defaults to [25, 50, 100, 200] */
  pageSizeOptions?: number[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates a compact page number array with ellipsis markers.
 * Always shows first, last, current page, and one page either side of current.
 * Uses `null` to represent ellipsis gaps.
 *
 * Example: totalPages=20, current=8 → [1, null, 7, 8, 9, null, 20]
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | null)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | null)[] = [];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  // Always show first page
  pages.push(1);

  // Ellipsis before window if needed
  if (start > 2) {
    pages.push(null);
  }

  // Page window around current
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Ellipsis after window if needed
  if (end < totalPages - 1) {
    pages.push(null);
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
}: PaginationControlsProps) {
  // Don't render if there's only one page
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      className="flex items-center justify-between gap-3 px-4 py-2 glass-top-bar rounded-lg flex-wrap"
      aria-label="Pagination"
    >
      {/* Left: "Showing X-Y of Z" */}
      <span className="text-text-secondary text-xs">
        Showing {start}–{end} of {totalItems}
      </span>

      {/* Right: Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            "flex items-center justify-center min-w-8 min-h-[36px] h-9 rounded-md text-xs transition-colors",
            currentPage <= 1
              ? "opacity-30 cursor-not-allowed text-text-tertiary"
              : "bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
          )}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page number buttons */}
        {pageNumbers.map((page, index) => {
          if (page === null) {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex items-center justify-center min-w-8 min-h-[36px] h-9 text-xs text-text-tertiary select-none"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          const isCurrent = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              disabled={isCurrent}
              className={cn(
                "flex items-center justify-center min-w-8 min-h-[36px] h-9 rounded-md text-xs font-medium transition-colors",
                isCurrent
                  ? "bg-accent text-white cursor-default"
                  : "bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
              )}
              aria-label={`Page ${page}`}
              aria-current={isCurrent ? "page" : undefined}
            >
              {page}
            </button>
          );
        })}

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            "flex items-center justify-center min-w-8 min-h-[36px] h-9 rounded-md text-xs transition-colors",
            currentPage >= totalPages
              ? "opacity-30 cursor-not-allowed text-text-tertiary"
              : "bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
          )}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>

        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="ml-2 pl-2 border-l border-border-primary">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="glass-select text-text-primary text-xs px-2 py-1 rounded-md outline-none"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}/page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </nav>
  );
}
