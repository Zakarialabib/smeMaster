import { AlertCircle, type LucideIcon } from "lucide-react";
import { memo, type ComponentType, type ReactNode, createElement } from "react";
import {
  EMPTY_STATE,
  EMPTY_ICON,
  EMPTY_ILLUSTRATION,
} from "@shared/styles/ui-tokens";
import {
  GenericEmptyIllustration,
  InboxClearIllustration,
  NoAccountIllustration,
  NoSearchResultsIllustration,
  ReadingPaneIllustration,
} from "./illustrations";

export type EmptyStateSize = "sm" | "md" | "lg";

/**
 * Pre-defined empty state variants that auto-select illustration + default text.
 * - "empty": Generic "no data" state
 * - "search": No search results
 * - "no-selection": No item selected in split-pane
 * - "no-account": No email account configured
 * - "offline": Feature requires network but user is offline
 * - "inbox-zero": All items processed (inbox zero)
 * - "error": Error state (use ErrorState component instead for complex errors)
 */
export type EmptyStateVariant = "empty" | "search" | "no-selection" | "no-account" | "offline" | "inbox-zero";

interface EmptyStateWithVariant {
  variant: EmptyStateVariant;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
  iconClassName?: string;
  /** When true, adds aria-live="polite" so screen readers announce this empty state after loading completes. */
  announce?: boolean;
}

interface EmptyStateCustom {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  size?: EmptyStateSize;
  className?: string;
  iconClassName?: string;
  icon?: LucideIcon;
  illustration?: ComponentType<{ size?: number; className?: string }>;
  /** When true, adds aria-live="polite" so screen readers announce this empty state after loading completes. */
  announce?: boolean;
}

export type EmptyStateProps = EmptyStateWithVariant | EmptyStateCustom;

const iconSizes: Record<EmptyStateSize, number> = {
  sm: 36,
  md: 48,
  lg: 64,
};

const illustrationSizes: Record<EmptyStateSize, number> = {
  sm: 100,
  md: 140,
  lg: 180,
};

interface VariantDefaults {
  illustration?: ComponentType<{ size?: number; className?: string }>;
  icon?: LucideIcon;
  title: string;
  subtitle: string;
}

const VARIANT_MAP: Record<EmptyStateVariant, VariantDefaults> = {
  empty: {
    illustration: GenericEmptyIllustration,
    title: "No data yet",
    subtitle: "Data will appear here as you start using the app.",
  },
  search: {
    illustration: NoSearchResultsIllustration,
    title: "No matching results",
    subtitle: "Try a different search term or clear the filter.",
  },
  "no-selection": {
    illustration: ReadingPaneIllustration,
    title: "Nothing selected",
    subtitle: "Select an item from the list to view its details.",
  },
  "no-account": {
    illustration: NoAccountIllustration,
    title: "No account configured",
    subtitle: "Add an email account to get started with sending and receiving.",
  },
  offline: {
    icon: AlertCircle,
    title: "You're offline",
    subtitle: "This feature requires an internet connection. Try again when you're back online.",
  },
  "inbox-zero": {
    illustration: InboxClearIllustration,
    title: "All caught up!",
    subtitle: "You've processed everything. Great work.",
  },
};

const EmptyState = memo(function EmptyState(props: EmptyStateProps) {
  const isVariant = "variant" in props;

  // Resolve variant defaults
  let resolvedTitle: string;
  let resolvedSubtitle: string | undefined;
  let resolvedIllustration: ComponentType<{ size?: number; className?: string }> | undefined;
  let resolvedIcon: LucideIcon | undefined;
  let action: ReactNode | undefined;
  let size: EmptyStateSize;
  let className: string;
  let iconClassName: string;
  let announce: boolean;

  if (isVariant) {
    const v = VARIANT_MAP[props.variant];
    resolvedTitle = props.title ?? v.title;
    resolvedSubtitle = props.subtitle ?? v.subtitle;
    resolvedIllustration = v.illustration;
    resolvedIcon = v.icon;
    action = props.action;
    size = props.size ?? "md";
    className = props.className ?? "";
    iconClassName = props.iconClassName ?? "";
    announce = props.announce ?? false;
  } else {
    resolvedTitle = props.title;
    resolvedSubtitle = props.subtitle;
    action = props.action;
    size = props.size ?? "md";
    className = props.className ?? "";
    iconClassName = props.iconClassName ?? "";
    announce = props.announce ?? false;
    if ("illustration" in props && props.illustration) {
      resolvedIllustration = props.illustration;
    } else if ("icon" in props && props.icon) {
      resolvedIcon = props.icon;
    }
  }

  return (
    <div
      className={`${EMPTY_STATE} ${className}`}
      {...(announce ? { role: "status" as const, "aria-live": "polite" as const } : {})}
    >
      {resolvedIllustration
        ? createElement(resolvedIllustration, {
            size: illustrationSizes[size],
            className: EMPTY_ILLUSTRATION,
          })
        : resolvedIcon
          ? createElement(resolvedIcon, {
              size: iconSizes[size],
              strokeWidth: 1,
              className: `${EMPTY_ICON} ${iconClassName}`,
            })
          : null}
      <p className="text-sm font-medium text-text-secondary">{resolvedTitle}</p>
      {resolvedSubtitle && (
        <p className="text-xs mt-1.5 text-text-tertiary text-center max-w-xs">
          {resolvedSubtitle}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
});
export { EmptyState };
