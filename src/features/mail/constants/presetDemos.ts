import type { TemplateDemo } from "./templateDemos";
import { getDemoById } from "./templateDemos";

/**
 * Maps a preset type and preset ID to a demo that demonstrates it.
 */
export interface PresetDemoMapping {
  /** The preset category type */
  presetType: "template" | "signature" | "workflow" | "warmup";
  /** The demo ID that showcases this preset */
  demoId: string;
  /** The specific preset ID being demonstrated */
  presetId: string;
}

/**
 * Maps each demo to one or more presets it demonstrates.
 * This allows UI components to show a "Watch Demo" button alongside any preset.
 */
export const PRESET_DEMO_MAPPINGS: PresetDemoMapping[] = [
  // ── Template Demos ──────────────────────────────────
  // Follow-up presets → demo-followup
  { presetType: "template", demoId: "demo-followup", presetId: "preset-followup" },
  { presetType: "template", demoId: "demo-followup", presetId: "preset-gentle-nudge" },
  { presetType: "template", demoId: "demo-followup", presetId: "preset-post-meeting" },

  // Campaign launch presets → demo-campaign-launch
  { presetType: "template", demoId: "demo-campaign-launch", presetId: "preset-intro" },
  { presetType: "template", demoId: "demo-campaign-launch", presetId: "preset-demo-request" },
  { presetType: "template", demoId: "demo-campaign-launch", presetId: "preset-cold-outreach" },
  { presetType: "template", demoId: "demo-campaign-launch", presetId: "preset-warm-intro" },

  // Newsletter → demo-template-newsletter
  { presetType: "template", demoId: "demo-template-newsletter", presetId: "preset-welcome-onboard" },
  { presetType: "template", demoId: "demo-template-newsletter", presetId: "preset-team-update" },
  { presetType: "template", demoId: "demo-template-newsletter", presetId: "preset-announcement" },

  // Invoice → demo-template-invoice
  { presetType: "template", demoId: "demo-template-invoice", presetId: "preset-proposal" },
  { presetType: "template", demoId: "demo-template-invoice", presetId: "preset-renewal-reminder" },

  // ── Signature Demos ──────────────────────────────────
  { presetType: "signature", demoId: "demo-signature-modern", presetId: "preset-followup" },
  { presetType: "signature", demoId: "demo-signature-modern", presetId: "preset-meeting" },
  { presetType: "signature", demoId: "demo-signature-branded", presetId: "preset-personal-thanks" },
  { presetType: "signature", demoId: "demo-signature-branded", presetId: "preset-team-update" },
  { presetType: "signature", demoId: "demo-signature-minimal", presetId: "preset-personal-thanks" },

  // ── Workflow Demos ──────────────────────────────────
  { presetType: "workflow", demoId: "demo-workflow-auto-reply", presetId: "auto-reply-vacation" },
  { presetType: "workflow", demoId: "demo-workflow-auto-reply", presetId: "ai-auto-draft" },
  { presetType: "workflow", demoId: "demo-workflow-followup", presetId: "followup-3-days" },
  { presetType: "workflow", demoId: "demo-workflow-followup", presetId: "flag-overdue-replies" },
  { presetType: "workflow", demoId: "demo-workflow-labeling", presetId: "flag-invoices" },
  { presetType: "workflow", demoId: "demo-workflow-labeling", presetId: "ai-smart-categorization" },
  { presetType: "workflow", demoId: "demo-workflow-labeling", presetId: "ai-sentiment-routing" },

  // ── Warmup Demos ──────────────────────────────────
  { presetType: "warmup", demoId: "demo-warmup-basics", presetId: "warmup-followup-1" },
  { presetType: "warmup", demoId: "demo-warmup-basics", presetId: "warmup-intro-1" },
  { presetType: "warmup", demoId: "demo-warmup-progress", presetId: "warmup-meeting-1" },
  { presetType: "warmup", demoId: "demo-warmup-progress", presetId: "warmup-checkin-1" },
  { presetType: "warmup", demoId: "demo-warmup-progress", presetId: "warmup-sharing-1" },
];

/**
 * Returns all demo entries that match a given preset type (e.g. "template", "workflow").
 */
export function getDemosForPresetType(type: string): TemplateDemo[] {
  const demoIds = new Set(
    PRESET_DEMO_MAPPINGS
      .filter((m) => m.presetType === type)
      .map((m) => m.demoId),
  );
  return Array.from(demoIds)
    .map((id) => getDemoById(id))
    .filter((d): d is TemplateDemo => d !== undefined);
}

/**
 * Returns all preset IDs mapped to a specific demo.
 */
export function getPresetsForDemo(demoId: string): PresetDemoMapping[] {
  return PRESET_DEMO_MAPPINGS.filter((m) => m.demoId === demoId);
}

/**
 * Returns all preset IDs for a given preset type that have demo coverage.
 */
export function getDemoCoveredPresetIds(type: string): string[] {
  return PRESET_DEMO_MAPPINGS
    .filter((m) => m.presetType === type)
    .map((m) => m.presetId);
}
