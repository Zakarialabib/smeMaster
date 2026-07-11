import { useMemo } from 'react';
import { BookOpen, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { formatMoney, formatDate } from '@features/invoicing/utils/format';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { InfoBanner, SectionCard, DemoBadge } from './erpShared';

interface JournalEntry {
  id: string;
  date: number;
  account: string;
  reference: string;
  debit: number;
  credit: number;
}

const DAY = 86_400;
const now = Math.floor(Date.now() / 1000);

const MOCK_ENTRIES: JournalEntry[] = [
  { id: 'j-1', date: now - DAY * 2, account: '5111 · Cash (DH)', reference: 'REC-204', debit: 12400, credit: 0 },
  { id: 'j-2', date: now - DAY * 2, account: '7011 · Sales Revenue', reference: 'REC-204', debit: 0, credit: 12400 },
  { id: 'j-3', date: now - DAY * 5, account: '6111 · Purchases', reference: 'FAC-118', debit: 8600, credit: 0 },
  { id: 'j-4', date: now - DAY * 5, account: '4011 · Suppliers', reference: 'FAC-118', debit: 0, credit: 8600 },
  { id: 'j-5', date: now - DAY * 9, account: '5121 · Bank', reference: 'VIR-77', debit: 3200, credit: 0 },
  { id: 'j-6', date: now - DAY * 9, account: '6411 · Salaries', reference: 'VIR-77', debit: 0, credit: 3200 },
  { id: 'j-7', date: now - DAY * 14, account: '2131 · Equipment', reference: 'FAC-099', debit: 15750, credit: 0 },
  { id: 'j-8', date: now - DAY * 14, account: '4041 · VAT Payable', reference: 'FAC-099', debit: 0, credit: 15750 },
  { id: 'j-9', date: now - DAY * 21, account: '5111 · Cash (DH)', reference: 'REC-198', debit: 5400, credit: 0 },
  { id: 'j-10', date: now - DAY * 21, account: '7011 · Sales Revenue', reference: 'REC-198', debit: 0, credit: 5400 },
];

const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const MOCK_MONTHLY = [
  { debit: 42100, credit: 38900 },
  { debit: 51200, credit: 49800 },
  { debit: 38600, credit: 41200 },
  { debit: 60400, credit: 57900 },
  { debit: 47300, credit: 50100 },
  { debit: 65800, credit: 63200 },
];

export default function JournalView() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const totals = useMemo(() => {
    const debit = MOCK_ENTRIES.reduce((a, e) => a + e.debit, 0);
    const credit = MOCK_ENTRIES.reduce((a, e) => a + e.credit, 0);
    return { debit, credit };
  }, []);

  const maxMonthly = Math.max(...MOCK_MONTHLY.map((m) => Math.max(m.debit, m.credit)));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-text-primary">General Journal</h2>
        <DemoBadge />
      </div>

      <InfoBanner>
        Double-entry postings are shown for preview only. The ledger, chart of accounts, and
        balances will be produced by the Accounting backend (Iteration 5) for{' '}
        <span className="font-medium text-text-primary">{company.name}</span>.
      </InfoBanner>

      {/* Monthly debit vs credit bars */}
      <SectionCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-accent" /> Monthly Debits vs Credits
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Debit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-success" /> Credit
            </span>
          </div>
        </div>

        <div className="flex items-end gap-3 h-44 px-1">
          {MOCK_MONTHLY.map((m, i) => (
            <div key={MONTHS[i]} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center gap-1 h-36">
                <div className="group relative w-1/2 max-w-[14px] rounded-t-md bg-accent/80 hover:bg-accent transition-colors" style={{ height: `${(m.debit / maxMonthly) * 100}%` }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-accent opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                    {formatMoney(m.debit, { currency: 'MAD' })}
                  </span>
                </div>
                <div className="group relative w-1/2 max-w-[14px] rounded-t-md bg-success/70 hover:bg-success transition-colors" style={{ height: `${(m.credit / maxMonthly) * 100}%` }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-success opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                    {formatMoney(m.credit, { currency: 'MAD' })}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-text-tertiary">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Totals + entries table */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Total Debits</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">{formatMoney(totals.debit)}</p>
          </div>
        </div>
        <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <TrendingDown size={18} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Total Credits</p>
            <p className="text-lg font-bold text-text-primary tabular-nums">{formatMoney(totals.credit)}</p>
          </div>
        </div>
      </div>

      <SectionCard className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-primary flex items-center gap-2 text-text-secondary text-sm font-medium">
          <BookOpen size={16} className="text-accent" /> Recent postings
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Account</th>
                <th className="px-5 py-3 font-semibold">Reference</th>
                <th className="px-5 py-3 font-semibold text-right">Debit</th>
                <th className="px-5 py-3 font-semibold text-right">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/60">
              {MOCK_ENTRIES.map((e) => (
                <tr key={e.id} className="hover:bg-bg-hover/40 transition-colors">
                  <td className="px-5 py-3 text-text-tertiary whitespace-nowrap">{formatDate(e.date, 'short')}</td>
                  <td className="px-5 py-3 text-text-primary">{e.account}</td>
                  <td className="px-5 py-3 font-mono text-xs text-text-tertiary">{e.reference}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-text-primary">
                    {e.debit > 0 ? formatMoney(e.debit) : <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-text-secondary">
                    {e.credit > 0 ? formatMoney(e.credit) : <span className="text-text-tertiary">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
