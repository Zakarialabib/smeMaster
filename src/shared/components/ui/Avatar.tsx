import { cn } from "@shared/utils/cn";

export interface AvatarProps {
  /** Display name or address — first letter is used as the fallback initial. */
  name?: string | null;
  /** Explicit initials (overrides derived initial). */
  initials?: string;
  /** Visual size preset. */
  size?: "sm" | "md" | "lg";
  /** Force the read-state look (muted when read). */
  muted?: boolean;
  /** Extra classes. */
  className?: string;
}

const SIZE_MAP = {
  sm: "w-7 h-7 text-xs rounded-full",
  md: "w-9 h-9 text-sm rounded-full",
  lg: "w-11 h-11 text-base rounded-2xl",
} as const;

/**
 * Frosted-glass sender avatar used in the email list and reading pane.
 * Keeps a consistent circular/rounded shape, an accent gradient ring, and
 * high-contrast initials. Empty/unknown senders fall back to a neutral glyph.
 */
export function Avatar({ name, initials, size = "md", muted = false, className = "" }: AvatarProps) {
  const initial =
    (initials ?? name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div
      className={cn(
        "shrink-0 grid place-items-center font-semibold text-white select-none",
        "ring-1 ring-white/60 shadow-[0_1px_2px_rgba(16,24,40,0.12)]",
        "bg-gradient-to-br from-accent to-accent-active",
        muted && "from-text-tertiary to-text-secondary ring-white/40",
        SIZE_MAP[size],
        className,
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
