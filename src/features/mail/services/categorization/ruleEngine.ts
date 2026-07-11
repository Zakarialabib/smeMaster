import type { ThreadCategory } from "@features/mail/db/threadCategories";

export interface CategorizationInput {
  labelIds: string[];
  fromAddress: string | null;
  listUnsubscribe: string | null;
}

const SOCIAL_DOMAINS = new Set([
  "facebookmail.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "instagram.com",
  "pinterest.com",
  "tiktok.com",
  "reddit.com",
  "snapchat.com",
  "tumblr.com",
  "nextdoor.com",
  "meetup.com",
  "discord.com",
  "mastodon.social",
]);

const NEWSLETTER_DOMAINS = new Set([
  "substack.com",
  "mailchimp.com",
  "convertkit.com",
  "beehiiv.com",
  "buttondown.email",
  "revue.email",
  "ghost.io",
  "tinyletter.com",
  "sendinblue.com",
  "mailerlite.com",
  "campaignmonitor.com",
  "constantcontact.com",
  "getresponse.com",
  "aweber.com",
]);

const PROMO_PREFIXES = new Set([
  "marketing",
  "promo",
  "promotions",
  "deals",
  "offers",
  "sales",
  "shop",
  "store",
  "newsletter",
  "info",
  "hello",
]);

const UPDATE_PREFIXES = new Set([
  "noreply",
  "no-reply",
  "notifications",
  "notification",
  "notify",
  "alerts",
  "alert",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "support",
  "billing",
  "account",
  "security",
  "verify",
  "confirm",
]);

function getDomain(email: string): string | null {
  const atIdx = email.lastIndexOf("@");
  if (atIdx === -1) return null;
  return email.slice(atIdx + 1).toLowerCase();
}

function getLocalPart(email: string): string | null {
  const atIdx = email.lastIndexOf("@");
  if (atIdx === -1) return null;
  return email.slice(0, atIdx).toLowerCase();
}

/**
 * Categorize a thread using deterministic rules. No I/O, fully testable.
 *
 * Priority layers:
 * 1. Gmail CATEGORY_* labels
 * 2. Domain heuristics (social domains, newsletter platforms, promo prefixes)
 * 3. List-Unsubscribe header presence
 * 4. Default â†’ Primary
 */
export function categorizeByRules(input: CategorizationInput): ThreadCategory {
  // Layer 1: Gmail category labels (highest priority â€” Google's own ML)
  for (const label of input.labelIds) {
    switch (label) {
      case "CATEGORY_PROMOTIONS":
        return "Promotions";
      case "CATEGORY_SOCIAL":
        return "Social";
      case "CATEGORY_UPDATES":
        return "Updates";
      case "CATEGORY_FORUMS":
        // Forums map to Primary (closest match)
        return "Primary";
      case "CATEGORY_PERSONAL":
        return "Primary";
    }
  }

  // Layer 2: Domain & address heuristics
  if (input.fromAddress) {
    const domain = getDomain(input.fromAddress);
    const localPart = getLocalPart(input.fromAddress);

    if (domain) {
      // Social networks
      if (SOCIAL_DOMAINS.has(domain)) return "Social";

      // Newsletter platforms
      if (NEWSLETTER_DOMAINS.has(domain)) return "Newsletters";
    }

    if (localPart) {
      // Promotional prefixes
      if (PROMO_PREFIXES.has(localPart)) return "Promotions";

      // Update/notification prefixes
      if (UPDATE_PREFIXES.has(localPart)) return "Updates";
    }
  }

  // Layer 3: List-Unsubscribe header
  if (input.listUnsubscribe) {
    // If from a newsletter-ish domain, classify as newsletter
    if (input.fromAddress) {
      const domain = getDomain(input.fromAddress);
      if (domain && NEWSLETTER_DOMAINS.has(domain)) return "Newsletters";
    }
    // Generic unsubscribable mail â†’ Promotions
    return "Promotions";
  }

  // Layer 4: Default
  return "Primary";
}

