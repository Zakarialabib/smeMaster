import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Save, BadgeCheck } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { SettingsSection, SettingsRow } from "@shared/components/settings";
import { getCompany, updateCompany } from "@shared/services/db/db-invoke";
import type { Company } from "@shared/services/db/schema";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-border-primary bg-bg-secondary text-text-primary text-sm focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors";

export default function BusinessProfileTab() {
  const { t } = useTranslation();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // For simplicity, we assume the first company is the user's company
        // In a real app, we'd have a way to identify the current business entity
        const res = await getCompany("demo-company-1");
        setCompany(res);
      } catch (err) {
        console.error("Failed to load company:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);
    try {
      await updateCompany(company.id, {
        set: {
          name: company.name,
          legal_name: company.legal_name,
          ice: company.ice,
          tax_id: company.tax_id,
          rc: company.rc,
          cnss: company.cnss,
          address_line1: company.address_line1,
          city: company.city,
          country: company.country,
        },
        unset: [],
      });
    } catch (err) {
      console.error("Failed to save company:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-text-tertiary">Loading...</div>;
  if (!company) return <div className="p-8 text-center text-text-tertiary">No business profile found.</div>;

  return (
    <>
      <SettingsSection title="Business Information" description="Your business legal details for invoices and compliance">
        <SettingsRow label="Company Name">
          <input
            value={company.name}
            onChange={(e) => setCompany({ ...company, name: e.target.value })}
            className={inputClass}
            placeholder="e.g. My Awesome Startup"
          />
        </SettingsRow>
        <SettingsRow label="Legal Name" description="Used in official documents">
          <input
            value={company.legal_name || ""}
            onChange={(e) => setCompany({ ...company, legal_name: e.target.value })}
            className={inputClass}
            placeholder="e.g. My Awesome Startup SARL"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Morocco DGI Compliance" description="Mandatory identifiers for Moroccan tax authority compliance">
        <SettingsRow label="ICE" description="Identifiant Commun de l’Entreprise (15 digits)">
          <input
            value={company.ice || ""}
            onChange={(e) => setCompany({ ...company, ice: e.target.value })}
            className={inputClass}
            placeholder="00XXXXXXXXXXXXX"
          />
        </SettingsRow>
        <SettingsRow label="IF" description="Identifiant Fiscal">
          <input
            value={company.tax_id || ""}
            onChange={(e) => setCompany({ ...company, tax_id: e.target.value })}
            className={inputClass}
            placeholder="XXXXXXXX"
          />
        </SettingsRow>
        <SettingsRow label="RC" description="Registre du Commerce">
          <input
            value={company.rc || ""}
            onChange={(e) => setCompany({ ...company, rc: e.target.value })}
            className={inputClass}
            placeholder="XXXXXX"
          />
        </SettingsRow>
        <SettingsRow label="CNSS" description="Social Security Registration">
          <input
            value={company.cnss || ""}
            onChange={(e) => setCompany({ ...company, cnss: e.target.value })}
            className={inputClass}
            placeholder="XXXXXXX"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Address">
        <SettingsRow label="Street Address">
          <input
            value={company.address_line1 || ""}
            onChange={(e) => setCompany({ ...company, address_line1: e.target.value })}
            className={inputClass}
          />
        </SettingsRow>
        <SettingsRow label="City">
          <input
            value={company.city || ""}
            onChange={(e) => setCompany({ ...company, city: e.target.value })}
            className={inputClass}
          />
        </SettingsRow>
        <SettingsRow label="Country">
          <input
            value={company.country || "MA"}
            onChange={(e) => setCompany({ ...company, country: e.target.value })}
            className={inputClass}
          />
        </SettingsRow>
      </SettingsSection>

      <div className="flex justify-end p-4 border-t border-border-primary bg-bg-secondary sticky bottom-0">
        <Button
          onClick={handleSave}
          disabled={saving}
          icon={saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save size={16} />}
        >
          {saving ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </>
  );
}
