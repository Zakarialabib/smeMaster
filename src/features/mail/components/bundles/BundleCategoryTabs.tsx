import { Inbox, Bell, Tag, Users, Newspaper, Package } from "lucide-react";
import { ALL_CATEGORIES } from "@features/mail/db/threadCategories";
import type { DbBundleRule } from "@features/deliverability/db/bundleRules";

export interface BundleCategoryTabsProps {
  /** The currently selected category filter ("All" or one of the bundle categories) */
  activeBundleCategory: string;
  /** Called when a tab is clicked */
  onBundleCategoryChange: (category: string) => void;
  /** Bundle rules for the current account — defines which categories are active */
  bundleRules: DbBundleRule[];
  /** Unread counts per category to show in badges */
  unreadCounts: Record<string, number>;
}

const TAB_ICONS: Record<string, typeof Inbox> = {
  All: Package,
  Newsletters: Newspaper,
  Promotions: Tag,
  Social: Users,
  Updates: Bell,
};

/**
 * Category tabs shown in the email list header when bundles are active.
 * Adds an "All" tab + tabs for each category that has bundle rules configured.
 */
export function BundleCategoryTabs({
  activeBundleCategory,
  onBundleCategoryChange,
  bundleRules,
  unreadCounts,
}: BundleCategoryTabsProps) {
  // Determine which bundle categories have rules
  const bundleCategorySet = new Set(bundleRules.map((r) => r.category));

  // Only the bundle categories that have rules + "All"
  const tabs = ["All", ...ALL_CATEGORIES.filter((c) => bundleCategorySet.has(c))];

  if (tabs.length <= 1) return null; // Only "All" — no bundles active, don't render

  return (
    <div className="flex px-2 border-b border-border-secondary bg-bg-secondary/30 overflow-x-auto hide-scrollbar">
      {tabs.map((cat) => {
        const Icon = TAB_ICONS[cat] ?? Package;
        const count = unreadCounts[cat] ?? 0;
        const isActive = activeBundleCategory === cat;

        return (
          <button
            key={cat}
            onClick={() => onBundleCategoryChange(cat)}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors relative whitespace-nowrap flex items-center gap-1.5 ${
              isActive
                ? "text-accent"
                : "text-text-tertiary hover:text-text-primary"
            }`}
            aria-pressed={isActive}
            aria-label={`${cat} bundle tab${count > 0 ? `, ${count} unread` : ""}`}
          >
            {Icon && <Icon size={13} />}
            {cat}
            {count > 0 && (
              <span className="text-[0.625rem] bg-accent/15 text-accent px-1.5 rounded-full leading-normal">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
