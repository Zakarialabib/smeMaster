import { useEffect, useState } from 'react';
import { X, Save, Loader2, Users } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../../stores/invoicingStore';
import { ACTIVE_COMPANY_ID } from '../../utils/format';
import { useTranslation } from 'react-i18next';
import type { Client } from '../../types';

type ClientRole = Client['contact_type'];

interface ClientFormState {
  name: string;
  email: string;
  phone: string;
  tax_id: string;
  address: string;
  city: string;
  country: string;
  role: ClientRole;
  credit_limit: string;
  payment_terms: string;
  notes: string;
}

const EMPTY: ClientFormState = {
  name: '',
  email: '',
  phone: '',
  tax_id: '',
  address: '',
  city: '',
  country: '',
  role: 'client',
  credit_limit: '',
  payment_terms: '',
  notes: '',
};

const ROLES: { value: ClientRole; label: string }[] = [
  { value: 'client', label: 'Client' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'other', label: 'Other' },
];

export default function ClientForm({
  open,
  onClose,
  client,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
}) {
  const { t } = useTranslation();
  const createClient = useInvoicingStore((s) => s.createClient);
  const updateClient = useInvoicingStore((s) => s.updateClient);

  const [form, setForm] = useState<ClientFormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [numericError, setNumericError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm({
        name: client.display_name ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        tax_id: client.tax_id ?? '',
        address: client.address ?? '',
        city: client.city ?? '',
        country: client.country ?? '',
        role: client.contact_type,
        credit_limit: client.credit_limit != null ? String(client.credit_limit) : '',
        payment_terms: client.payment_terms != null ? String(client.payment_terms) : '',
        notes: client.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setSaving(false);
  }, [open, client]);

  if (!open) return null;

  const set = (k: keyof ClientFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.name.trim().length > 0;

  const save = async () => {
    if (!canSave || saving) return;
    // Validate email format (empty allowed).
    const eTrim = form.email.trim();
    if (eTrim && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eTrim)) {
      setEmailError('validation.email');
      return;
    }
    setEmailError(null);
    // Validate numeric fields.
    const cl = form.credit_limit.trim();
    const pt = form.payment_terms.trim();
    if ((cl !== '' && Number.isNaN(Number(cl))) || (pt !== '' && Number.isNaN(Number(pt)))) {
      setNumericError('validation.numeric');
      return;
    }
    setNumericError(null);
    setSaving(true);
    try {
      const fields: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim(),
        taxId: form.tax_id.trim() || null,
        role: form.role,
        creditLimit: form.credit_limit.trim() === '' ? undefined : Number(form.credit_limit),
        paymentTerms: form.payment_terms.trim() === '' ? undefined : Number(form.payment_terms),
        notes: form.notes.trim() || null,
      };
      if (client) {
        await updateClient(client.id, fields);
      } else {
        const payload: Parameters<typeof createClient>[0] = {
          companyId: ACTIVE_COMPANY_ID,
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          country: form.country.trim(),
          taxId: form.tax_id.trim() || null,
          role: form.role,
          creditLimit: form.credit_limit.trim() === '' ? undefined : Number(form.credit_limit),
          paymentTerms: form.payment_terms.trim() === '' ? undefined : Number(form.payment_terms),
          notes: form.notes.trim() || null,
        };
        await createClient(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-primary rounded-2xl border border-border-primary w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 backdrop-blur-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                {client ? 'Edit Client' : 'New Client'}
              </h3>
              <p className="text-xs text-text-tertiary">
                {client ? 'Update the contact details below.' : 'Add a customer or supplier to your directory.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mt-6">
          <Field label="Name" required className="sm:col-span-2">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Acme SARL"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                set('email', e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="contact@acme.ma"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
            {emailError && (
              <p className="text-xs text-error mt-1" role="alert">
                {t(emailError)}
              </p>
            )}
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+212 6 00 00 00 00"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Tax ID (IF)">
            <input
              value={form.tax_id}
              onChange={(e) => set('tax_id', e.target.value)}
              placeholder="12345678"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary font-mono text-sm placeholder:text-text-tertiary"
            />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(v) => set('role', v)} options={ROLES} />
          </Field>

          <Field label="Address" className="sm:col-span-2">
            <input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="123 Rue Mohammed V"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Casablanca"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>
          <Field label="Country">
            <input
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="Morocco"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <Field label="Credit Limit">
            <input
              type="number"
              min={0}
              value={form.credit_limit}
              onChange={(e) => set('credit_limit', e.target.value)}
              placeholder="0.00"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
          </Field>
          <Field label="Payment Terms (days)">
            <input
              type="number"
              min={0}
              value={form.payment_terms}
              onChange={(e) => {
                set('payment_terms', e.target.value);
                if (numericError) setNumericError(null);
              }}
              placeholder="30"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary"
            />
            {numericError && (
              <p className="text-xs text-error mt-1" role="alert">
                {t(numericError)}
              </p>
            )}
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Any internal notes about this client…"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-text-primary placeholder:text-text-tertiary resize-none"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            onClick={save}
            disabled={!canSave || saving}
          >
            {client ? 'Save Changes' : 'Create Client'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none glass-input rounded-xl pl-3.5 pr-9 py-2.5 text-text-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-primary text-text-primary">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
