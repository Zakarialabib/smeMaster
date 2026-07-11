import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  getSignaturesForAccount,
  insertSignature,
  type DbSignature,
} from "@features/mail/db/signatures";
import { generateSignature } from "@shared/services/ai/signatureGenerator";
import { Modal } from "@shared/components/ui/Modal";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";

export function SignatureSelector() {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const isOpen = useComposerStore((s) => s.isOpen);
  const signatureId = useComposerStore((s) => s.signatureId);
  const setSignatureHtml = useComposerStore((s) => s.setSignatureHtml);
  const setSignatureId = useComposerStore((s) => s.setSignatureId);
  const [signatures, setSignatures] = useState<DbSignature[]>([]);
  const [previewSig, setPreviewSig] = useState<DbSignature | null>(null);
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiName, setAiName] = useState("");
  const [aiTitle, setAiTitle] = useState("");
  const [aiCompany, setAiCompany] = useState("");
  const [aiEmail, setAiEmail] = useState("");
  const [aiPhone, setAiPhone] = useState("");
  const [aiStyle, setAiStyle] = useState<"modern" | "classic" | "minimal" | "branded">("modern");

  useEffect(() => {
    if (!isOpen || !activeAccountId) return;
    let cancelled = false;
    getSignaturesForAccount(activeAccountId).then((sigs) => {
      if (!cancelled) setSignatures(sigs);
    });
    return () => { cancelled = true; };
  }, [isOpen, activeAccountId]);

  if (signatures.length === 0) return null;

  const handleChange = (id: string) => {
    if (id === "") {
      setSignatureId(null);
      setSignatureHtml("");
      setPreviewSig(null);
      return;
    }
    const sig = signatures.find((s) => s.id === id);
    if (sig) {
      setSignatureId(sig.id);
      setSignatureHtml(sig.body_html);
      setPreviewSig(sig);
    }
  };

  const handleGenerateWithAi = async () => {
    if (!aiName.trim() || !aiTitle.trim() || !aiCompany.trim() || !aiEmail.trim() || aiLoading || !activeAccountId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateSignature({
        fullName: aiName.trim(),
        title: aiTitle.trim(),
        company: aiCompany.trim(),
        email: aiEmail.trim(),
        phone: aiPhone.trim() || undefined,
        style: aiStyle,
      });
      const newId = await insertSignature({
        accountId: activeAccountId,
        name: result.name,
        bodyHtml: result.html,
        isDefault: false,
      });
      const newSig: DbSignature = {
        id: newId,
        account_id: activeAccountId,
        name: result.name,
        body_html: result.html,
        is_default: 0,
        sort_order: signatures.length,
        created_at: Date.now(),
      };
      setSignatures((prev) => [...prev, newSig]);
      // Auto-select the new signature
      setSignatureId(newId);
      setSignatureHtml(result.html);
      setPreviewSig(newSig);
      setShowAiForm(false);
      // Reset form
      setAiName("");
      setAiTitle("");
      setAiCompany("");
      setAiEmail("");
      setAiPhone("");
      setAiStyle("modern");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <select
        value={signatureId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        onMouseEnter={(e) => {
          const id = e.currentTarget.value;
          if (id) {
            const sig = signatures.find((s) => s.id === id);
            if (sig) setPreviewSig(sig);
          }
        }}
        className="text-[0.625rem] bg-bg-tertiary text-text-secondary border border-border-primary rounded px-1.5 py-0.5 w-full"
      >
        <option value="">No signature</option>
        {signatures.map((sig) => (
          <option key={sig.id} value={sig.id}>
            {sig.name}
          </option>
        ))}
      </select>

      {/* AI Generate button */}
      <div className="pt-1">
        {isAiLocked ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">AI Signatures</span>
            <UpgradeBadge variant="pro-only" size="sm" />
          </div>
        ) : (
          <button
            onClick={() => setShowAiForm(true)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            <Sparkles size={12} />
            Generate with AI
          </button>
        )}
      </div>

      {/* AI Signature Form Modal */}
      <Modal isOpen={showAiForm} onClose={() => { setShowAiForm(false); setAiError(null); }} title="Generate Email Signature" size="sm">
        <div className="p-4 space-y-3">
          <input
            type="text"
            value={aiName}
            onChange={(e) => setAiName(e.target.value)}
            placeholder="Full Name *"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
            disabled={aiLoading}
          />
          <input
            type="text"
            value={aiTitle}
            onChange={(e) => setAiTitle(e.target.value)}
            placeholder="Title *"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
            disabled={aiLoading}
          />
          <input
            type="text"
            value={aiCompany}
            onChange={(e) => setAiCompany(e.target.value)}
            placeholder="Company *"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
            disabled={aiLoading}
          />
          <input
            type="email"
            value={aiEmail}
            onChange={(e) => setAiEmail(e.target.value)}
            placeholder="Email *"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
            disabled={aiLoading}
          />
          <input
            type="tel"
            value={aiPhone}
            onChange={(e) => setAiPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
            disabled={aiLoading}
          />
          <select
            value={aiStyle}
            onChange={(e) => setAiStyle(e.target.value as typeof aiStyle)}
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary"
            disabled={aiLoading}
          >
            <option value="modern">Modern</option>
            <option value="classic">Classic</option>
            <option value="minimal">Minimal</option>
            <option value="branded">Branded</option>
          </select>
          {aiError && <p className="text-xs text-danger">{aiError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setShowAiForm(false); setAiError(null); }}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              disabled={aiLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateWithAi}
              disabled={aiLoading || !aiName.trim() || !aiTitle.trim() || !aiCompany.trim() || !aiEmail.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {aiLoading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </Modal>

      {previewSig && (
        <div className="border border-border-primary rounded-md bg-bg-primary shadow-sm">
          <iframe
            srcDoc={previewSig.body_html}
            sandbox="allow-same-origin"
            className="w-full border-0 rounded"
            style={{ height: 80 }}
            title="Signature preview"
          />
        </div>
      )}
    </div>
  );
}

