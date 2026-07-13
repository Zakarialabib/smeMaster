import { COMMON_CURRENCIES } from './format';

export interface InvoiceDefaults {
  currency: string;
  taxRate: number;
  notes: string;
  terms: string;
}

const KEY = 'smemaster-invoice-defaults';

const FALLBACK: InvoiceDefaults = {
  currency: 'MAD',
  taxRate: 20,
  notes: '',
  terms: 'Payment due within 30 days. Late payments may incur a 1.5% monthly penalty.',
};

export function getInvoiceDefaults(): InvoiceDefaults {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return FALLBACK;
    return { ...FALLBACK, ...JSON.parse(raw) };
  } catch {
    return FALLBACK;
  }
}

export function saveInvoiceDefaults(d: InvoiceDefaults): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore quota errors */
  }
}

export { COMMON_CURRENCIES };
