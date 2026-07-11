import { PullToRefresh } from "@shared/components/ui/PullToRefresh";
import type { ReactNode } from "react";

interface MobilePullToRefreshProps {
  /** Called when the user releases past the threshold */
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** Loading state — shows spinner while refreshing */
  refreshing?: boolean;
  className?: string;
}

/**
 * Mobile-specific pull-to-refresh wrapper.
 *
 * This is a thin wrapper around the shared PullToRefresh component,
 * pre-configured with mobile-friendly defaults and safe area padding.
 *
 * @example
 * ```tsx
 * <MobilePullToRefresh onRefresh={loadData}>
 *   <div className="overflow-y-auto h-full">
 *     {items.map(item => <ListItem key={item.id} {...item} />)}
 *   </div>
 * </MobilePullToRefresh>
 * ```
 */
export function MobilePullToRefresh({
  onRefresh,
  children,
  refreshing = false,
  className = "",
}: MobilePullToRefreshProps) {
  return (
    <PullToRefresh
      onRefresh={onRefresh}
      threshold={60}
      maxPull={120}
      refreshing={refreshing}
      className={`h-full ${className}`}
    >
      {children}
    </PullToRefresh>
  );
}
