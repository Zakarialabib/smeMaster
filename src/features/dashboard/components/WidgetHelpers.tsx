import type { ReactNode } from "react";

/** Title bar for dashboard widgets. */
export function WidgetHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-accent shrink-0">{icon}</span>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  );
}

/** Skeleton placeholder while a widget is loading. */
export function WidgetSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-bg-tertiary rounded w-24" />
      <div className="h-8 bg-bg-tertiary rounded w-full" />
    </div>
  );
}

/** Inline error display for widgets. */
export function WidgetError({ message }: { message: string }) {
  return (
    <div className="text-xs text-danger bg-danger/5 rounded-lg p-3">{message}</div>
  );
}
