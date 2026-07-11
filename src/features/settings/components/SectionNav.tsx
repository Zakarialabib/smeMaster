import { useMemo } from "react";
import { cn } from "@shared/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SectionNavItem {
  id: string;
  label: string;
}

export interface SectionNavProps {
  sections: SectionNavItem[];
  /** Optional — will use scroll-based active detection if omitted */
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
  className?: string;
}

// ─── SectionNav ─────────────────────────────────────────────────────────────

/**
 * SectionNav — Sticky sub-navigation for multi-section settings tabs.
 *
 * Renders a horizontal scrollable list of section links. When a section is
 * clicked, it scrolls the target element into view and updates the active
 * state.
 *
 * Section target elements should have an `id` matching `section.id`.
 *
 * @example
 *   <SectionNav
 *     sections={[
 *       { id: "signatures", label: "Signatures" },
 *       { id: "templates", label: "Templates" },
 *     ]}
 *     onSectionClick={(id) => {
 *       document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
 *     }}
 *   />
 */
export function SectionNav({
  sections,
  activeSection,
  onSectionClick,
  className,
}: SectionNavProps) {
  // Auto-detect active section based on scroll position
  const scrollActive = useMemo(() => {
    if (activeSection) return activeSection;
    // On first render, highlight first section
    return sections[0]?.id ?? "";
  }, [activeSection, sections]);

  return (
    <nav
      className={cn(
        "sticky top-0 z-10 flex items-center gap-1 overflow-x-auto py-2 px-1 -mx-1 bg-bg-primary/80 backdrop-blur-sm border-b border-border-primary/60",
        className,
      )}
      role="tablist"
      aria-label="Section navigation"
    >
      {sections.map((section) => {
        const isActive = scrollActive === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "whitespace-nowrap px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all",
              isActive
                ? "bg-accent/15 text-accent shadow-sm"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-hover",
            )}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
