import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, Sparkles, Loader2, Eye, EyeOff, Variable, RotateCcw, Check, FileText } from "lucide-react";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getCampaignTemplateList } from "@features/campaigns/services/campaignTemplateCatalog";
import type { DbTemplate } from "@features/mail/db/templates";
import { generateTemplate } from "@shared/services/ai/templateGenerator";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";

interface CampaignTemplatePickerProps {
  selectedTemplateId: string | null;
  onSelect: (templateId: string | null) => void;
}

/** Default sample data for previewing variable interpolation */
const DEFAULT_SAMPLE_VARS: Record<string, string> = {
  "{{first_name}}": "Jane",
  "{{last_name}}": "Doe",
  "{{email}}": "jane@example.com",
  "{{company}}": "Acme Corp",
  "{{my_name}}": "John Smith",
  "{{my_email}}": "john@mybiz.com",
  "{{my_title}}": "CEO",
  "{{my_phone}}": "+1 555-0123",
  "{{subject}}": "Your Monthly Newsletter",
  "{{date}}": "July 7, 2026",
  "{{date_long}}": "Tuesday, July 7, 2026",
  "{{day}}": "Tuesday",
  "{{day_of_week}}": "Tuesday",
  "{{random_greeting}}": "Hello",
};

const TYPE_COLORS: Record<string, string> = {
  campaign: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  email: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  warmup: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  workflow: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const TYPE_LABELS: Record<string, string> = {
  campaign: "Campaign",
  email: "Email",
  warmup: "Warm-up",
  workflow: "Workflow",
};

export function CampaignTemplatePicker({ selectedTemplateId, onSelect }: CampaignTemplatePickerProps) {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<DbTemplate | null>(null);
  const [showRawHtml, setShowRawHtml] = useState(false);
  const [sampleVars, setSampleVars] = useState(DEFAULT_SAMPLE_VARS);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [editingVarKey, setEditingVarKey] = useState<string | null>(null);
  const [editingVarValue, setEditingVarValue] = useState("");
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTemplates, setAiTemplates] = useState<DbTemplate[]>([]);

  useEffect(() => {
    async function load() {
      if (!activeAccountId) return;
      const list = await getCampaignTemplateList(activeAccountId);
      setTemplates(list);
    }
    load();
  }, [activeAccountId]);

  const allTemplates = useMemo(() => [...aiTemplates, ...templates], [aiTemplates, templates]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allTemplates;
    const q = search.toLowerCase();
    return allTemplates.filter(
      (tmpl) =>
        tmpl.name.toLowerCase().includes(q) ||
        (tmpl.subject ?? tmpl.name).toLowerCase().includes(q) ||
        tmpl.template_type.toLowerCase().includes(q),
    );
  }, [allTemplates, search]);

  const selectedTemplate = selectedTemplateId
    ? [...aiTemplates, ...templates].find((t) => t.id === selectedTemplateId) ?? null
    : null;

  const handleSelect = (template: DbTemplate | null) => {
    setSearch("");
    onSelect(template?.id ?? null);
    setPreviewTemplate(null);
  };

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const now = Date.now();
      const result = await generateTemplate(aiPrompt.trim());
      const newTemplate: DbTemplate = {
        id: `ai-${now}`,
        company_id: activeAccountId ?? "",
        name: result.name,
        subject: null,
        body_html: result.html,
        shortcut: null,
        sort_order: 0,
        category_id: null,
        is_favorite: 0,
        usage_count: 0,
        last_used_at: null,
        conditional_blocks_json: null,
        template_type: "campaign",
        origin: "ai_generated",
        delivery_config_json: null,
        ai_config_json: null,
        voice_config_json: null,
        compliance_profile_id: null,
        created_at: now,
      };
      setAiTemplates((prev) => [newTemplate, ...prev]);
      setAiPrompt("");
      setShowAiPrompt(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  /** Interpolate sample variables into HTML for preview */
  const getRenderedPreview = useCallback((html: string): string => {
    let result = html;
    for (const [key, value] of Object.entries(sampleVars)) {
      result = result.replaceAll(key, value);
    }
    // Replace any remaining {{variables}} with highlighted placeholders
    result = result.replace(/\{\{(\w+)\}\}/g, '<span class="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1 rounded">$1</span>');
    return result;
  }, [sampleVars]);

  /** Find variables used in template */
  const usedVariables = useMemo(() => {
    if (!previewTemplate) return [];
    const matches = previewTemplate.body_html.match(/\{\{\w+\}\}/g);
    if (!matches) return [];
    return [...new Set(matches)].sort();
  }, [previewTemplate]);

  const handleEditVar = (key: string) => {
    setEditingVarKey(key);
    setEditingVarValue(sampleVars[key] ?? "");
  };

  const handleSaveVar = () => {
    if (editingVarKey) {
      setSampleVars((prev) => ({ ...prev, [editingVarKey]: editingVarValue }));
      setEditingVarKey(null);
    }
  };

  const resetSampleVars = () => setSampleVars(DEFAULT_SAMPLE_VARS);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("campaign.searchTemplates")}
          className="w-full pl-8 pr-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary outline-none focus:border-accent transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Currently selected */}
      {selectedTemplate && !previewTemplate && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{selectedTemplate.name}</span>
                <span className={`text-[0.5rem] font-medium px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[selectedTemplate.template_type] ?? "bg-bg-tertiary text-text-tertiary"}`}>
                  {TYPE_LABELS[selectedTemplate.template_type] ?? selectedTemplate.template_type}
                </span>
              </div>
              {selectedTemplate.subject && (
                <div className="text-xs text-text-tertiary mt-0.5">Subject: {selectedTemplate.subject}</div>
              )}
            </div>
            <button
              onClick={() => handleSelect(null)}
              className="text-xs text-text-tertiary hover:text-text-primary shrink-0"
            >
              {t("common.remove")}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setPreviewTemplate(selectedTemplate)}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              <Eye size={12} />
              {t("common.preview")}
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-bg-primary border border-border-primary rounded-xl border-t-2 border-t-accent shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center">
                  <FileText size={14} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{previewTemplate.name}</h3>
                  {previewTemplate.subject && (
                    <p className="text-[0.625rem] text-text-tertiary">Subject: {previewTemplate.subject}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowRawHtml(!showRawHtml)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    showRawHtml ? "bg-accent/10 text-accent" : "text-text-tertiary hover:text-text-secondary"
                  }`}
                  title={showRawHtml ? "Show rendered preview" : "Show raw HTML"}
                >
                  {showRawHtml ? <Eye size={12} /> : <EyeOff size={12} />}
                  {showRawHtml ? "Rendered" : "Raw"}
                </button>
                <button
                  onClick={() => setShowVarEditor(!showVarEditor)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                    showVarEditor ? "bg-accent/10 text-accent" : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  <Variable size={12} />
                  Variables
                </button>
                <div className="w-px h-4 bg-border-secondary mx-1" />
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="text-text-tertiary hover:text-text-primary p-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Variable editor panel */}
            {showVarEditor && (
              <div className="px-4 py-2.5 border-b border-border-primary bg-bg-secondary/30 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-text-secondary">Sample Variable Values</span>
                  <button
                    onClick={resetSampleVars}
                    className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
                  >
                    <RotateCcw size={10} />
                    Reset
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {usedVariables.length === 0 ? (
                    <span className="text-xs text-text-tertiary">No variables found in this template</span>
                  ) : (
                    usedVariables.map((key) => (
                      editingVarKey === key ? (
                        <div key={key} className="flex items-center gap-1">
                          <span className="text-[0.625rem] font-mono text-accent">{key.replace(/\{|\}/g, "")}:</span>
                          <input
                            value={editingVarValue}
                            onChange={(e) => setEditingVarValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveVar();
                              if (e.key === "Escape") setEditingVarKey(null);
                            }}
                            className="w-24 px-1.5 py-0.5 text-xs bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent"
                            autoFocus
                          />
                          <button onClick={handleSaveVar} className="text-accent hover:text-accent-hover">
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          key={key}
                          onClick={() => handleEditVar(key)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.625rem] font-mono rounded-full bg-bg-tertiary border border-border-primary hover:border-accent/30 transition-colors"
                        >
                          <span className="text-text-tertiary">{key.replace(/\{|\}/g, "")}:</span>
                          <span className="text-text-primary font-medium">{sampleVars[key] ?? "—"}</span>
                        </button>
                      )
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Preview body */}
            <div className="flex-1 overflow-y-auto p-4">
              {showRawHtml ? (
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-bg-tertiary p-3 rounded-lg border border-border-primary max-h-[50vh] overflow-auto">
                  {previewTemplate.body_html}
                </pre>
              ) : (
                <iframe
                  srcDoc={getRenderedPreview(previewTemplate.body_html)}
                  className="w-full min-h-[300px] rounded-lg border border-border-primary bg-white"
                  sandbox="allow-same-origin"
                  title={t("settings.templatePreview")}
                />
              )}
            </div>

            {/* Preview footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-primary bg-bg-secondary/30 shrink-0">
              <span className="text-xs text-text-tertiary">
                {previewTemplate.usage_count > 0 ? `Used ${previewTemplate.usage_count} times` : "Not yet used"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Check size={14} />}
                  onClick={() => handleSelect(previewTemplate)}
                >
                  {t("common.select")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate button */}
      {!selectedTemplate && (
        <div className="flex items-center gap-2">
          {isAiLocked ? (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span>Generate templates with AI</span>
              <UpgradeBadge variant="pro-only" size="sm" />
            </div>
          ) : (
            <button
              onClick={() => setShowAiPrompt(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors px-2.5 py-1.5 rounded-md border border-accent/20 hover:border-accent/40 bg-accent/5"
            >
              <Sparkles size={14} />
              Generate with AI
            </button>
          )}
        </div>
      )}

      {/* AI Prompt Modal */}
      <Modal isOpen={showAiPrompt} onClose={() => { setShowAiPrompt(false); setAiError(null); }} title="Generate Template with AI" size="sm">
        <div className="p-4 space-y-3">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerateWithAi();
              }
            }}
            placeholder="Describe the email template you want..."
            className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
            disabled={aiLoading}
            autoFocus
          />
          {aiError && <p className="text-xs text-danger">{aiError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAiPrompt(false); setAiError(null); }}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              disabled={aiLoading}
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleGenerateWithAi}
              disabled={aiLoading || !aiPrompt.trim()}
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

      {/* Template grid */}
      {!selectedTemplate && (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {filtered.map((template) => (
            <button
              key={template.id}
              onClick={() => setPreviewTemplate(template)}
              className="text-left p-3 rounded-lg border border-border-primary hover:border-accent/50 hover:bg-accent/5 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-text-primary truncate flex items-center gap-1.5">
                  {template.name}
                </div>
                <span className={`text-[0.5rem] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${TYPE_COLORS[template.template_type] ?? "bg-bg-tertiary text-text-tertiary"}`}>
                  {TYPE_LABELS[template.template_type] ?? template.template_type}
                </span>
              </div>
              {template.subject && (
                <div className="text-[0.625rem] text-text-tertiary mt-0.5 truncate">{template.subject}</div>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                {template.usage_count > 0 && (
                  <span className="text-[0.5rem] text-text-tertiary">Used {template.usage_count}x</span>
                )}
                {template.origin === "ai_generated" && (
                  <span className="flex items-center gap-0.5 text-[0.5rem] text-purple-500">
                    <Sparkles size={8} /> AI
                  </span>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-6 text-center">
              <FileText size={24} className="text-text-tertiary/40 mb-2" />
              <p className="text-sm text-text-tertiary">{t("campaign.noTemplates")}</p>
              <p className="text-xs text-text-tertiary/60 mt-1">Try a different search or create one with AI</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
