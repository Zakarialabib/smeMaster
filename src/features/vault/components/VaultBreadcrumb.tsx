import { Home, ChevronRight } from "lucide-react";

interface VaultBreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onNavigateUp: () => void;
}

export function VaultBreadcrumb({
  currentPath,
  onNavigate,
  onNavigateUp,
}: VaultBreadcrumbProps) {
  const pathParts = currentPath ? currentPath.split(/[/\\]/) : [];
  const breadcrumbs = [
    { label: "Vault", path: "" },
    ...pathParts.map((p, i) => ({
      label: p,
      path: pathParts.slice(0, i + 1).join("/"),
    })),
  ];

  return (
    <nav
      className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto"
      aria-label="Vault breadcrumb"
    >
      {breadcrumbs.map((crumb, idx) => (
        <span key={idx} className="flex items-center gap-1">
          {idx > 0 && (
            <ChevronRight
              size={12}
              className="text-text-tertiary shrink-0"
              aria-hidden="true"
            />
          )}
          <button
            onClick={() =>
              idx === 0 ? onNavigateUp() : onNavigate(crumb.path)
            }
            className={`text-sm truncate max-w-[120px] px-1 py-0.5 rounded hover:bg-bg-hover transition-colors ${
              idx === breadcrumbs.length - 1
                ? "font-semibold text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
            aria-current={idx === breadcrumbs.length - 1 ? "page" : undefined}
          >
            {idx === 0 ? (
              <span className="flex items-center gap-1">
                <Home size={14} aria-hidden="true" />
                {crumb.label}
              </span>
            ) : (
              crumb.label
            )}
          </button>
        </span>
      ))}
    </nav>
  );
}
