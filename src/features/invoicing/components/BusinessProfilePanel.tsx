import { useEffect, useState } from 'react';
import { Building2, Save, Loader2, Check, BadgeCheck } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../stores/invoicingStore';
import { ACTIVE_COMPANY_ID } from '../utils/format';

interface ProfileForm {
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  website: string;
  address_line1: string;
  city: string;
  country: string;
  ice: string;
  tax_id: string;
  rc: string;
  cnss: string;
}

export default function BusinessProfilePanel() {
  const company = useInvoicingStore((s) => s.company);
  const fetchCompany = useInvoicingStore((s) => s.fetchCompany);
  const updateCompany = useInvoicingStore((s) => s.updateCompany);

  const [form, setForm] = useState<ProfileForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchCompany(ACTIVE_COMPANY_ID);
  }, [fetchCompany]);

  useEffect(() => {
    if (company && !form) {
      setForm({
        name: company.name ?? '',
        legal_name: company.legal_name ?? '',
        email: company.email ?? '',
        phone: company.phone ?? '',
        website: company.website ?? '',
        address_line1: company.address_line1 ?? '',
        city: company.city ?? '',
        country: company.country ?? 'Morocco',
        ice: company.ice ?? '',
        tax_id: company.tax_id ?? '',
        rc: company.rc ?? '',
        cnss: company.cnss ?? '',
      });
    }
  }, [company, form]);

  if (!form) {
    return (
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const set = (k: keyof ProfileForm, v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    setSaved(false);
  };

  const save = async () => {
    if (!company) return;
    setSaving(true);
    try {
      await updateCompany(company.id, { ...form });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Business Profile</h2>
            <p className="text-xs text-text-tertiary">Legal identity printed on every DGI-compliant document</p>
          </div>
        </div>
        <Button icon={saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />} onClick={save} disabled={saving}>
          {saved ? 'Saved' : 'Save Profile'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Identity */}
        <section className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-5 space-y-4">
          <h3 className="font-bold text-text-primary text-sm">Company Identity</h3>
          <Input label="Display Name" value={form.name} onChange={(v) => set('name', v)} />
          <Input label="Legal / Registered Name" value={form.legal_name} onChange={(v) => set('legal_name', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" value={form.email} onChange={(v) => set('email', v)} />
            <Input label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
          </div>
          <Input label="Website" value={form.website} onChange={(v) => set('website', v)} />
          <Input label="Address" value={form.address_line1} onChange={(v) => set('address_line1', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={(v) => set('city', v)} />
            <Input label="Country" value={form.country} onChange={(v) => set('country', v)} />
          </div>
        </section>

        {/* Morocco legal identifiers */}
        <section className="rounded-2xl border border-accent/20 bg-accent/[0.04] backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-accent">
            <BadgeCheck size={16} />
            <h3 className="font-bold text-sm">Morocco Legal Identifiers</h3>
          </div>
          <p className="text-xs text-text-tertiary -mt-2">These appear on invoices, delivery bills, and the PEPPOL/UBL XML.</p>
          <Input label="ICE" hint="Identifiant Commun de l'Entreprise" value={form.ice} onChange={(v) => set('ice', v)} mono />
          <Input label="IF (Tax ID)" hint="Identifiant Fiscal" value={form.tax_id} onChange={(v) => set('tax_id', v)} mono />
          <Input label="RC" hint="Registre de Commerce" value={form.rc} onChange={(v) => set('rc', v)} mono />
          <Input label="CNSS" hint="Caisse Nationale de Sécurité Sociale" value={form.cnss} onChange={(v) => set('cnss', v)} mono />
        </section>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, hint, mono }: { label: string; value: string; onChange: (v: string) => void; hint?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{label}</span>
      {hint && <span className="text-[10px] text-text-tertiary/70 ml-2 normal-case font-normal">{hint}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary ${mono ? 'font-mono text-sm' : ''}`}
      />
    </label>
  );
}
