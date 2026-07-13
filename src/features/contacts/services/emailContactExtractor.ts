/**
 * emailContactExtractor — pull structured contact/client fields out of an email.
 *
 * Used by the mail ContactSidebar "Extract details from email" action so a user
 * can turn a correspondent into a rich contact (phone, company, tax id, address)
 * without manual copy/paste. The source of truth is still the `contacts` table;
 * this only produces candidate values the caller may apply via `updateContact`.
 *
 * All patterns are deliberately permissive and locale-aware (MA / FR / EN):
 *  - phone: +212 / 06 / 07 / 05 prefixes, with optional spaces/dashes
 *  - tax id: Moroccan ICE (15 alnum) or IF (8-10 alnum)
 *  - address: lines containing street words (rue, av., bd, n°, etc.)
 *  - company: "Société", "SARL", "SAS", "company" near a capitalised phrase
 */

export interface ExtractedContact {
  phone: string | null;
  taxId: string | null;
  address: string | null;
  company: string | null;
}

// Strip HTML to plain text (lightweight; the sidebar passes already-stripped body when possible).
function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const PHONE_RE = /(?:\+?\s?212|\b0(?:5|6|7)\s?)\s?(?:\d[\s.\-]?){8,9}/g;
const ICE_RE = /\bICE\s*[:\-]?\s*([0-9A-Z]{15})\b/i;
const IF_RE = /\b(?:IF|ICE|Tax)\s*[:\-]?\s*([A-Z0-9]{7,10})\b/i;
const STREET_RE =
  /(?:rue|av\.?|avenue|boulevard|bd|blvd|lot|quartier|hay|résidence|imm|immeuble|étage|etg|n°|numéro|address|adresse)\b[^\n,;]{0,60}/i;
const COMPANY_RE =
  /\b([A-ZÀ-Ö][\wÀ-Ö&=.'\-]*(?:\s+[A-ZÀ-Ö][\wÀ-Ö.&'\-]*){0,3}\s*(?:SARL|SA|SAS|SASU|EURL|LLC|Ltd|Inc|GmbH|SPRL|société|company|ente(?:rprise)?|group)\b)/i;

export function extractContactFromEmail(
  body: string,
  opts: { existingPhone?: string | null } = {},
): ExtractedContact {
  const text = stripHtml(body || "");
  const result: ExtractedContact = {
    phone: null,
    taxId: null,
    address: null,
    company: null,
  };

  // Phone — keep the first plausible match; skip if we already have one.
  if (!opts.existingPhone) {
    const phoneMatch = text.match(PHONE_RE);
    if (phoneMatch) {
      result.phone = phoneMatch[0]!.replace(/\s+/g, " ").trim();
    }
  }

  // Tax id — ICE preferred, else IF/Tax.
  const ice = text.match(ICE_RE);
  const ifMatch = text.match(IF_RE);
  result.taxId = (ice?.[1] ?? ifMatch?.[1] ?? null)?.trim().toUpperCase() ?? null;

  // Address — first line that looks like a street.
  const street = text.match(STREET_RE);
  if (street) {
    result.address = street[0]!.replace(/\s+/g, " ").trim();
  }

  // Company — first capitalised entity ending in a company suffix.
  const company = text.match(COMPANY_RE);
  if (company) {
    result.company = company[1]!.replace(/\s+/g, " ").trim();
  }

  return result;
}

/**
 * Apply only the non-null extracted fields that the contact doesn't already
 * have. Returns the subset that was applied (useful for a toast summary).
 */
export function diffExtracted(
  extracted: ExtractedContact,
  current: { phone?: string | null; tax_id?: string | null; address?: string | null; company?: string | null },
): Partial<ExtractedContact> {
  const applied: Partial<ExtractedContact> = {};
  if (extracted.phone && !current.phone) applied.phone = extracted.phone;
  if (extracted.taxId && !current.tax_id) applied.taxId = extracted.taxId;
  if (extracted.address && !current.address) applied.address = extracted.address;
  if (extracted.company && !current.company) applied.company = extracted.company;
  return applied;
}
