/**
 * Skeleton loading placeholders.
 *
 * Uses animate-pulse with bg-bg-tertiary for shimmer effect.
 * All components accept className overrides and support dark mode via
 * CSS variable tokens (no hardcoded colors).
 *
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-32" />
 * <SkeletonLine width="75%" />
 * <SkeletonBlock className="h-32" />
 * <SkeletonCard />
 * <SkeletonTable rows={5} columns={4} />
 * <SkeletonPage />
 * <ThreadCardSkeleton />
 * <EmailListSkeleton count={6} />
 * <MessageSkeleton />
 * ```
 */

import { memo, type HTMLAttributes } from "react";
import { cn } from "@shared/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes to merge onto the skeleton element */
  className?: string;
}

export interface SkeletonTableProps {
  /** Number of rows to render (default: 5) */
  rows?: number;
  /** Number of columns to render (default: 4) */
  columns?: number;
  /** Additional CSS classes to merge onto the table container */
  className?: string;
}

export interface SkeletonPageProps {
  /** Additional CSS classes to merge onto the page skeleton */
  className?: string;
}

export interface SkeletonCardProps {
  /** Additional CSS classes to merge onto the card skeleton */
  className?: string;
}

export interface SkeletonLineProps {
  /** Width of the line as a CSS value (e.g. "50%", "120px"). Default: "100%" */
  width?: string;
  /** Additional CSS classes to merge onto the line */
  className?: string;
}

export interface SkeletonBlockProps {
  /** Additional CSS classes to merge onto the block */
  className?: string;
}

// ─── Base Skeleton ──────────────────────────────────────────────────────────

/**
 * Base skeleton placeholder — a pulse-animated block.
 * Use as a building block for custom skeletons.
 */
export const Skeleton = memo(function Skeleton({
  className,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse bg-bg-tertiary rounded-md", className)}
      aria-hidden="true"
      {...rest}
    />
  );
});

// ─── SkeletonLine ──────────────────────────────────────────────────────────

/**
 * A single line skeleton, suitable for text placeholders.
 * Width defaults to 100%; use `width` prop to control.
 */
export const SkeletonLine = memo(function SkeletonLine({
  width = "100%",
  className,
}: SkeletonLineProps) {
  return (
    <Skeleton
      className={cn("h-3.5", className)}
      style={{ width }}
    />
  );
});

// ─── SkeletonBlock ─────────────────────────────────────────────────────────

/**
 * A rectangular block skeleton. Height defaults to h-16; override with className.
 */
export const SkeletonBlock = memo(function SkeletonBlock({
  className,
}: SkeletonBlockProps) {
  return (
    <Skeleton className={cn("h-16 w-full", className)} />
  );
});

// ─── SkeletonCard ──────────────────────────────────────────────────────────

/**
 * Card-shaped skeleton — a rounded rectangle resembling a card/panel.
 */
export const SkeletonCard = memo(function SkeletonCard({
  className,
}: SkeletonCardProps) {
  return (
    <div className={cn("bg-bg-secondary rounded-xl border border-border-primary p-4 animate-pulse", className)}>
      {/* Header area */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
      {/* Content lines */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      {/* Footer */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-secondary">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
});

// ─── SkeletonTable ─────────────────────────────────────────────────────────

/**
 * Table skeleton — renders skeleton rows matching table column structure.
 */
export const SkeletonTable = memo(function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn("animate-pulse", className)} role="status" aria-label="Loading table">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-primary">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Skeleton
            key={`header-${colIdx}`}
            className={cn(
              "h-3.5",
              colIdx === 0 ? "w-1/4" : "w-1/6",
            )}
          />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="flex items-center gap-3 px-4 py-3 border-b border-border-secondary"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton
              key={`cell-${rowIdx}-${colIdx}`}
              className={cn(
                "h-3",
                colIdx === 0 ? "w-1/4" : "w-1/6",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

// ─── SkeletonPage ──────────────────────────────────────────────────────────

/**
 * Full-page skeleton — renders a heading area + content grid.
 * Ideal for page-level loading states.
 */
export const SkeletonPage = memo(function SkeletonPage({
  className,
}: SkeletonPageProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-3 sm:p-6", className)} role="status" aria-label="Loading page">
      {/* Heading area */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48 sm:h-8" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
});

// ─── Existing feature-specific skeletons (preserved for backward compat) ──

export const ThreadCardSkeleton = memo(function ThreadCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-border-secondary animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-bg-tertiary shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3.5 bg-bg-tertiary rounded w-28" />
            <div className="h-3 bg-bg-tertiary rounded w-12" />
          </div>
          <div className="h-3 bg-bg-tertiary rounded w-48" />
          <div className="h-3 bg-bg-tertiary rounded w-64" />
        </div>
      </div>
    </div>
  );
});

export const EmailListSkeleton = memo(function EmailListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ThreadCardSkeleton key={i} />
      ))}
    </>
  );
});

export const MessageSkeleton = memo(function MessageSkeleton() {
  return (
    <div className="px-6 py-4 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-bg-tertiary" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 bg-bg-tertiary rounded w-32" />
          <div className="h-3 bg-bg-tertiary rounded w-48" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-bg-tertiary rounded w-full" />
        <div className="h-3 bg-bg-tertiary rounded w-5/6" />
        <div className="h-3 bg-bg-tertiary rounded w-4/6" />
        <div className="h-3 bg-bg-tertiary rounded w-3/6" />
      </div>
    </div>
  );
});
