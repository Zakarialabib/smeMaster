/**
 * GlassPanel — frosted glass surface with backdrop blur, liquid sheen, and glow.
 *
 * Uses the CSS custom properties defined in globals.css:
 *  - `--glass-blur`, `--glass-blur-heavy` for backdrop blur
 *  - `--glass-shadow`, `--glass-shadow-elevated` for depth
 *  - `--glass-highlight` for the inner edge highlight
 *  - `--glass-border` for the border color
 *  - `--liquid-shimmer` / `--liquid-sheen` for liquid effects
 *
 * @example
 * ```tsx
 * <GlassPanel>Default panel surface</GlassPanel>
 * <GlassPanel variant="elevated" glow>Elevated with glow</GlassPanel>
 * <GlassPanel variant="modal" className="p-6">Modal surface</GlassPanel>
 * <GlassPanel variant="liquid" glow>Liquid glass surface</GlassPanel>
 * <GlassPanel variant="liquid-elevated">Elevated liquid glass</GlassPanel>
 * ```
 */

import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@shared/utils/cn";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GlassVariant = "panel" | "modal" | "card" | "elevated" | "liquid" | "liquid-elevated";

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant. Defaults to "panel". */
  variant?: GlassVariant;
  /** Optional glow effect (colored box-shadow accent). */
  glow?: boolean;
  /** Animate the sheen shimmer continuously (liquid variants only). */
  animated?: boolean;
  /** Content children. */
  children?: ReactNode;
  /** Additional CSS classes to merge onto the container. */
  className?: string;
}

// ─── Variant class maps ─────────────────────────────────────────────────────

const VARIANT_CLASSES: Record<GlassVariant, string> = {
  panel:
    "frost-surface " +
    "rounded-[--frost-radius]",
  modal:
    "frost-surface-strong " +
    "rounded-[--frost-radius]",
  card:
    "frost-surface " +
    "rounded-[--frost-radius]",
  elevated:
    "frost-surface-strong " +
    "rounded-[--frost-radius]",
  liquid:
    "liquid-glass " +
    "rounded-[--frost-radius]",
  "liquid-elevated":
    "liquid-glass-elevated " +
    "rounded-[--frost-radius]",
};

const GLOW_CLASS =
  "liquid-glow";

const HIGHLIGHT_CLASS = "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--frost-highlight)]";

const ANIMATED_SHEEN_CLASS = "before:opacity-100 before:animate-[liquidShimmer_4s_ease-in-out_infinite]";

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * GlassPanel — a reusable frosted-glass surface with backdrop blur.
 *
 * Props extend HTML div attributes. The component applies:
 * 1. Backdrop blur (via CSS variable for the chosen variant)
 * 2. Box shadow for depth
 * 3. Transparent border with glass-white highlight
 * 4. Optional accent glow (liquid-glow animation)
 * 5. `before:` pseudo-element for the inner edge highlight
 * 6. Liquid variants add animated sheen/shiny overlay
 */
export function GlassPanel({
  variant = "panel",
  glow = false,
  animated = false,
  children,
  className,
  ...rest
}: GlassPanelProps) {
  const isLiquid = variant === "liquid" || variant === "liquid-elevated";

  return (
    <div
      className={cn(
        "relative rounded-xl transition-all duration-200",
        VARIANT_CLASSES[variant],
        !isLiquid && HIGHLIGHT_CLASS,
        glow && GLOW_CLASS,
        animated && isLiquid && ANIMATED_SHEEN_CLASS,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
