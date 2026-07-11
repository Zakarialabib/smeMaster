import type { LucideIcon } from "lucide-react";
import type { DbContact, ContactEngagementRow, ContactStats } from "@features/contacts/db/contacts";

// ─── Tag & Group types for detail view ─────────────────────────────────────

export interface ContactTag {
  id: string;
  name: string;
  color: string | null;
}

export interface ContactGroupInfo {
  id: string;
  name: string;
}

// ─── Health status helpers (deprecated) ─────────────────────────────────────
/** @deprecated Import from `@shared/utils/scoreVariant` instead. Use `getHealthStyle()`. */
export const HEALTH_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "bg-danger/15", text: "text-danger", label: "Hot" },
  warm: { bg: "bg-warning/15", text: "text-warning", label: "Warm" },
  lukewarm: { bg: "bg-accent/15", text: "text-accent", label: "Lukewarm" },
  cold: { bg: "bg-bg-tertiary", text: "text-text-tertiary", label: "Cold" },
};

/** @deprecated Import from `@shared/utils/scoreVariant` instead. Use `getHealthStyle().barColor`. */
export const SCORE_BAR_COLORS: Record<string, string> = {
  hot: "bg-danger",
  warm: "bg-warning",
  lukewarm: "bg-accent",
  cold: "bg-text-tertiary",
};

/** @deprecated Import from `@shared/utils/scoreVariant` instead. Use `getHealthStyle()`. */
export function getHealthConfig(status: string | undefined) {
  return (HEALTH_STYLES[status ?? ""] ?? HEALTH_STYLES.cold)!;
}

/** @deprecated Import from `@shared/utils/scoreVariant` instead. Use `getHealthStyle().barColor`. */
export function getScoreBarColor(status: string | undefined) {
  return (SCORE_BAR_COLORS[status ?? ""] ?? SCORE_BAR_COLORS.cold)!;
}

// ─── Tab definitions ──────────────────────────────────────────────────────

export type DetailTab = "info" | "emails" | "attachments" | "notes" | "files" | "campaigns" | "activity";

export interface TabDefinition {
  id: DetailTab;
  label: string;
  icon: LucideIcon;
}

// ─── Base props shared across tab components ───────────────────────────────

export interface ContactDetailBaseProps {
  contact: DbContact;
}

export interface WithEngagement {
  engagement: ContactEngagementRow | null;
  stats: ContactStats | null;
  contactTags: ContactTag[];
  contactGroups: ContactGroupInfo[];
}
