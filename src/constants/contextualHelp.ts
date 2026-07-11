/**
 * Contextual help registry.
 *
 * Maps `infoKey` strings to help content used by InfoTooltip + SlidePanel.
 * Keys correspond to `data-info` attributes on UI elements throughout the app.
 *
 * Usage:
 * ```tsx
 * <InfoTooltip contentKey="smart-folders" />
 * ```
 *
 * ```tsx
 * <SlidePanel title="Smart Folders" isOpen onClose>
 *   <InfoPanelContent infoKey="smart-folders" />
 * </SlidePanel>
 * ```
 */
export interface ContextualHelpEntry {
  /** Short one-line summary shown in tooltip */
  summary: string;
  /** Full description shown in the slide panel */
  description: string;
  /** Optional list of pro-tips */
  tips?: string[];
  /** Link to settings or help page for deeper dive */
  learnMoreHref?: string;
}

const CONTEXTUAL_HELP_MAP: Record<string, ContextualHelpEntry> = {
  // ─── Mail ────────────────────────────────────────────────────────────
  "smart-folders": {
    summary: "Smart Folders are saved searches that auto-collect matching emails.",
    description:
      "Smart Folders work like saved search filters. Define a search query (e.g. 'has:attachment from:paypal'), and the folder automatically populates with matching emails. Unlike regular labels, Smart Folders don't modify your mailbox — they're just views.",
    tips: [
      "Use quotes for exact phrase matching: \"invoice attached\"",
      "Combine with labels: label:invoices has:attachment",
      "Smart Folders update in real-time as new mail arrives",
    ],
    learnMoreHref: "/help/smart-folders",
  },

  "split-inbox": {
    summary: "Split inbox separates mail into Category tabs (Primary, Updates, etc.).",
    description:
      "When split inbox is enabled, your inbox is divided into category tabs — Primary (personal), Updates (notifications), Promotions (marketing), Social (social networks), and Newsletters. Each tab shows only emails classified under that category by Gmail's filters.",
    tips: [
      "Drag emails between categories to train Gmail's classifier",
      "Unread counts show per-category totals",
      "Switch back to Unified view to see everything in one list",
    ],
    learnMoreHref: "/help/split-inbox",
  },

  "bundle-rules": {
    summary: "Bundles group related emails (e.g. all tracking numbers from a shipment).",
    description:
      "Bundle rules let you group related emails together in your inbox. For example, all order confirmation, shipping notification, and delivery confirmation emails for the same purchase can be collapsed into a single bundle row, keeping your inbox clean.",
    tips: [
      "Create rules based on subject patterns or sender domains",
      "Bundles show a count of contained messages",
      "Click a bundle to expand and see individual messages",
    ],
    learnMoreHref: "/help/bundles",
  },

  // ─── Composer ────────────────────────────────────────────────────────
  "composer-templates": {
    summary: "Templates let you save and reuse email drafts with variable placeholders.",
    description:
      "Email templates store reusable content with variable placeholders like {{recipient.name}} or {{invoice.total}}. When applying a template, you're prompted to fill in variables. Great for common responses, invoices, or follow-ups.",
    tips: [
      "Use {{date}} to auto-insert today's date",
      "Templates support rich text formatting",
      "Organize templates into categories for fast access",
    ],
    learnMoreHref: "/help/templates",
  },

  "composer-compliance": {
    summary: "Compliance panel checks legal requirements before sending.",
    description:
      "The compliance panel scans your email for required legal disclosures, unsubscribe links, and company disclaimers. Configure mandatory footer text, check for GDPR/CAN-SPAM compliance, and ensure all required elements are present before send.",
    tips: [
      "Add a company-wide footer in Settings > Composing",
      "Compliance checks run automatically before send",
      "Review warnings in the Pre-Send Checklist",
    ],
    learnMoreHref: "/settings/composing",
  },

  "composer-schedule": {
    summary: "Schedule emails to send at a specific date and time.",
    description:
      "Schedule Send lets you compose now but deliver later. Choose a preset time (tomorrow morning, next Monday) or pick a custom date. Scheduled emails are stored locally and sent when the time comes — even if you're offline.",
    tips: [
      "Use scheduling for after-hours or timezone-sensitive messages",
      "Scheduled emails appear in your Drafts folder",
      "Cancel or reschedule from the Queue panel",
    ],
    learnMoreHref: "/help/schedule-send",
  },

  // ─── Calendar ────────────────────────────────────────────────────────
  "calendar-sync": {
    summary: "Two-way sync with Google Calendar, CalDAV, and more.",
    description:
      "Calendar sync keeps your events up-to-date across all connected services. Changes made in SME Master are pushed to your calendar provider and vice versa. Sync happens in the background and respects your configured interval.",
    tips: [
      "Initial sync may take a few minutes for large calendars",
      "Conflicts are resolved with 'last write wins' strategy",
      "Check sync status in the calendar toolbar",
    ],
    learnMoreHref: "/settings/accounts",
  },

  // ─── Tasks ───────────────────────────────────────────────────────────
  "task-priority": {
    summary: "Set priority levels to organize your task list by urgency.",
    description:
      "Tasks support four priority levels: Urgent, High, Medium, and Low. Use priorities to sort and filter your task list. High-priority tasks appear first when group-by is enabled, helping you focus on what matters most.",
    tips: [
      "Urgent tasks show a red badge",
      "Use filter bar to show only High+ tasks",
      "Priorities can be changed anytime from the task menu",
    ],
    learnMoreHref: "/help/tasks",
  },

  // ─── Campaigns ───────────────────────────────────────────────────────
  "campaign-analytics": {
    summary: "Track open rates, click rates, and bounce rates per campaign.",
    description:
      "Campaign analytics provide real-time metrics on your email campaigns. Track delivery rates, unique opens, click-through rates (CTR), bounce rates, and spam complaints. Data updates as tracking events arrive.",
    tips: [
      "Compare CTR across subject lines to optimize",
      "High bounce rates? Check your list hygiene",
      "Export analytics as CSV for external reporting",
    ],
    learnMoreHref: "/help/campaigns",
  },

  // ─── Security ────────────────────────────────────────────────────────
  "vault-encryption": {
    summary: "Files in the Vault are encrypted at rest with your device key.",
    description:
      "The Vault stores sensitive files with AES-256-GCM encryption. Files are decrypted only when accessed and re-encrypted when stored. The encryption key is derived from your device's secure enclave and biometric authentication.",
    tips: [
      "Use Vault for contracts, NDAs, and confidential attachments",
      "Biometric unlock required on each app launch",
      "Files are never sent to external servers",
    ],
    learnMoreHref: "/help/vault",
  },

  "pgp-encryption": {
    summary: "PGP encrypts email content end-to-end for supported recipients.",
    description:
      "Pretty Good Privacy (PGP) encrypts email bodies so only the intended recipient can read them. SME Master supports inline PGP and PGP/MIME. Import your private key and your contacts' public keys to get started.",
    tips: [
      "PGP only encrypts the body — subject lines remain visible",
      "Look for the lock icon on encrypted messages",
      "Share your public key via your signature or a keyserver",
    ],
    learnMoreHref: "/settings/pgp",
  },

  // ─── Deliverability ──────────────────────────────────────────────────
  "deliverability-dns": {
    summary: "DNS checks verify SPF, DKIM, and DMARC records for your domain.",
    description:
      "DNS health checks validate that your sending domain has proper email authentication records. SPF specifies which servers can send mail, DKIM adds a cryptographic signature, and DMARC tells receivers how to handle unauthenticated mail.",
    tips: [
      "All three records (SPF, DKIM, DMARC) are recommended",
      "Missing records may cause delivery to spam folders",
      "Warm up new domains gradually to build reputation",
    ],
    learnMoreHref: "/settings/deliverability-dashboard",
  },

  "deliverability-warming": {
    summary: "Warm up a new domain by gradually increasing sending volume.",
    description:
      "Domain warming gradually increases your sending volume over several weeks to build reputation with email providers (Gmail, Outlook, Yahoo). Starting with low volume and slowly ramping up signals to ISPs that you're a legitimate sender.",
    tips: [
      "Start with 5-10 emails per day",
      "Increase by ~20% every 2-3 days",
      "Monitor bounce rates closely during warmup",
    ],
    learnMoreHref: "/settings/deliverability-dashboard",
  },

  // ─── AI & RAG ──────────────────────────────────────────────────────────
  "local-rag": {
    summary: "Local RAG indexes your email for on-device semantic search.",
    description:
      "The Local RAG (Retrieval-Augmented Generation) system indexes your email content into a local vector database (LanceDB), enabling semantic search and context-augmented AI responses — all on your device. Embeddings can be generated via the built-in BGE-small model (candle engine) or through your AI provider's embeddings API (LM Studio, Ollama, OpenAI-compatible). Once indexed, the AI Assistant and Ask Inbox features enrich responses with relevant content from your knowledge base without sending data to the cloud.",
    tips: [
      "Toggle RAG on/off in Settings > AI > Local RAG",
      "Choose between local model or provider embeddings in the RAG settings",
      "Indexing happens automatically, but you can trigger a full re-index anytime",
      "The AI Assistant panel shows RAG-enriched context in compose and reply modes",
      "All data stays on-device when using the local embedding model",
    ],
    learnMoreHref: "/settings/ai",
  },

  // ─── Sync & Offline ───────────────────────────────────────────────────
  "offline-queue": {
    summary: "Actions performed offline are queued and sent when connectivity returns.",
    description:
      "The offline queue stores your actions (send email, delete, archive, mark read) when you're offline and replays them in order when the network reconnects. The queue indicator shows pending operations and sync status.",
    tips: [
      "You can review queued items in Settings > Queue",
      "Queue persists across app restarts",
      "Long-press the queue indicator to clear all pending",
    ],
    learnMoreHref: "/settings/queue",
  },
};

/**
 * Get the help entry for a given info key.
 */
export function getContextualHelp(key: string): ContextualHelpEntry | undefined {
  return CONTEXTUAL_HELP_MAP[key];
}

/**
 * Get all available help keys.
 */
export function getContextualHelpKeys(): string[] {
  return Object.keys(CONTEXTUAL_HELP_MAP);
}


