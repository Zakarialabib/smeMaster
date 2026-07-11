import type { ComponentType } from "react";

interface TabNavItemProps {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: number;
  disabled?: boolean;
  active: boolean;
  onClick: () => void;
  /** 'vertical' renders with full-width styling, 'horizontal' for inline tabs */
  orientation: "vertical" | "horizontal";
}

export function TabNavItem({
  id,
  label,
  icon: Icon,
  badge,
  disabled,
  active,
  onClick,
  orientation,
}: TabNavItemProps) {
  if (orientation === "vertical") {
    return (
      <button
        key={id}
        onClick={onClick}
        disabled={disabled}
        className={`flex w-full items-center px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          active
            ? "bg-accent/10 text-accent border-l-2 border-accent"
            : "hover:bg-bg-secondary/50"
        } ${disabled ? "text-text-tertiary/50 cursor-not-allowed" : ""}`}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        <span className="ml-2">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-auto flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-accent text-xs text-white">
            {badge}
          </span>
        )}
      </button>
    );
  }

  // Horizontal
  return (
    <button
      key={id}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
        active
          ? "bg-accent text-white"
          : "hover:bg-bg-secondary/50 text-text-primary"
      } ${disabled ? "text-text-tertiary/50 cursor-not-allowed" : ""}`}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
      <span className="ml-2">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-accent text-xs text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
