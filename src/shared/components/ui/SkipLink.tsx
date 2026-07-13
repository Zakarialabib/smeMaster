import { useTranslation } from "react-i18next";

interface SkipLinkProps {
  /** The href of the main content element. */
  href?: string;
}

/**
 * SkipLink — a "Skip to main content" link that appears on first Tab press.
 *
 * Hidden by default via `sr-only`, becomes visible on focus (keyboard Tab).
 * Uses logical properties (`inset-inline-start`) for RTL support.
 *
 * @example
 * ```tsx
 * <SkipLink />
 * <SkipLink href="#main-content" />
 * ```
 */
export function SkipLink({ href = "#main-content" }: SkipLinkProps) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:inset-inline-start-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-hover focus:shadow-lg"
      aria-label={t("common.skipToContent")}
      role="link"
    >
      {t("common.skipToContent")}
    </a>
  );
}
