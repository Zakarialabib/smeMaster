import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft, Save, Plus, Trash2, ReceiptText, Truck, Printer, Eye, Send,
  FileText, FileCode, Check, Loader2, CloudUpload, X, Users,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { useInvoicingStore } from '../stores/invoicingStore';
import { ACTIVE_COMPANY_ID, toDateInputValue, fromDateInputValue, COMMON_CURRENCIES } from '../utils/format';
import {
  DOCUMENT_TYPE_META, INVOICE_STATUS_META, INVOICE_STATUS_FLOW,
  documentNumberPrefix, type InvoiceStatus,
} from '../utils/status';
import { addInvoiceItem, removeInvoiceItem } from '@shared/services/db/invoke/invoicing';
import LineItemsEditor, { type EditorLineItem } from './LineItemsEditor';
import InvoiceTotals from './InvoiceTotals';
import InvoiceStatusPill from './InvoiceStatusPill';

type DocType = 'invoice' | 'delivery_bill' | 'shipping_print';

export default function InvoiceEditor() {
  const params = useParams({ strict: false }) as { invoiceId?: string };
  const navigate = useNavigate();
  const invoiceId = params.invoiceId ?? null;

  const store = useInvoicingStore();
  const {
    clients, items: catalog,
    fetchClients, fetchItems, fetchCompany,
    getInvoiceWithItems, createInvoice, updateInvoice, removeInvoice,
    changeStatus, generateDocuments, sendInvoice, createClient,
  } = store;

  const [docType, setDocType] = useState<DocType>('invoice');
  const [number, setNumber] = useState(() => `${documentNumberPrefix('invoice')}001`);
  const [clientId, setClientId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<number>(Math.floor(Date.now() / 1000));
  const [dueDate, setDueDate] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string>('MAD');
  const [notes, setNotes] = useState<string>('');
  const [lineItems, setLineItems] = useState<EditorLineItem[]>([
    { description: '', qty: 1, unit: 'pcs', unitPrice: 0, taxRate: 20 },
  ]);
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [discount, setDiscount] = useState(0);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [docs, setDocs] = useState<{ pdf?: string; xml?: string } | null>(null);
  const [preview, setPreview] = useState<'pdf' | 'xml' | null>(null);
  const [sending, setSending] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [newClient, setNewClient] = useState<{ open: boolean; name: string; email: string }>({ open: false, name: '', email: '' });

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing
  useEffect(() => {
    fetchClients(ACTIVE_COMPANY_ID);
    fetchItems(ACTIVE_COMPANY_ID);
    fetchCompany(ACTIVE_COMPANY_ID);
  }, [fetchClients, fetchItems, fetchCompany]);

  useEffect(() => {
    if (!invoiceId) return;
    let cancelled = false;
    getInvoiceWithItems(invoiceId).then(({ invoice, items }) => {
      if (cancelled) return;
      setDocType(invoice.document_type);
      setNumber(invoice.invoice_number);
      setClientId(invoice.client_id);
      setIssueDate(invoice.issue_date);
      setDueDate(invoice.due_date);
      setCurrency(invoice.currency);
      setNotes(invoice.notes ?? '');
      setStatus(invoice.status);
      setLineItems(
        items.map((it) => ({
          id: it.id,
          description: it.description,
          qty: it.qty,
          unit: it.unit,
          unitPrice: it.unit_price,
          taxRate: it.tax_rate,
        })),
      );
      if (invoice.pdf_path || invoice.peppol_xml_path) {
        setDocs({ pdf: invoice.pdf_path ?? undefined, xml: invoice.peppol_xml_path ?? undefined });
      }
      setDirty(false);
    }).catch((e) => setError(e?.message ?? 'Failed to load document'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const { subtotal, taxTotal, total } = useMemo(() => {
    const sub = lineItems.reduce((a, i) => a + i.qty * i.unitPrice, 0);
    const tax = lineItems.reduce((a, i) => a + i.qty * i.unitPrice * (i.taxRate / 100), 0);
    const disc = Math.max(0, discount);
    return { subtotal: sub, taxTotal: tax, total: sub + tax - disc };
  }, [lineItems, discount]);

  // Autosave (debounced) once a client is chosen
  useEffect(() => {
    if (!dirty || !clientId || saving) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void persist(true); }, 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, clientId, saving]);

  const markDirty = () => setDirty(true);

  async function persist(isAutosave = false): Promise<string | null> {
    if (!clientId) {
      if (!isAutosave) setError('Select a client before saving.');
      return null;
    }
    setSaving(true);
    setError(null);
    try {
      const itemsReq = lineItems.map((it, idx) => ({
        description: it.description,
        qty: it.qty,
        unit: it.unit,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        sortOrder: idx,
      }));
      let id = invoiceId;
      if (!id) {
        const inv = await createInvoice({
          companyId: ACTIVE_COMPANY_ID,
          clientId,
          documentType: docType,
          invoiceNumber: number,
          issueDate,
          dueDate,
          currency,
          notes: notes || null,
          itemsReq,
        });
        id = inv.id;
        setStatus(inv.status);
      } else {
        await updateInvoice(id, {
          client_id: clientId,
          document_type: docType,
          invoice_number: number,
          issue_date: issueDate,
          due_date: dueDate,
          currency,
          notes: notes || null,
        });
        const existing = lineItems.filter((i) => i.id).map((i) => i.id!);
        for (const eid of existing) await removeInvoiceItem(id, eid);
        for (let idx = 0; idx < lineItems.length; idx++) {
          const it = lineItems[idx]!;
          await addInvoiceItem(id, it.description, it.qty, it.unit, it.unitPrice, it.taxRate, idx);
        }
      }
      setLastSaved(Date.now());
      setDirty(false);
      return id;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(next: InvoiceStatus) {
    let id = invoiceId;
    if (!id) id = await persist(true);
    if (!id) return;
    try {
      await changeStatus(id, next);
      setStatus(next);
    } catch (e: any) { setError(e?.message ?? 'Failed to update status'); }
  }

  async function handleGenerate() {
    let id = invoiceId;
    if (!id) id = await persist(true);
    if (!id) return;
    try {
      const [pdf, xml] = await generateDocuments(id);
      setDocs({ pdf, xml });
    } catch (e: any) { setError(e?.message ?? 'Failed to generate documents'); }
  }

  async function handleSend() {
    let id = invoiceId;
    if (!id) id = await persist(true);
    if (!id) return;
    const to = newClient.email || clients.find((c) => c.id === clientId)?.email;
    if (!to) { setError('Client has no email address.'); return; }
    setSending(true);
    try {
      await sendInvoice(id, to);
      await handleStatus('sent');
    } catch (e: any) { setError(e?.message ?? 'Failed to send'); }
    finally { setSending(false); }
  }

  async function handleDelete() {
    if (!invoiceId) { navigate({ to: '/invoicing' }); return; }
    await removeInvoice(invoiceId);
    navigate({ to: '/invoicing' });
  }

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 px-5 sm:px-8 py-3.5 border-b border-border-primary bg-bg-primary/70 backdrop-blur-[16px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={18} />} onClick={() => navigate({ to: '/invoicing' })} />
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">
              {invoiceId ? number : `New ${DOCUMENT_TYPE_META[docType].label}`}
            </h1>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <SaveIndicator saving={saving} lastSaved={lastSaved} dirty={dirty} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {docs?.pdf && (
            <Button variant="secondary" size="sm" icon={<Eye size={15} />} onClick={() => setPreview('pdf')}>Preview</Button>
          )}
          <Button variant="secondary" size="sm" icon={<CloudUpload size={15} />} onClick={handleGenerate}>Generate</Button>
          <Button variant="secondary" size="sm" icon={sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} onClick={handleSend} disabled={sending}>Send</Button>
          <Button size="sm" icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} onClick={() => persist(false)}>Save</Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm border border-danger/20">
              <X size={15} /> {error}
            </div>
          )}

          {/* Document type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(DOCUMENT_TYPE_META) as DocType[]).map((t) => (
              <DocTypeCard
                key={t}
                active={docType === t}
                onClick={() => { setDocType(t); setNumber(`${documentNumberPrefix(t)}${number.split('-').pop() ?? '001'}`); markDirty(); }}
                icon={t === 'invoice' ? <ReceiptText /> : t === 'delivery_bill' ? <Truck /> : <Printer />}
                title={DOCUMENT_TYPE_META[t].label}
                desc={DOCUMENT_TYPE_META[t].description}
              />
            ))}
          </div>

          {/* Meta grid */}
          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Document Number">
              <input value={number} onChange={(e) => { setNumber(e.target.value); markDirty(); }} className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full font-mono text-sm" />
            </Field>
            <Field label="Client">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setClientOpen((o) => !o)}
                  className="w-full glass-input rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left"
                >
                  <span className={selectedClient ? 'text-text-primary' : 'text-text-tertiary'}>
                    {selectedClient ? selectedClient.display_name : 'Select a client'}
                  </span>
                  <Users size={15} className="text-text-tertiary" />
                </button>
                {clientOpen && (
                  <ClientPicker
                    clients={clients}
                    selectedId={clientId}
                    onPick={(id) => { setClientId(id); setClientOpen(false); markDirty(); }}
                    onNew={() => setNewClient({ open: true, name: '', email: '' })}
                  />
                )}
              </div>
            </Field>
            <Field label="Issue Date">
              <input type="date" value={toDateInputValue(issueDate)} onChange={(e) => { setIssueDate(fromDateInputValue(e.target.value)); markDirty(); }} className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full" />
            </Field>
            <Field label="Due Date">
              <input type="date" value={toDateInputValue(dueDate)} onChange={(e) => { setDueDate(e.target.value ? fromDateInputValue(e.target.value) : null); markDirty(); }} className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full" />
            </Field>
            <Field label="Currency">
              <select value={currency} onChange={(e) => { setCurrency(e.target.value); markDirty(); }} className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full">
                {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Line items */}
          <LineItemsEditor items={lineItems} onChange={(next) => { setLineItems(next); markDirty(); }} catalog={catalog} currency={currency} />

          {/* Notes */}
          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-5">
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); markDirty(); }} rows={3} placeholder="Payment terms, thank-you note, or delivery instructions..." className="glass-input rounded-xl px-3.5 py-2.5 text-text-primary w-full resize-none text-sm placeholder:text-text-tertiary" />
            </Field>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-border-primary pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-tertiary uppercase">Discount</span>
                <input type="number" min={0} value={discount} onChange={(e) => { setDiscount(Math.max(0, Number(e.target.value))); markDirty(); }} className="glass-input rounded-lg px-2.5 py-1.5 w-28 text-right text-text-primary tabular-nums" />
              </div>
              <InvoiceTotals subtotal={subtotal} taxTotal={taxTotal} discount={discount} total={total} currency={currency} />
            </div>
          </div>

          {/* Status workflow */}
          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-primary">Status</h3>
              <InvoiceStatusPill status={status} size="sm" />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {INVOICE_STATUS_FLOW.map((s, i) => {
                const meta = INVOICE_STATUS_META[s];
                const Icon = meta.icon;
                const reached = INVOICE_STATUS_FLOW.indexOf(status) >= i || status === 'cancelled';
                return (
                  <div key={s} className="flex items-center">
                    <button
                      type="button"
                      disabled={status === 'paid' || status === 'cancelled'}
                      onClick={() => handleStatus(s)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all disabled:opacity-40 ${
                        status === s ? `${meta.pill} ring-1 ring-current` : reached ? 'text-text-secondary hover:bg-bg-hover/60' : 'text-text-tertiary hover:bg-bg-hover/40'
                      }`}
                    >
                      <Icon size={15} /> {meta.label}
                    </button>
                    {i < INVOICE_STATUS_FLOW.length - 1 && <span className="w-5 h-px bg-border-primary shrink-0" />}
                  </div>
                );
              })}
              {status !== 'cancelled' && (
                <button type="button" onClick={() => handleStatus('cancelled')} className="ml-2 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-text-tertiary hover:text-danger hover:bg-danger/10 whitespace-nowrap">
                  <X size={15} /> Cancel
                </button>
              )}
            </div>
          </div>

          {invoiceId && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="text-danger hover:bg-danger/10" onClick={handleDelete}>Delete document</Button>
            </div>
          )}
        </div>
      </div>

      {/* New client popover */}
      {newClient.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setNewClient({ open: false, name: '', email: '' })}>
          <div className="bg-bg-primary rounded-2xl border border-border-primary w-full max-w-sm p-6 backdrop-blur-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><Users size={18} className="text-accent" /> New Client</h3>
            <div className="space-y-3">
              <input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Client / company name" className="glass-input rounded-xl px-3.5 py-2.5 w-full text-text-primary placeholder:text-text-tertiary" />
              <input value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} placeholder="email@client.com" className="glass-input rounded-xl px-3.5 py-2.5 w-full text-text-primary placeholder:text-text-tertiary" />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setNewClient({ open: false, name: '', email: '' })}>Cancel</Button>
              <Button
                disabled={!newClient.name.trim()}
                onClick={async () => {
                  const c = await createClient({ companyId: ACTIVE_COMPANY_ID, name: newClient.name.trim(), email: newClient.email.trim() || null, role: 'customer' });
                  setClientId(c.id);
                  setNewClient({ open: false, name: '', email: '' });
                  markDirty();
                }}
              >Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Document preview */}
      {preview && docs && (
        <DocumentPreviewModal
          type={preview}
          path={preview === 'pdf' ? docs.pdf ?? '' : docs.xml ?? ''}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function SaveIndicator({ saving, lastSaved, dirty }: { saving: boolean; lastSaved: number | null; dirty: boolean }) {
  if (saving) return <span className="flex items-center gap-1 text-accent"><Loader2 size={12} className="animate-spin" /> Saving…</span>;
  if (dirty) return <span className="text-text-tertiary">Unsaved changes</span>;
  if (lastSaved) return <span className="flex items-center gap-1 text-success"><Check size={12} /> Saved</span>;
  return <span>New document</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function DocTypeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
      active ? 'bg-accent/5 border-accent ring-1 ring-accent' : 'bg-bg-secondary/60 border-border-primary hover:bg-bg-hover/50'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-accent text-white' : 'bg-bg-tertiary text-text-tertiary'}`}>{icon}</div>
      <div>
        <h4 className={`font-bold text-sm ${active ? 'text-accent' : 'text-text-primary'}`}>{title}</h4>
        <p className="text-[10px] text-text-tertiary mt-0.5 uppercase tracking-wide font-medium">{desc}</p>
      </div>
    </button>
  );
}

function ClientPicker({ clients, selectedId, onPick, onNew }: { clients: { id: string; display_name: string; email: string | null }[]; selectedId: string; onPick: (id: string) => void; onNew: () => void }) {
  return (
    <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-border-primary bg-bg-elevated backdrop-blur-2xl shadow-xl p-1.5 max-h-64 overflow-auto">
      {clients.length === 0 && <p className="text-xs text-text-tertiary px-3 py-3">No clients yet.</p>}
      {clients.map((c) => (
        <button key={c.id} type="button" onClick={() => onPick(c.id)} className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 ${c.id === selectedId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-hover/60 text-text-primary'}`}>
          <span className="text-sm truncate">{c.display_name}</span>
          {c.id === selectedId && <Check size={14} />}
        </button>
      ))}
      <button type="button" onClick={onNew} className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-accent text-sm font-medium hover:bg-accent/5 border-t border-border-primary mt-1">
        <Plus size={14} /> New client
      </button>
    </div>
  );
}

function DocumentPreviewModal({ type, path, onClose }: { type: 'pdf' | 'xml'; path: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="bg-bg-primary rounded-2xl border border-border-primary w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden backdrop-blur-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary bg-bg-secondary">
          <div className="flex items-center gap-3">
            {type === 'pdf' ? <FileText className="text-accent" /> : <FileCode className="text-warning" />}
            <div>
              <h3 className="font-bold text-text-primary">{type === 'pdf' ? 'PDF Document' : 'PEPPOL / UBL 2.1 XML'}</h3>
              <p className="text-xs text-text-tertiary truncate max-w-md">{path || 'Generated document'}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon={<X size={18} />} onClick={onClose} />
        </div>
        <div className="flex-1 bg-bg-tertiary flex flex-col items-center justify-center text-text-tertiary gap-2 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center">
            {type === 'pdf' ? <FileText size={30} className="text-accent" /> : <FileCode size={30} className="text-warning" />}
          </div>
          <p className="font-medium text-text-secondary">Document ready</p>
          <p className="text-sm max-w-sm">In the live desktop app this panel renders the generated {type === 'pdf' ? 'PDF' : 'XML'} from <code className="text-text-primary">{path}</code>.</p>
        </div>
      </div>
    </div>
  );
}
