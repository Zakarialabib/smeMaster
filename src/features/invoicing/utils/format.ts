/**
 * Money + date formatting for the invoicing module.
 *
 * Amounts from the backend are already in MAJOR units (e.g. 1234.5 = 1,234.50 DH).
 * The Rust layer stores i64 minor units; the `db_*` wrappers return major-unit numbers.
 */

export { ACTIVE_COMPANY_ID } from "@shared/constants/company";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  MAD: 'DH',
  EUR: '€',
  USD: '$',
  GBP: '£',
  CAD: 'CA$',
  TND: 'DT',
  AED: 'AED',
  SAR: 'SR',
};

export const COMMON_CURRENCIES = ['MAD', 'EUR', 'USD', 'GBP', 'CAD', 'TND', 'AED', 'SAR'];

export interface FormatMoneyOptions {
  /** Show the negative sign explicitly (default true). */
  sign?: boolean;
  /** Force a currency; falls back to MAD. */
  currency?: string;
}

/**
 * Format a monetary amount with the Moroccan "1,234.00 DH" convention.
 * Symbol is placed after the number (RTL/MA convention) and the value uses
 * a fixed 2-decimal major-unit grouping.
 */
export function formatMoney(amount: number, opts: FormatMoneyOptions = {}): string {
  const currency = opts.currency ?? 'MAD';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const safe = Number.isFinite(amount) ? amount : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const grouped = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const body = `${grouped} ${symbol}`;
  if (negative) return opts.sign === false ? `-${body}` : `(${body})`;
  return body;
}

/** Compact money for stat cards (e.g. "12.4K DH"). */
export function formatMoneyCompact(amount: number, currency = 'MAD'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const safe = Number.isFinite(amount) ? amount : 0;
  const compact = Math.abs(safe) >= 1000
    ? `${(safe / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`
    : safe.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${compact} ${symbol}`;
}

export function formatDate(ts: number, pattern: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return '—';
  if (pattern === 'short') {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  if (pattern === 'long') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toDateInputValue(ts: number | null): string {
  if (!ts) return new Date().toISOString().split('T')[0] ?? '';
  return new Date(ts * 1000).toISOString().split('T')[0] ?? '';
}

export function fromDateInputValue(value: string): number {
  const d = new Date(`${value}T00:00:00`);
  return Math.floor(d.getTime() / 1000);
}

export function daysUntil(ts: number | null): number | null {
  if (!ts) return null;
  const ms = ts * 1000 - Date.now();
  return Math.ceil(ms / 86_400_000);
}
