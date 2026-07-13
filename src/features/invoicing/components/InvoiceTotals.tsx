import { formatMoney } from '../utils/format';

interface Props {
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  currency: string;
  paid?: number;
  balance?: number;
  showPaid?: boolean;
}

export default function InvoiceTotals({
  subtotal, taxTotal, discount, total, currency, paid, balance, showPaid,
}: Props) {
  const rows: { label: string; value: number; emphasis?: boolean; muted?: boolean }[] = [
    { label: 'Subtotal', value: subtotal },
    { label: 'Tax', value: taxTotal, muted: true },
  ];
  if (discount > 0) rows.push({ label: 'Discount', value: -discount, muted: true });
  rows.push({ label: 'Total', value: total, emphasis: true });
  if (showPaid) {
    rows.push({ label: 'Paid', value: paid ?? 0, muted: true });
    rows.push({ label: 'Balance Due', value: balance ?? total, emphasis: true });
  }

  return (
    <div className="w-full sm:w-72 ml-auto space-y-2.5">
      {rows.map((r) => (
        <div
          key={r.label}
          className={`flex items-center justify-between ${
            r.emphasis ? 'pt-2.5 mt-1 border-t border-border-primary' : ''
          }`}
        >
          <span
            className={`text-sm ${
              r.emphasis ? 'font-bold text-text-primary' : r.muted ? 'text-text-tertiary' : 'text-text-secondary'
            }`}
          >
            {r.label}
          </span>
          <span
            className={`tabular-nums ${
              r.emphasis ? 'text-lg font-bold text-accent' : 'font-semibold text-text-primary'
            }`}
          >
            {formatMoney(Math.abs(r.value), { currency })}
            {r.value < 0 && r.label !== 'Total' && r.label !== 'Balance Due' ? '' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
