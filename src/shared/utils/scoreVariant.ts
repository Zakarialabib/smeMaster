import { CheckCircle, AlertTriangle, XCircle, type LucideIcon } from "lucide-react";

/**
 * A score variant packs all derived visual properties for a 0-100 score value.
 *
 * Levels: excellent (≥90), good (≥70), fair (≥50), poor (<50)
 */

export type ScoreLevel = "excellent" | "good" | "fair" | "poor";

export interface ScoreVariant {
  level: ScoreLevel;
  color: string;         // Tailwind text color class (e.g. "text-success")
  bgColor: string;       // Tailwind bg color class (e.g. "bg-success/10")
  borderColor: string;   // Tailwind border color class (e.g. "border-success")
  barColor: string;      // Tailwind bg for progress bar (e.g. "bg-success")
  icon: LucideIcon;
  label: string;         // Human-readable status label
}

const VARIANTS: Record<ScoreLevel, Omit<ScoreVariant, "level">> = {
  excellent: {
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success",
    barColor: "bg-success",
    icon: CheckCircle,
    label: "Excellent",
  },
  good: {
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning",
    barColor: "bg-warning",
    icon: CheckCircle,
    label: "Good",
  },
  fair: {
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500",
    barColor: "bg-orange-500",
    icon: AlertTriangle,
    label: "Fair",
  },
  poor: {
    color: "text-danger",
    bgColor: "bg-danger/10",
    borderColor: "border-danger",
    barColor: "bg-danger",
    icon: XCircle,
    label: "Poor",
  },
};

/**
 * Maps a numeric score (0-100) to a `ScoreLevel`.
 */
export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * Returns a fully derived `ScoreVariant` for a given score.
 * All visual properties (colors, icon, label) are pre-computed.
 *
 * @example
 * ```ts
 * const v = getScoreVariant(85);
 * v.color   // "text-warning"
 * v.icon    // CheckCircle
 * v.label   // "Good"
 * ```
 */
export function getScoreVariant(score: number): ScoreVariant {
  const level = getScoreLevel(score);
  return { level, ...VARIANTS[level] };
}

// ─── Contact Health Status Styles ────────────────────────────────────

export type ContactHealth = "hot" | "warm" | "lukewarm" | "cold";

export interface HealthStyle {
  bg: string;       // Background color class e.g. "bg-danger/15"
  text: string;     // Text color class e.g. "text-danger"
  barColor: string; // Progress bar color e.g. "bg-danger"
  label: string;    // Human label e.g. "Hot"
}

const HEALTH_STYLES: Record<ContactHealth, HealthStyle> = {
  hot: { bg: "bg-danger/15", text: "text-danger", barColor: "bg-danger", label: "Hot" },
  warm: { bg: "bg-warning/15", text: "text-warning", barColor: "bg-warning", label: "Warm" },
  lukewarm: { bg: "bg-accent/15", text: "text-accent", barColor: "bg-accent", label: "Lukewarm" },
  cold: { bg: "bg-bg-tertiary", text: "text-text-tertiary", barColor: "bg-text-tertiary", label: "Cold" },
};

/**
 * Returns visual styles for a contact health status.
 * Falls back to "cold" for undefined/null/unknown statuses.
 */
export function getHealthStyle(status?: string | null): HealthStyle {
  if (status && status in HEALTH_STYLES) {
    return HEALTH_STYLES[status as ContactHealth];
  }
  return HEALTH_STYLES.cold;
}
