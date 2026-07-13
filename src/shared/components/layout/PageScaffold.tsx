/**
 * PageScaffold — the unified primary-page shell.
 *
 * Every primary list/content page (Contacts, Attachments, Tasks, Calendar,
 * Automation, Invoicing, ERP, People/CRM …) renders through this so alignment,
 * spacing, title row, toolbar/filter row, content region and empty state are
 * identical across the app. Email, Dashboard, POS, AI-assistant and the Vault
 * lock screen are intentionally exempt (they have bespoke layouts).
 *
 * Structure:
 *   ┌ header ─ title + count + subtitle ............ [primary actions] ┐
 *   ├ toolbar ─ search / FilterBar / view toggle (optional) ..........┤
 *   └ content ─ table / grid / custom view, or the empty-state slot ..┘
 *
 * The component owns only layout + the empty-state swap. Pages pass their own
 * search box, FilterBar, table, etc. into the slots.
 */

import type { ReactNode } from "react";
import { cn } from "@shared/utils/cn";

export interface PageScaffoldProps {
  /** Page title (already translated by the caller). */
  title: ReactNode;
  /** Optional count shown next to the title (e.g. total records). */
  count?: number;
  /** Optional one-line subtitle / description under the title. */
  subtitle?: ReactNode;
  /** Primary actions rendered on the right of the header (buttons, menus). */
  actions?: ReactNode;
  /** Optional toolbar row: search input, FilterBar, view toggle, etc. */
  toolbar?: ReactNode;
  /**
   * When true, the content region renders `emptyState` instead of `children`.
   * Keeps the empty/loaded decision in one place so every page behaves alike.
   */
  isEmpty?: boolean;
  /** Node to render when `isEmpty` is true (use the shared EmptyState). */
  emptyState?: ReactNode;
  /** Main content (table / grid / custom view). */
  children?: ReactNode;
  /** Extra classes for the outer container. */
  className?: string;
  /** Extra classes for the content region. */
  contentClassName?: string;
  /** Constrain content width; defaults to full-bleed for list pages. */
  maxWidth?: "full" | "prose" | "xl" | "2xl";
}

const MAX_WIDTH: Record<NonNullable<PageScaffoldProps["maxWidth"]>, string> = {
  full: "max-w-none",
  xl: "max-w-[1280px] mx-auto w-full",
  "2xl": "max-w-[1536px] mx-auto w-full",
  prose: "max-w-3xl mx-auto w-full",
};

export function PageScaffold({
  title,
  count,
  subtitle,
  actions,
  toolbar,
  isEmpty = false,
  emptyState,
  children,
  className,
  contentClassName,
  maxWidth = "full",
}: PageScaffoldProps) {
  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-text-primary">{title}</h1>
            {typeof count === "number" && (
              <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm text-text-tertiary">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {/* Toolbar (search / filters / view toggle) */}
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border-primary px-6 py-2.5">
          {toolbar}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto px-6 py-4",
          MAX_WIDTH[maxWidth],
          contentClassName,
        )}
      >
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">{emptyState}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
