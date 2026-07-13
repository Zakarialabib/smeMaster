import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Plus, Minus, X, Check, RefreshCw,
  Landmark, Coins, TrendingUp, TrendingDown, ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { formatMoney, formatDate } from '@features/invoicing/utils/format';
import { useCompanyStore, getActiveCompany } from './companyStore';
import { SectionCard, LiveBadge } from './erpShared';
import type { ErpAccount, JournalEntry, Wallet as WalletType } from '@shared/services/db/schema';
import {
  getWallet, creditWallet, debitWallet,
  listChartOfAccounts, listJournalEntries,
} from '@shared/services/db/invoke/invoicing';
import { notify } from '@shared/services/notifications/toastHelper';

const CASH_CODE = '1000';
const PRESETS = [100, 500, 1000, 5000];

interface CashMove {
  id: string;
  date: number;
  description: string;
  reference: string | null;
  amount: number; // signed: + in (debit to cash), - out (credit to cash)
  currency: string;
}

export default function WalletView() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const company = getActiveCompany(companies, activeCompanyId);

  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [moves, setMoves] = useState<CashMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<null | 'topup' | 'withdraw'>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [w, coa, je] = await Promise.all([
        getWallet(activeCompanyId),
        listChartOfAccounts(activeCompanyId),
        listJournalEntries(activeCompanyId),
      ]);
      setWallet(w);

      // Derive the wallet's transaction history from the Cash ledger account.
      const cash = coa.find((a: ErpAccount) => a.code === CASH_CODE);
      const feed: CashMove[] = [];
      if (cash) {
        for (const e of je as JournalEntry[]) {
          if (e.account_id !== cash.id) continue;
          if (e.debit > 0) feed.push({ id: e.id, date: e.entry_date, description: e.description ?? 'Cash in', reference: e.reference, amount: e.debit, currency: e.currency });
          else if (e.credit > 0) feed.push({ id: e.id, date: e.entry_date, description: e.description ?? 'Cash out', reference: e.reference, amount: -e.credit, currency: e.currency });
        }
      }
      feed.sort((a, b) => b.date - a.date);
      setMoves(feed);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  // Totals across the cash feed (matches ledger convention: minor units).
  const { totalIn, totalOut } = useMemo(() => {
    let tin = 0;
    let tout = 0;
    for (const m of moves) {
      if (m.amount > 0) tin += m.amount;
      else tout += -m.amount;
    }
    return { totalIn: tin, totalOut: tout };
  }, [moves]);

  const balance = wallet?.balance ?? 0;
  const currency = wallet?.currency ?? 'MAD';
  const overdraft = balance < 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-text-primary">Company Wallet</h2>
          <LiveBadge />
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={15} />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-danger/5 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      )}

      {/* ── Hero balance card ── */}
      <div
        className={`relative overflow-hidden rounded-3xl border border-border-primary p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${
          overdraft ? 'bg-gradient-to-br from-danger/15 via-bg-secondary/70 to-bg-secondary/40' : 'bg-gradient-to-br from-accent/20 via-bg-secondary/70 to-bg-secondary/30'
        }`}
      >
        {/* ambient glow */}
        <div className={`pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl opacity-50 ${
          overdraft ? 'bg-danger/30' : 'bg-accent/30'
        }`} />
        <div className="relative flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                overdraft ? 'bg-danger' : 'bg-accent'
              }`}>
                <Wallet size={20} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Cash on hand
                </p>
                <p className="text-sm font-medium text-text-secondary">{company.name}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-bg-primary/60 text-text-secondary border border-border-primary backdrop-blur">
              <Landmark size={13} /> {currency}
            </span>
          </div>

          <div>
            <p className={`text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums leading-none ${
              overdraft ? 'text-danger' : 'text-text-primary'
            }`}>
              {formatMoney(balance, { currency })}
            </p>
            <p className="mt-2 text-xs text-text-tertiary">
              {overdraft
                ? 'Overdraft — cash has gone below zero.'
                : 'Every sale, bill payment and manual move is routed through here and mirrored to the ledger.'}
            </p>
          </div>

          {/* primary actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              size="md"
              icon={<ArrowDownLeft size={17} />}
              onClick={() => setAction('topup')}
              className="w-full"
            >
              Top up
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<ArrowUpRight size={17} />}
              onClick={() => setAction('withdraw')}
              className="w-full"
            >
              Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* ── In / Out summary ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Cash in</p>
            <p className="text-lg font-bold text-text-primary tabular-nums truncate">{formatMoney(totalIn, { currency })}</p>
          </div>
        </div>
        <div className="bg-bg-primary/70 backdrop-blur-xl border border-border-primary rounded-2xl p-4 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <TrendingDown size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Cash out</p>
            <p className="text-lg font-bold text-text-primary tabular-nums truncate">{formatMoney(totalOut, { currency })}</p>
          </div>
        </div>
      </div>

      {/* ── Transaction feed ── */}
      <SectionCard className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-primary flex items-center gap-2 text-text-secondary text-sm font-medium">
          <ArrowRightLeft size={16} className="text-accent" /> Wallet movements
          <span className="ml-auto text-[11px] font-normal text-text-tertiary">{moves.length} entries</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-text-tertiary">Loading movements…</div>
        ) : !error && moves.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-tertiary">
            No movements yet. Mark an invoice <span className="font-medium">paid</span>, or use Top up / Withdraw above.
          </div>
        ) : (
          <>
            {/* Desktop list */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-tertiary text-[11px] uppercase tracking-wide border-b border-border-primary">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Movement</th>
                    <th className="px-5 py-3 font-semibold">Reference</th>
                    <th className="px-5 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/60">
                  {moves.map((m) => (
                    <tr key={m.id} className="hover:bg-bg-hover/40 transition-colors">
                      <td className="px-5 py-3 text-text-tertiary whitespace-nowrap">{formatDate(m.date, 'short')}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            m.amount > 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                          }`}>
                            {m.amount > 0 ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                          </span>
                          <span className="text-text-primary">{m.description}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-text-tertiary">{m.reference ?? '—'}</td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${
                        m.amount > 0 ? 'text-success' : 'text-warning'
                      }`}>
                        {m.amount > 0 ? '+' : '−'}{formatMoney(Math.abs(m.amount), { currency, sign: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border-primary/60">
              {moves.map((m) => (
                <div key={m.id} className="px-4 py-3.5 flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    m.amount > 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>
                    {m.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate">{m.description}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {formatDate(m.date, 'short')}{m.reference ? ` · ${m.reference}` : ''}
                    </p>
                  </div>
                  <span className={`font-semibold tabular-nums shrink-0 ${
                    m.amount > 0 ? 'text-success' : 'text-warning'
                  }`}>
                    {m.amount > 0 ? '+' : '−'}{formatMoney(Math.abs(m.amount), { currency, sign: false })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {action && (
        <WalletActionModal
          mode={action}
          companyName={company.name}
          currency={currency}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function WalletActionModal({
  mode,
  companyName,
  currency,
  onClose,
  onDone,
}: {
  mode: 'topup' | 'withdraw';
  companyName: string;
  currency: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const isTopup = mode === 'topup';
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = Math.round(Number(amount) * 100); // major -> minor units
  const valid = parsed > 0 && Number.isFinite(parsed);

  async function submit() {
    if (!valid) return;
    setSaving(true);
    try {
      if (isTopup) {
        await creditWallet(activeCompanyIdSafe(), parsed, null, description.trim() || null);
      } else {
        await debitWallet(activeCompanyIdSafe(), parsed, null, description.trim() || null);
      }
      await onDone();
    } catch (e: any) {
      setSaving(false);
      notify('Wallet', e?.message ?? 'Transaction failed');
    }
  }

  // Resolve the active company id without prop-drilling through useCompanyStore.
  function activeCompanyIdSafe(): string {
    const companies = useCompanyStore.getState().companies;
    const id = useCompanyStore.getState().activeCompanyId;
    return getActiveCompany(companies, id).id;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-t-3xl sm:rounded-2xl border border-border-primary w-full sm:max-w-md p-6 backdrop-blur-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${
              isTopup ? 'bg-success' : 'bg-accent'
            }`}>
              {isTopup ? <Plus size={20} /> : <Minus size={20} />}
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-text-primary">{isTopup ? 'Top up wallet' : 'Withdraw from wallet'}</h3>
              <p className="text-[11px] text-text-tertiary truncate">{companyName}</p>
            </div>
          </div>
          <Button variant="ghost" size="xs" iconOnly icon={<X size={16} />} onClick={onClose} />
        </div>

        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Amount ({currency})
          </span>
          <div className="relative mt-1.5">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              autoFocus
              value={amount}
              placeholder="0.00"
              onChange={(e) => setAmount(e.target.value)}
              className="glass-input rounded-xl pl-3.5 pr-12 py-3 text-2xl font-bold text-text-primary w-full tabular-nums"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-tertiary">
              {currency}
            </span>
          </div>
        </label>

        {/* preset chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(String(p))}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-tertiary text-text-secondary hover:bg-accent/10 hover:text-accent transition-colors"
            >
              {formatMoney(p, { currency })}
            </button>
          ))}
        </div>

        <label className="block mt-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Note (optional)
          </span>
          <input
            type="text"
            value={description}
            placeholder={isTopup ? 'e.g. Owner deposit' : 'e.g. Office supplies'}
            onChange={(e) => setDescription(e.target.value)}
            className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full mt-1.5"
          />
        </label>

        <p className="text-[11px] text-text-tertiary mt-3 flex items-start gap-1.5">
          <Coins size={13} className="mt-0.5 shrink-0" />
          {isTopup
            ? 'Books a Dr Cash / Cr Equity entry so the ledger stays balanced.'
            : 'Books a Dr Equity / Cr Cash entry so the ledger stays balanced.'}
        </p>

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant={isTopup ? 'primary' : 'secondary'}
            icon={<Check size={15} />}
            onClick={submit}
            disabled={!valid || saving}
          >
            {saving ? 'Processing…' : isTopup ? 'Top up' : 'Withdraw'}
          </Button>
        </div>
      </div>
    </div>
  );
}
