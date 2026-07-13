import {
  FileEdit, Send, CheckCircle2, CircleDashed, Ban,
  type LucideIcon,
} from 'lucide-react';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the pill (bg + text). */
  pill: string;
  /** Tailwind classes for the dot. */
  dot: string;
  icon: LucideIcon;
  description: string;
  /** Allowed forward transitions (workflow draft → sent → paid/partial). */
  next: InvoiceStatus[];
}

export const INVOICE_STATUS_META: Record<InvoiceStatus, StatusMeta> = {
  draft: {
    label: 'Draft',
    pill: 'bg-bg-tertiary text-text-secondary',
    dot: 'bg-text-tertiary',
    icon: FileEdit,
    description: 'Not yet sent to the client',
    next: ['sent', 'cancelled'],
  },
  sent: {
    label: 'Sent',
    pill: 'bg-accent/10 text-accent',
    dot: 'bg-accent',
    icon: Send,
    description: 'Awaiting payment',
    next: ['paid', 'partial', 'cancelled'],
  },
  partial: {
    label: 'Partial',
    pill: 'bg-warning/10 text-warning',
    dot: 'bg-warning',
    icon: CircleDashed,
    description: 'Partially paid',
    next: ['paid', 'cancelled'],
  },
  paid: {
    label: 'Paid',
    pill: 'bg-success/10 text-success',
    dot: 'bg-success',
    icon: CheckCircle2,
    description: 'Fully settled',
    next: [],
  },
  cancelled: {
    label: 'Cancelled',
    pill: 'bg-danger/10 text-danger',
    dot: 'bg-danger',
    icon: Ban,
    description: 'Voided / cancelled',
    next: [],
  },
};

/** Ordered flow used by stepper UI. */
export const INVOICE_STATUS_FLOW: InvoiceStatus[] = ['draft', 'sent', 'partial', 'paid'];

export const DOCUMENT_TYPE_META: Record<
  'invoice' | 'delivery_bill' | 'shipping_print',
  { label: string; abbr: string; description: string }
> = {
  invoice: { label: 'Invoice', abbr: 'INV', description: 'Commercial billing document' },
  delivery_bill: { label: 'Delivery Bill', abbr: 'BL', description: 'Bon de Livraison — proof of delivery' },
  shipping_print: { label: 'Shipping Print', abbr: 'EXP', description: 'Packaging & shipping slip' },
};

export const TAX_RATES = [20, 14, 10, 7, 0];

export function documentNumberPrefix(type: 'invoice' | 'delivery_bill' | 'shipping_print'): string {
  const year = new Date().getFullYear();
  switch (type) {
    case 'delivery_bill':
      return `BL-${year}-`;
    case 'shipping_print':
      return `EXP-${year}-`;
    default:
      return `INV-${year}-`;
  }
}
