import type { ReactNode } from "react";

interface SidebarContainerProps {
  title?: string;
  children: ReactNode;
}

export function SidebarContainer({ title, children }: SidebarContainerProps) {
  return (
    <aside className="flex flex-col bg-sidebar-bg" aria-label={title ?? "Sidebar"}>
      {title && (
        <div className="px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
