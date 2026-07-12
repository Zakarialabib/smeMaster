import type { LucideIcon } from "lucide-react";
import { cn } from "@shared/utils/cn";

export interface CardTabItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

export interface CardTabBarProps<T extends string> {
  tabs: CardTabItem<T>[];
  activeTab: T;
  onTabChange: (id: T) => void;
  /** ARIA label for the tablist. */
  ariaLabel?: string;
  /** Optional class merged onto the container. */
  className?: string;
}

/**
 * Card-tab bar — a frosted rounded container holding equal-width icon+label
 * cards. The active tab becomes an accent-filled "card".
 *
 * Mirrors the CRM tab strip so every section switcher in the app stays
 * visually consistent. Renders proper ARIA tab semantics
 * (`role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`) and
 * pairs with a panel using `id={`tabpanel-${id}`}`.
 */
export function CardTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = "Tabs",
  className,
}: CardTabBarProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 px-1.5 py-1.5 rounded-2xl bg-bg-secondary/40 backdrop-blur-[12px] border border-border-secondary/40",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl text-[10px] font-medium transition-all duration-200 ios-tap",
              isActive
                ? "bg-accent text-white shadow-sm shadow-accent/30"
                : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover/50",
            )}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
