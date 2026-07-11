/**
 * Human-readable labels for the canonical trigger_event keys used by
 * `WorkflowRule` rows in the `workflow_rules` table.
 *
 * Centralised here so every consumer (workflows, automation, settings) maps
 * the same event keys to the same display strings. Unknown keys fall back to
 * the raw event name (see `RuleSummaryCard`).
 */
export const TRIGGER_LABELS: Record<string, string> = {
  email_received: "Email Received",
  no_reply_after_days: "No Reply After",
  time_based: "Scheduled",
  label_applied: "Label Applied",
  starred: "Starred",
};
