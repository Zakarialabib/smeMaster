import { useEffect, useState } from 'react';
import { X, SlidersHorizontal, Save } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { getInvoiceDefaults, saveInvoiceDefaults, COMMON_CURRENCIES } from '../utils/invoiceDefaults';
import { TAX_RATES } from '../utils/status';
import BusinessProfilePanel from './BusinessProfilePanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: Props) {
  const [defaults, setDefaults] = useState(getInvoiceDefaults());

  useEffect(() => {
    if (open) setDefaults(getInvoiceDefaults());
  }, [open]);

  const patch = (k: keyof typeof defaults, v: string | number) =>
    setDefaults((d) => ({ ...d, [k]: v }));

  const saveDefaults = () => saveInvoiceDefaults(defaults);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 z-[66] h-full w-full max-w-xl bg-bg-primary/95 backdrop-blur-2xl border-l border-border-primary shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <h2 className="font-bold text-text-primary flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-accent" /> Invoicing Settings
          </h2>
          <Button variant="ghost" size="sm" icon={<X size={18} />} onClick={onClose} />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Invoice defaults */}
          <section className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-text-primary text-sm">Document Defaults</h3>
                <p className="text-xs text-text-tertiary">Applied to new documents. Saved on this device.</p>
              </div>
              <Button size="sm" icon={<Save size={14} />} onClick={saveDefaults}>Save as Default</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Default Currency</span>
                <select value={defaults.currency} onChange={(e) => patch('currency', e.target.value)} className="mt-1.5 w-full glass-input rounded-xl px-3 py-2.5 text-text-primary">
                  {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Default Tax</span>
                <select value={defaults.taxRate} onChange={(e) => patch('taxRate', Number(e.target.value))} className="mt-1.5 w-full glass-input rounded-xl px-3 py-2.5 text-text-primary">
                  {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Default Notes</span>
              <input value={defaults.notes} onChange={(e) => patch('notes', e.target.value)} placeholder="Printed at the bottom of each document" className="mt-1.5 w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Default Terms</span>
              <textarea value={defaults.terms} onChange={(e) => patch('terms', e.target.value)} rows={2} className="mt-1.5 w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary resize-none placeholder:text-text-tertiary" />
            </label>
          </section>

          {/* Business profile */}
          <section>
            <h3 className="font-bold text-text-primary text-sm mb-3">Business Profile</h3>
            <BusinessProfilePanel />
          </section>
        </div>
      </aside>
    </>
  );
}
