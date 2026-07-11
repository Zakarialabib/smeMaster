import { SidebarContentLayoutProps } from "../types";

export function SidebarContentLayout({
  className,
  header,
  sidebar,
  content,
  collapsed = false,
  headerHeight = 48,
  sidebarWidth = 340,
}: SidebarContentLayoutProps) {
  const headerHeightPx = typeof headerHeight === "number" ? `${headerHeight}px` : headerHeight;
  const sidebarWidthPx = typeof sidebarWidth === "number" ? `${sidebarWidth}px` : sidebarWidth;

  return (
    <div
      className={`flex h-screen w-full overflow-hidden flex-col text-text-primary sidebar-content-layout ${className}`}
    >
      {/* Header */}
      {header !== undefined && (
        <div className="w-full border-b border-border-primary" style={{ height: headerHeightPx }}>
          {header}
        </div>
      )}

      {/* Sidebar and Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar */}
        {sidebar !== undefined && (
          <div
            className={`flex-shrink-0 border-r border-border-primary overflow-x-hidden overflow-y-auto transition-all duration-200 ${
              collapsed ? "translate-x-[-100%]" : ""
            }`}
            style={{ width: sidebarWidthPx }}
          >
            {sidebar}
          </div>
        )}

        {/* Content */}
        {content !== undefined && (
          <div className="flex-1 overflow-y-auto">
            {content}
          </div>
        )}
      </div>
    </div>
  );
}