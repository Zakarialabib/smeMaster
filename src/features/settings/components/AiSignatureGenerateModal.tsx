import { useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Check, PenTool } from "lucide-react";
import { AiGenerationFlow } from "@shared/components/ai/AiGenerationFlow";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { generateSignature, type GeneratedSignature } from "@shared/services/ai/signatureGenerator";
import { useAiGenerationModal } from "@features/settings/hooks/useAiGenerationModal";

type SignatureStyle = "modern" | "classic" | "minimal" | "branded";

const STYLES: { value: SignatureStyle; labelKey: string; descriptionKey: string }[] = [
  { value: "modern", labelKey: "modals.aiSignature.modern", descriptionKey: "modals.aiSignature.modernDesc" },
  { value: "classic", labelKey: "modals.aiSignature.classic", descriptionKey: "modals.aiSignature.classicDesc" },
  { value: "minimal", labelKey: "modals.aiSignature.minimal", descriptionKey: "modals.aiSignature.minimalDesc" },
  { value: "branded", labelKey: "modals.aiSignature.branded", descriptionKey: "modals.aiSignature.brandedDesc" },
];

const inputClass =
  "w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-tertiary";

function Field({
  label,
  required,
  fullRow,
  ...input
}: { label: string; required?: boolean; fullRow?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={fullRow ? "col-span-2 sm:col-span-1" : undefined}>
      <label className="text-xs font-medium text-text-secondary mb-1 block">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input {...input} className={inputClass} />
    </div>
  );
}

interface AiSignatureGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (signature: GeneratedSignature) => void;
  onSave?: (signature: GeneratedSignature) => void;
}

export function AiSignatureGenerateModal({ isOpen, onClose, onInsert, onSave }: AiSignatureGenerateModalProps) {
  const { t } = useTranslation();
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");

  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [style, setStyle] = useState<SignatureStyle>("modern");

  const flowState = useAiGenerationModal<GeneratedSignature>(async () =>
    generateSignature({
      fullName: fullName || "Your Name",
      title: title || "Professional",
      company: company || "Your Company",
      email: email || "email@example.com",
      phone: phone || undefined,
      style,
    }),
  );
  const { result, reset } = flowState;

  const handleClose = () => {
    reset();
    onClose();
  };
  const handleInsert = () => {
    if (result) {
      onInsert(result);
      handleClose();
    }
  };
  const handleSave = () => {
    if (result && onSave) {
      onSave(result);
      handleClose();
    }
  };

  const hasRequiredFields = fullName.trim() && email.trim();

  return (
    <AiGenerationFlow<GeneratedSignature>
      state={flowState}
      isOpen={isOpen}
      onClose={onClose}
      title={t("modals.aiSignature.title")}
      isLocked={isAiLocked}
      lockFeatureName={t("modals.aiSignature.aiSignatureLocked")}
      lockDescription={t("modals.aiSignature.aiSignatureLockedDesc")}
      generatingLabel={t("modals.aiSignature.generatingSignature")}
      generatingSubLabel={t("modals.aiSignature.designingSignature")}
      promptSlot={(generate) => (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" fullRow />
            <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product Lead" fullRow />
            <Field label="Company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc." fullRow />
            <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@acme.com" fullRow />
            <Field label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 1234" />
            <Field label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">{t("modals.aiSignature.style")}</label>
            <div className="grid grid-cols-4 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border text-xs transition-colors ${
                    style === s.value
                      ? "bg-accent/10 text-accent border-accent/30 font-medium"
                      : "bg-bg-tertiary text-text-tertiary border-border-primary hover:text-text-secondary hover:border-border-secondary"
                  }`}
                >
                  <span className="text-sm font-semibold">{t(s.labelKey)}</span>
                  <span className="text-[0.625rem] text-center leading-tight">{t(s.descriptionKey)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={generate}
              disabled={!hasRequiredFields}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} />
              {t("modals.aiSignature.generateSignature")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
            >
              {t("modals.aiSignature.cancel")}
            </button>
          </div>
        </div>
      )}
      previewSlot={(result, regenerate) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <PenTool size={14} className="text-accent" />
              {result.name}
            </h4>
            <span className="text-[0.625rem] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 capitalize">
              {style}
            </span>
          </div>
          <div className="border border-border-primary rounded-lg overflow-hidden bg-white p-6">
            <div className="[&_table]:max-w-full" dangerouslySetInnerHTML={{ __html: result.html }} />
          </div>
          {result.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[0.625rem] text-text-tertiary me-1 self-center">{t("modals.aiSignature.variables")}</span>
              {result.variables.map((v) => (
                <code key={v} className="text-[0.625rem] px-1.5 py-0.5 rounded bg-accent/5 text-accent border border-accent/10">
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-border-secondary">
            <button
              type="button"
              onClick={handleInsert}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Check size={14} />
              {t("modals.aiSignature.insert")}
            </button>
            {onSave && (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-hover border border-border-primary transition-colors"
              >
                <PenTool size={14} />
                {t("modals.aiSignature.save")}
              </button>
            )}
            <button
              type="button"
              onClick={regenerate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors ms-auto"
            >
              <Sparkles size={12} />
              {t("modals.aiSignature.regenerate")}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg hover:bg-bg-hover transition-colors"
            >
              {t("modals.aiSignature.cancel")}
            </button>
          </div>
        </div>
      )}
    />
  );
}
