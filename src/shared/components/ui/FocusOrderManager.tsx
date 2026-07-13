import type { ReactNode } from "react";

interface FocusRegionProps {
  /** Machine-readable ID (used for `aria-labelledby` if no label). */
  id?: string;
  /** Human-readable label for screen readers. */
  label: string;
  children: ReactNode;
  className?: string;
  /** Optional heading level (1-6) rendered before children. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Tag to use for the container. Defaults to "section". */
  as?: "section" | "div" | "article" | "nav" | "aside";
}

/**
 * FocusRegion — a semantic wrapper that marks a major app region.
 *
 * Does NOT override natural tab order (no explicit tabIndex values).
 * Instead, it structures the page into navigable regions that assistive
 * technology can use for quick-jump navigation.
 *
 * @example
 * ```tsx
 * <FocusRegion label="Mail toolbar">
 *   <Toolbar />
 * </FocusRegion>
 *
 * <FocusRegion label="Email list" headingLevel={2}>
 *   <ThreadList />
 * </FocusRegion>
 * ```
 */
export function FocusRegion({
  id,
  label,
  children,
  className = "",
  headingLevel,
  as: Tag = "section",
}: FocusRegionProps) {
  return (
    <Tag
      id={id}
      role="region"
      aria-label={label}
      className={className}
    >
      {headingLevel && (
        <h2
          className="sr-only"
          data-focus-region-heading
          style={{ "--region-label": label } as React.CSSProperties}
        >
          {label}
        </h2>
      )}
      {children}
    </Tag>
  );
}

interface FocusOrderManagerProps {
  /** Ordered list of region configurations. */
  regions: Array<{
    id?: string;
    label: string;
    children: ReactNode;
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    as?: "section" | "div" | "article" | "nav" | "aside";
  }>;
  className?: string;
}

/**
 * FocusOrderManager — groups the app into semantically ordered regions.
 *
 * This is a light wrapper around FocusRegion that renders multiple regions
 * in sequence. The natural DOM order determines tab order — no explicit
 * tabIndex values are set.
 *
 * Use at the top level of a page or shell layout to define the reading
 * and navigation order for assistive technology.
 *
 * @example
 * ```tsx
 * <FocusOrderManager
 *   regions={[
 *     { label: "Navigation", children: <Sidebar />, as: "nav" },
 *     { label: "Main content", children: <Main />, headingLevel: 1 },
 *     { label: "Supplementary info", children: <Aside />, as: "aside" },
 *   ]}
 * />
 * ```
 */
export function FocusOrderManager({
  regions,
  className = "",
}: FocusOrderManagerProps) {
  return (
    <div className={className}>
      {regions.map((region, index) => (
        <FocusRegion
          key={region.id ?? `region-${index}`}
          id={region.id}
          label={region.label}
          headingLevel={region.headingLevel}
          as={region.as}
        >
          {region.children}
        </FocusRegion>
      ))}
    </div>
  );
}
