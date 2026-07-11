/**
 * Normalize an email address for case-insensitive comparison.
 * Email addresses are case-insensitive per RFC 5321.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
