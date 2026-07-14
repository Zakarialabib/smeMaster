import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import {
  useCompanyStore,
  getActiveCompany,
  companyInitials,
} from './companyStore';
import { DemoBadge } from './erpShared';
import { notify } from '@shared/services/notifications/toastHelper';

export default function CompanySwitcher() {
  const companies = useCompanyStore((s) => s.companies);
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const setActiveCompany = useCompanyStore((s) => s.setActiveCompany);
  const active = getActiveCompany(companies, activeCompanyId);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Handle loading / empty state
  if (!active && companies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-tertiary">
        No companies loaded
      </div>
    );
  }

  // Fallback for display — use the first company if somehow active is null but companies exist
  const displayCompany = active ?? companies[0]!;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl hover:bg-bg-hover/60 transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">
          {companyInitials(displayCompany.name)}
        </span>
        <span className="text-left min-w-0 hidden sm:block">
          <span className="block text-sm font-semibold text-text-primary truncate max-w-[160px]">
            {displayCompany.name}
          </span>
          <span className="block text-[10px] text-text-tertiary uppercase tracking-wide">
            ICE {displayCompany.ice}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-border-primary bg-bg-elevated backdrop-blur-2xl shadow-xl p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
              Switch company
            </span>
            <DemoBadge />
          </div>

          <div className="space-y-1 mt-1">
            {companies.map((c) => {
              const isActive = c.id === activeCompanyId;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${
                    isActive ? 'bg-accent/10' : 'hover:bg-bg-hover/60'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isActive
                        ? 'bg-accent text-white'
                        : 'bg-bg-tertiary text-text-secondary'
                    }`}
                  >
                    {companyInitials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                    <p className="text-[11px] text-text-tertiary truncate">
                      ICE {c.ice}
                    </p>
                  </div>
                  {isActive ? (
                    <Check size={16} className="text-accent shrink-0" />
                  ) : (
                    <Button
                      size="xs"
                      variant="glass"
                      onClick={() => {
                        setActiveCompany(c.id);
                        setOpen(false);
                        notify('Company switched', `Now viewing ${c.name}`);
                      }}
                    >
                      Switch
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 px-2.5 py-2 rounded-xl bg-bg-tertiary/50 flex items-center gap-2 text-[11px] text-text-tertiary">
            <CheckCircle2 size={13} className="text-text-tertiary shrink-0" />
            Demo only — real multi-company switching ships with the Platform tier.
          </div>
        </div>
      )}
    </div>
  );
}
