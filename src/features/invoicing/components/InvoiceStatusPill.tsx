import { INVOICE_STATUS_META, type InvoiceStatus } from '../utils/status';

interface Props {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
}

export default function InvoiceStatusPill({ status, size = 'md' }: Props) {
  const meta = INVOICE_STATUS_META[status];
  const Icon = meta.icon;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ${meta.pill} ${pad}`}
    >
      <Icon size={size === 'sm' ? 11 : 12} />
      {meta.label}
    </span>
  );
}
