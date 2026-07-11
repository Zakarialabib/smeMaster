/**
 * RagSkeleton — Skeleton loading placeholders for AI Assistant results.
 *
 * Shows pulsing glass-surface rectangles while a search is in flight.
 *
 * @module
 */

import { cn } from "@shared/utils/cn";

export interface RagSkeletonProps {
  /** Number of skeleton bubbles to show (default 3) */
  count?: number;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 rounded-full bg-white/10 dark:bg-white/5 animate-pulse",
        className,
      )}
    />
  );
}

export function RagSkeleton({ count = 3 }: RagSkeletonProps) {
  return (
    <div className="space-y-6 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 animate-[fadeIn_150ms_ease-out]">
          {/* User query skeleton (right-aligned) */}
          <div className="flex justify-end">
            <div
              className={cn(
                "w-2/3 p-4",
                "rounded-2xl rounded-br-md",
                "bg-accent/10 border border-accent/20",
              )}
            >
              <SkeletonLine className="w-3/4 bg-accent/20" />
            </div>
          </div>

          {/* AI response skeleton (left-aligned) */}
          <div className="flex justify-start">
            <div
              className={cn(
                "w-3/4 p-4",
                "rounded-2xl rounded-bl-md",
                "frost-surface",
              )}
            >
              <div className="space-y-2">
                <SkeletonLine className="w-full" />
                <SkeletonLine className="w-5/6" />
                <SkeletonLine className="w-2/3" />
                <SkeletonLine className="w-4/5" />
                <SkeletonLine className="w-1/2" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
