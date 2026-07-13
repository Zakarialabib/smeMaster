import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Plus,
  Pencil,
  X,
  Save,
  RefreshCw,
  Check,
} from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { SectionCard, InfoBanner } from "./erpShared";
import {
  listCompanies,
  createCompany,
  updateCompany,
} from "@shared/services/db/invoke/invoicing";
import type { Company } from "@shared/services/db/schema";

// ── Form field type ──────────────────────────────────────────────────────────

interface CompanyFormData {
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  website: string;
  industry: string;
  timezone: string;
  ice: string;
  tax_id: string;
  rc: string;
  cnss: string;
}

const EMPTY_FORM: CompanyFormData = {
  name: "",
  legal_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Morocco",
  website: "",
  industry: "",
  timezone: "Africa/Casablanca",
  ice: "",
  tax_id: "",
  rc: "",
  cnss: "",
};

function companyToForm(c: Company): CompanyFormData {
  return {
    name: c.name,
    legal_name: c.legal_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    address_line1: c.address_line1 ?? "",
    address_line2: c.address_line2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    postal_code: c.postal_code ?? "",
    country: c.country ?? "Morocco",
    website: c.website ?? "",
    industry: c.industry ?? "",
    timezone: c.timezone,
    ice: c.ice ?? "",
    tax_id: c.tax_id ?? "",
    rc: c.rc ?? "",
    cnss: c.cnss ?? "",
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

export default function CompanyManagementView() {
  const { t } = useTranslation();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyFormData>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCompanies();
      setCompanies(data);
    } catch (err) {
      console.error("Failed to load companies:", err);
      showToast("error", "Failed to load companies");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Toast ──────────────────────────────────────────────────────────────

  const showToast = useCallback((type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Edit / Create handlers ─────────────────────────────────────────────

  const handleEdit = useCallback((c: Company) => {
    setEditingId(c.id);
    setForm(companyToForm(c));
    setCreating(false);
  }, []);

  const handleNew = useCallback(() => {
    setEditingId("__new__");
    setForm(EMPTY_FORM);
    setCreating(true);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setCreating(false);
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof CompanyFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      showToast("error", "Company name is required");
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        await createCompany({
          name: form.name.trim(),
          legal_name: form.legal_name || null,
          email: form.email || null,
          phone: form.phone || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          state: form.state || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          website: form.website || null,
          industry: form.industry || null,
          timezone: form.timezone,
          ice: form.ice || null,
          tax_id: form.tax_id || null,
          rc: form.rc || null,
          cnss: form.cnss || null,
        });
        showToast("success", "Company created");
      } else if (editingId) {
        await updateCompany(editingId, {
          name: form.name.trim(),
          legal_name: form.legal_name || null,
          email: form.email || null,
          phone: form.phone || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          state: form.state || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
          website: form.website || null,
          industry: form.industry || null,
          timezone: form.timezone,
          ice: form.ice || null,
          tax_id: form.tax_id || null,
          rc: form.rc || null,
          cnss: form.cnss || null,
        });
        showToast("success", "Company updated");
      }
      setEditingId(null);
      setCreating(false);
      await load();
    } catch (err) {
      console.error("Failed to save company:", err);
      showToast("error", "Failed to save company");
    } finally {
      setSaving(false);
    }
  }, [form, editingId, creating, load, showToast]);

  // ── Field renderer ─────────────────────────────────────────────────────

  const renderField = (
    label: string,
    field: keyof CompanyFormData,
    placeholder?: string,
    opts?: { type?: string; className?: string; hint?: string },
  ) => (
    <div className={opts?.className ?? "col-span-1"}>
      <label className="block text-xs font-medium text-text-secondary mb-1">
        {label}
      </label>
      <input
        type={opts?.type ?? "text"}
        value={form[field]}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-tertiary text-text-primary text-sm px-3 py-2 rounded-lg border border-border-primary outline-none focus:border-accent transition-colors"
      />
      {opts?.hint && (
        <p className="text-[10px] text-text-tertiary mt-0.5">{opts.hint}</p>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium backdrop-blur-xl border transition-all ${
            toast.type === "success"
              ? "bg-success/10 text-success border-success/20"
              : "bg-danger/10 text-danger border-danger/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
            {toast.msg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Building2 size={16} className="text-accent" />
            {t("erp.companyManagement", "Company Management")}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {t("erp.companyManagementSub", "Manage your companies and Morocco DGI identifiers")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={load}
            disabled={loading}
          >
            {t("common.refresh", "Refresh")}
          </Button>
          {!editingId && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={handleNew}
            >
              {t("erp.addCompany", "Add Company")}
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && companies.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={20} className="text-text-tertiary animate-spin" />
        </div>
      )}

      {/* Company list */}
      {!loading && companies.length === 0 && !editingId && (
        <InfoBanner>
          {t("erp.noCompanies", "No companies yet. Add your first company to get started.")}
        </InfoBanner>
      )}

      {/* Edit / Create form (shown when editing or creating) */}
      {editingId && (
        <SectionCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-primary">
              {creating
                ? t("erp.createCompany", "Create Company")
                : t("erp.editCompany", "Edit Company")}
            </h4>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={14} />}
                onClick={handleSave}
                loading={saving}
                disabled={!form.name.trim() || saving}
              >
                {t("common.save", "Save")}
              </Button>
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={handleCancel}>
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </div>

          {/* Form grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Basic info */}
            {renderField("Company Name *", "name", "My Company SARL", { className: "md:col-span-2" })}
            {renderField("Legal Name", "legal_name", "My Company SARL AU")}
            {renderField("Email", "email", "contact@company.ma", { type: "email" })}
            {renderField("Phone", "phone", "+212 5XX XX XX XX", { type: "tel" })}
            {renderField("Website", "website", "https://company.ma")}
            {renderField("Industry", "industry", "Technology")}

            {/* Address */}
            {renderField("Address Line 1", "address_line1", "123 Avenue Mohammed V", { className: "md:col-span-2" })}
            {renderField("Address Line 2", "address_line2", "Etage 3, Appartement 6", { className: "md:col-span-2" })}
            {renderField("City", "city", "Casablanca")}
            {renderField("State / Region", "state", "Casablanca-Settat")}
            {renderField("Postal Code", "postal_code", "20000")}
            {renderField("Country", "country", "Morocco")}
            {renderField("Timezone", "timezone", "Africa/Casablanca")}

            {/* Morocco DGI identifiers */}
            <div className="md:col-span-3 border-t border-border-primary pt-4 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                Morocco DGI Identifiers
              </p>
            </div>
            {renderField("ICE", "ice", "002315476000032", {
              hint: "Identifiant Commun de l'Entreprise (15 digits)",
            })}
            {renderField("Tax ID / IF", "tax_id", "12345678", {
              hint: "Identifiant Fiscal",
            })}
            {renderField("RC", "rc", "123456", {
              hint: "Registre de Commerce",
            })}
            {renderField("CNSS", "cnss", "987654321", {
              hint: "Caisse Nationale de Sécurité Sociale",
            })}
          </div>
        </SectionCard>
      )}

      {/* Company table */}
      {companies.length > 0 && !editingId && (
        <SectionCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-text-tertiary text-[11px] font-semibold uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">ICE</th>
                  <th className="text-left px-4 py-3">City</th>
                  <th className="text-left px-4 py-3">Industry</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border-primary last:border-0 hover:bg-bg-hover/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate max-w-[200px]">
                            {c.name}
                          </p>
                          {c.legal_name && (
                            <p className="text-[11px] text-text-tertiary truncate max-w-[200px]">
                              {c.legal_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                      {c.ice ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.city ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {c.industry ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<Pencil size={12} />}
                        onClick={() => handleEdit(c)}
                      >
                        {t("common.edit", "Edit")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
