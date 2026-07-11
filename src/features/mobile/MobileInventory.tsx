import type { ReactNode } from "react";

/* ── Mobile component registry ────────────────────────────────────
 * Central inventory of all mobile-specific components and routes.
 * Only rendered in development mode (import.meta.env.DEV).
 * Useful as a debug panel entry for developers.
 * ──────────────────────────────────────────────────────────────── */

interface MobileEntry {
  name: string;
  path: string;
  description: string;
}

const MOBILE_COMPONENTS: MobileEntry[] = [
  {
    name: "OfflineIndicator",
    path: "src/shared/components/ui/OfflineIndicator.tsx",
    description:
      "Top-of-screen bar that appears when the browser reports offline status. Uses online/offline events and auto-hides with animation.",
  },
  {
    name: "MobileOfflineBanner",
    path: "src/features/mobile/MobileOfflineBanner.tsx",
    description:
      "Enhanced offline banner for mobile with animated entrance/exit, sync queue count, and safe area inset support for notched phones.",
  },
  {
    name: "MobileSyncStatus",
    path: "src/features/mobile/MobileSyncStatus.tsx",
    description:
      "Sync status indicator showing online/offline/syncing/pending state with appropriate icons. Uses syncStore for reactive updates.",
  },
  {
    name: "MobilePullToRefresh",
    path: "src/features/mobile/MobilePullToRefresh.tsx",
    description:
      "Mobile pull-to-refresh wrapper pre-configured with mobile-friendly defaults. Wraps the shared PullToRefresh component.",
  },
  {
    name: "SwipeToDelete",
    path: "src/shared/components/ui/SwipeToDelete.tsx",
    description:
      "Wraps list items with touch-based left-swipe to reveal a red Delete button. Uses raw touch events (touchstart/touchmove/touchend).",
  },
  {
    name: "BottomTabBar",
    path: "src/shared/components/layout/BottomTabBar.tsx",
    description:
      "Mobile bottom navigation bar with Mail, CRM, Campaigns, Calendar, and Settings tabs. Includes unread badge and FAB for adding accounts.",
  },
  {
    name: "NotificationToast",
    path: "src/shared/components/ui/NotificationToast.tsx",
    description:
      "Push notification toast displayed via Tauri event listener (notification:received). Auto-dismisses after 5s with slide-down animation.",
  },
  {
    name: "MobileShell",
    path: "src/shared/components/layout/MobileShell.tsx",
    description:
      "Adaptive layout shell that switches between Phone (BottomTabBar), Tablet landscape (compact sidebar), and Desktop (full sidebar) layouts.",
  },
  {
    name: "VaultPage",
    path: "src/features/vault/pages/VaultPage.tsx",
    description:
      "Encrypted file vault with biometric unlock, directory browsing, search, sort, drag-and-drop upload, and file deletion. Requires Tauri biometric APIs.",
  },
  {
    name: "MobileSettingsPage",
    path: "src/features/settings/pages/MobileSettingsPage.tsx",
    description:
      "Mobile-specific settings for background sync, cache management, biometric lock, device pairing, and push notifications.",
  },
  {
    name: "DevicePairingPage",
    path: "src/features/settings/pages/DevicePairingPage.tsx",
    description:
      "Manage paired devices with list view, remove pairing, and pair-new-device stub. Uses Tauri invoke for native pairing APIs.",
  },
];

/** Grouped by layer for readability */
const GROUPS: { label: string; names: string[] }[] = [
  {
    label: "UI Components",
    names: ["OfflineIndicator", "MobileOfflineBanner", "MobileSyncStatus", "SwipeToDelete", "NotificationToast"],
  },
  {
    label: "Layout",
    names: ["MobileShell", "BottomTabBar", "MobilePullToRefresh"],
  },
  {
    label: "Pages / Routes",
    names: ["VaultPage", "MobileSettingsPage", "DevicePairingPage"],
  },
];

function MobileInventoryCard({ entry }: { entry: MobileEntry }) {
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <code className="font-semibold text-accent text-xs">{entry.name}</code>
        <span className="text-[10px] text-text-tertiary font-mono truncate ml-2 max-w-[240px]">
          {entry.path}
        </span>
      </div>
      <p className="text-text-secondary text-xs leading-relaxed">
        {entry.description}
      </p>
    </div>
  );
}

/** Renders the full inventory grouped by layer. */
export function MobileInventory(): ReactNode {
  if (!import.meta.env.DEV) return null;

  const componentMap = Object.fromEntries(
    MOBILE_COMPONENTS.map((c) => [c.name, c]),
  );

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-text-primary">
          📱 Mobile Component Inventory
        </h2>
        <p className="text-xs text-text-tertiary mt-0.5">
          {MOBILE_COMPONENTS.length} components &middot; Dev only
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.label}>
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.names.map((name) => {
              const entry = componentMap[name];
              if (!entry) return null;
              return <MobileInventoryCard key={name} entry={entry} />;
            })}
          </div>
        </section>
      ))}

      <details className="text-xs text-text-tertiary border-t border-border-primary pt-3 mt-4">
        <summary className="cursor-pointer font-medium mb-1">
          All entries (flat)
        </summary>
        <ul className="space-y-1 list-disc pl-4">
          {MOBILE_COMPONENTS.map((c) => (
            <li key={c.name}>
              <code className="text-accent">{c.name}</code>{" "}
              <span className="text-text-tertiary">{c.path}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

