import { useState, useEffect, useMemo } from "react";
import { Search, Eye, Star, Clock, Sparkles, Grid3X3, List, Play, Check, X, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { getTemplatesPaginated, countTemplatesCount, insertTemplate, type DbTemplate } from "@features/mail/db/templates";
import { usePagination } from "@shared/hooks/usePagination";
import { PaginationControls } from "@shared/components/ui/PaginationControls";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { Modal } from "@shared/components/ui/Modal";
import { Button } from "@shared/components/ui/Button";
import { TemplateDemo } from "./TemplateDemo";
import { getDemoById } from "@features/mail/constants/templateDemos";
import { generateTemplate } from "@shared/services/ai/templateGenerator";
import { useFeatureFlagStore } from "@features/settings/stores/featureFlagStore";
import { UpgradeBadge } from "@shared/components/ui/UpgradeBadge";

export interface TemplateGalleryProps {
  onSelect?: (template: DbTemplate) => void;
  filterType?: string;
  mode: "picker" | "full";
  onClose?: () => void;
  isOpen?: boolean;
}

type TypeFilter = "all" | "email" | "campaign" | "workflow" | "warmup" | "quick";
type OriginFilter = "all" | "built_in" | "user_created" | "ai_generated";
type ViewMode = "grid" | "list";

const TYPE_COLORS: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  campaign: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  workflow: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  warmup: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  quick: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

const TYPE_LABELS: Record<string, string> = {
  email: "Email",
  campaign: "Campaign",
  workflow: "Workflow",
  warmup: "Warmup",
  quick: "Quick",
};

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "email", label: "Email" },
  { key: "campaign", label: "Campaign" },
  { key: "workflow", label: "Workflow" },
  { key: "warmup", label: "Warmup" },
  { key: "quick", label: "Quick" },
];

const ORIGIN_FILTERS: { key: OriginFilter; label: string }[] = [
  { key: "all", label: "All Origins" },
  { key: "built_in", label: "Built-in" },
  { key: "user_created", label: "User" },
  { key: "ai_generated", label: "AI-generated" },
];

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function firstLinePreview(html: string): string {
  const text = stripHtml(html);
  const firstLine = text.split("\n")[0] ?? text;
  return firstLine.length > 120 ? firstLine.slice(0, 120) + "..." : firstLine;
}

export function TemplateGallery({ onSelect, filterType, mode, onClose, isOpen }: TemplateGalleryProps) {
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(filterType ? (filterType as TypeFilter) : "all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [previewTemplate, setPreviewTemplate] = useState<DbTemplate | null>(null);
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);
  const [demoSourceTemplate, setDemoSourceTemplate] = useState<DbTemplate | null>(null);
  const isAiLocked = useFeatureFlagStore((s) => s.getFeatureAccess("ai", 0) === "locked");
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filterType && filterType !== typeFilter) {
      if (TYPE_FILTERS.some((f) => f.key === filterType)) {
        setTypeFilter(filterType as TypeFilter);
      }
    }
  }, [filterType, typeFilter]);

  // Paginated template loading
  const paginationOptions = useMemo(() => ({
    fetchFn: async ({ limit, offset }: { limit: number; offset: number }) => {
      if (!activeAccountId) return { items: [], total: 0 };
      const type = typeFilter === "all" ? null : typeFilter;
      const origin = originFilter === "all" ? null : originFilter;
      const [items, total] = await Promise.all([
        getTemplatesPaginated(activeAccountId, limit, offset, type, origin),
        countTemplatesCount(),
      ]);
      return { items, total };
    },
    pageSize: viewMode === "grid" ? 25 : 50,
    deps: [activeAccountId, typeFilter, originFilter, viewMode],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeAccountId, typeFilter, originFilter, viewMode]);

  const {
    items: templates,
    total: totalTemplates,
    currentPage: tmplPage,
    totalPages: tmplTotalPages,
    loading,
    goToPage: goToTmplPage,
    reset: resetTemplates,
    setPageSize: setTmplPageSize,
  } = usePagination(paginationOptions);

  const filtered = useMemo(() => {
    let list = templates;
    if (originFilter !== "all") {
      list = list.filter((t) => t.origin === originFilter);
    }
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(
        (t) => fuzzyMatch(t.name, q) || fuzzyMatch(t.body_html, q) || (t.subject ? fuzzyMatch(t.subject, q) : false),
      );
    }
    return list;
  }, [templates, originFilter, search]);

  const handleUse = (tmpl: DbTemplate) => {
    onSelect?.(tmpl);
    onClose?.();
  };

  const handleCustomize = (tmpl: DbTemplate) => {
    window.dispatchEvent(new CustomEvent("smemaster-edit-template", { detail: { templateId: tmpl.id } }));
  };

  const handleOpenDemo = (demoId: string, sourceTemplate?: DbTemplate) => {
    setActiveDemoId(demoId);
    setDemoSourceTemplate(sourceTemplate ?? null);
  };

  const activeDemo = activeDemoId ? getDemoById(activeDemoId) : null;

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim() || aiLoading || !activeAccountId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateTemplate(aiPrompt.trim());
      await insertTemplate({
        accountId: activeAccountId,
        name: result.name,
        subject: result.name,
        bodyHtml: result.html,
        shortcut: null,
        origin: "ai_generated",
      });
      setAiPrompt("");
      setShowAiPrompt(false);
      // Reload templates to include the new AI-generated one
      await resetTemplates();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-border-primary">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, subject, or content..."
            className="w-full pl-9 pr-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-secondary overflow-x-auto shrink-0">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`shrink-0 px-3 py-1 text-xs rounded-full transition-colors ${
              typeFilter === f.key
                ? "bg-accent/15 text-accent font-medium"
                : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "text-accent bg-accent/10" : "text-text-tertiary hover:text-text-secondary"}`}
            title="Grid view"
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "text-accent bg-accent/10" : "text-text-tertiary hover:text-text-secondary"}`}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Origin filter */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border-secondary">
        {ORIGIN_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setOriginFilter(f.key)}
            className={`text-[0.625rem] px-2 py-0.5 rounded-full transition-colors ${
              originFilter === f.key
                ? "bg-bg-tertiary text-text-primary font-medium"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* AI Generate button */}
      <div className="px-4 py-2 border-b border-border-secondary">
        {isAiLocked ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary">Generate templates with AI</span>
            <UpgradeBadge variant="pro-only" size="sm" />
          </div>
        ) : showAiPrompt ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerateWithAi();
                }
                if (e.key === "Escape") {
                  setShowAiPrompt(false);
                  setAiPrompt("");
                  setAiError(null);
                }
              }}
              placeholder="Describe the template you want..."
              className="flex-1 px-2.5 py-1.5 text-xs bg-bg-tertiary border border-border-primary rounded outline-none focus:border-accent text-text-primary placeholder:text-text-tertiary"
              disabled={aiLoading}
              autoFocus
            />
            <button
              onClick={handleGenerateWithAi}
              disabled={aiLoading || !aiPrompt.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {aiLoading ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={() => { setShowAiPrompt(false); setAiPrompt(""); setAiError(null); }}
              className="text-text-tertiary hover:text-text-primary"
              aria-label="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAiPrompt(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            <Sparkles size={14} />
            Generate with AI
          </button>
        )}
        {aiError && (
          <p className="text-xs text-danger mt-1">{aiError}</p>
        )}
      </div>

      {/* Template grid or list */}
      <div className="flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle size={32} className="text-danger/60 mb-3" />
            <p className="text-sm text-text-primary font-medium mb-1">Failed to load templates</p>
            <p className="text-xs text-text-tertiary mb-4 max-w-sm">{error}</p>
            <button
              onClick={() => {
                setError(null);
                resetTemplates();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-xl p-4 animate-pulse">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-4 w-16 bg-bg-tertiary rounded-full" />
                  <div className="h-3 w-6 bg-bg-tertiary rounded" />
                </div>
                <div className="h-4 w-3/4 bg-bg-tertiary rounded mb-2" />
                <div className="h-3 w-full bg-bg-tertiary rounded mb-1" />
                <div className="h-3 w-2/3 bg-bg-tertiary rounded mb-3" />
                <div className="flex gap-2 mt-3">
                  <div className="h-6 flex-1 bg-bg-tertiary rounded" />
                  <div className="h-6 w-16 bg-bg-tertiary rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles size={32} className="text-text-tertiary mb-3" />
            <p className="text-sm text-text-secondary font-medium mb-1">
              {search ? "No templates match your search" : "No templates yet"}
            </p>
            <p className="text-xs text-text-tertiary">
              {search ? "Try a different search term or filter" : "Create your first template in Settings"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                onUse={handleUse}
                onPreview={setPreviewTemplate}
                onCustomize={handleCustomize}
                onOpenDemo={handleOpenDemo}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tmpl) => (
              <TemplateListItem
                key={tmpl.id}
                template={tmpl}
                onUse={handleUse}
                onPreview={setPreviewTemplate}
                onCustomize={handleCustomize}
                onOpenDemo={handleOpenDemo}
              />
            ))}
          </div>
        )}

        {/* Pagination — only when there are items to show AND total > 0 */}
        {filtered.length > 0 && totalTemplates > 0 && (
          <PaginationControls
            currentPage={tmplPage}
            totalPages={tmplTotalPages}
            pageSize={viewMode === "grid" ? 25 : 50}
            totalItems={totalTemplates}
            onPageChange={goToTmplPage}
            onPageSizeChange={setTmplPageSize}
          />
        )}
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="absolute inset-0 bg-black/40 glass-backdrop" />
          <div className="relative bg-bg-primary border border-border-primary rounded-xl glass-modal w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">{previewTemplate.name}</h3>
                <span className={`text-[0.625rem] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[previewTemplate.template_type] ?? "bg-bg-tertiary text-text-tertiary"}`}>
                  {TYPE_LABELS[previewTemplate.template_type] ?? previewTemplate.template_type}
                </span>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-text-tertiary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {previewTemplate.subject && (
                <div className="mb-3 pb-3 border-b border-border-secondary">
                  <span className="text-[0.625rem] text-text-tertiary uppercase tracking-wider font-medium">Subject</span>
                  <p className="text-sm text-text-primary mt-0.5">{previewTemplate.subject}</p>
                </div>
              )}
              <iframe
                srcDoc={previewTemplate.body_html}
                className="w-full min-h-[300px] rounded-lg border border-border-primary bg-bg-primary"
                sandbox="allow-same-origin"
                title={previewTemplate.name}
              />
            </div>
            <div className="px-4 py-3 border-t border-border-primary flex items-center justify-between">
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <Clock size={12} />
                Used {previewTemplate.usage_count} times
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleUse(previewTemplate)}>
                  Use Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demo overlay */}
      {activeDemo && (
        <TemplateDemo
          demo={activeDemo}
          onClose={() => { setActiveDemoId(null); setDemoSourceTemplate(null); }}
          onSelect={onSelect && mode === "picker" ? (t) => {
            // Find the template from the list that matches the picker info
            const tmpl = templates.find((tpl) => tpl.id === t.id);
            if (tmpl) {
              onSelect(tmpl);
              onClose?.();
            }
          } : undefined}
          pickerTemplate={demoSourceTemplate ? { id: demoSourceTemplate.id, name: demoSourceTemplate.name } : undefined}
        />
      )}
    </div>
  );

  if (mode === "picker") {
    return (
      <Modal isOpen={isOpen ?? true} onClose={() => onClose?.()} title="Template Gallery" width="w-[800px]" panelClassName="max-h-[85vh] flex flex-col">
        {content}
      </Modal>
    );
  }

  return (
    <div className="glass-panel rounded-xl border border-border-primary overflow-hidden h-full flex flex-col">
      {content}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
  onPreview,
  onCustomize,
  onOpenDemo,
}: {
  template: DbTemplate;
  onUse: (tmpl: DbTemplate) => void;
  onPreview: (tmpl: DbTemplate) => void;
  onCustomize: (tmpl: DbTemplate) => void;
  onOpenDemo: (demoId: string) => void;
}) {
  const previewHtml = firstLinePreview(template.body_html);
  const demos = getDemoById(`demo-${template.template_type}`);

  return (
    <div className="glass-panel rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer group border border-border-primary hover:border-accent/30">
      <div className="flex items-start justify-between mb-2">
        <span className={`text-[0.625rem] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[template.template_type] ?? "bg-bg-tertiary text-text-tertiary"}`}>
          {TYPE_LABELS[template.template_type] ?? template.template_type}
        </span>
        <div className="flex items-center gap-1">
          {template.is_favorite === 1 && <Star size={12} className="text-amber-400 fill-amber-400" />}
          {template.origin === "ai_generated" && <Sparkles size={12} className="text-purple-400" />}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-text-primary mb-1 truncate">{template.name}</h3>

      {template.subject && (
        <p className="text-[0.625rem] text-text-tertiary mb-1 truncate">{template.subject}</p>
      )}

      <div className="text-xs text-text-tertiary/60 line-clamp-2 mb-3 leading-relaxed font-mono">
        {previewHtml}
      </div>

      {template.usage_count > 0 && (
        <div className="flex items-center gap-2 text-[0.625rem] text-text-tertiary mb-2">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            Used {template.usage_count} times
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-secondary">
        <button
          onClick={(e) => { e.stopPropagation(); onUse(template); }}
          className="flex-1 text-xs font-medium px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
        >
          Use
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(template); }}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-hover rounded-md transition-colors"
        >
          <Eye size={12} />
          Preview
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onCustomize(template); }}
          className="text-xs px-2.5 py-1.5 text-text-tertiary hover:text-text-secondary bg-bg-tertiary hover:bg-bg-hover rounded-md transition-colors"
        >
          Customize
        </button>
        {demos && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDemo(demos.id); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors"
            title="See Demo"
          >
            <Play size={10} />
            Demo
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateListItem({
  template,
  onUse,
  onPreview,
  onCustomize,
  onOpenDemo,
}: {
  template: DbTemplate;
  onUse: (tmpl: DbTemplate) => void;
  onPreview: (tmpl: DbTemplate) => void;
  onCustomize: (tmpl: DbTemplate) => void;
  onOpenDemo: (demoId: string) => void;
}) {
  const bodyPreview = stripHtml(template.body_html).slice(0, 100);
  const demos = getDemoById(`demo-${template.template_type}`);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border-primary hover:border-accent/30 hover:bg-bg-hover transition-all group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[0.5rem] font-medium px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[template.template_type] ?? "bg-bg-tertiary text-text-tertiary"}`}>
            {TYPE_LABELS[template.template_type] ?? template.template_type}
          </span>
          <span className="text-sm font-medium text-text-primary truncate">{template.name}</span>
          {template.is_favorite === 1 && <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />}
        </div>
        <p className="text-[0.625rem] text-text-tertiary truncate mt-0.5">{bodyPreview}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onUse(template)} className="px-2 py-1 text-xs font-medium text-white bg-accent rounded hover:bg-accent-hover transition-colors">
          <Check size={12} />
        </button>
        <button onClick={() => onPreview(template)} className="p-1.5 text-text-tertiary hover:text-text-secondary rounded hover:bg-bg-tertiary transition-colors" title="Preview">
          <Eye size={12} />
        </button>
        <button onClick={() => onCustomize(template)} className="p-1.5 text-text-tertiary hover:text-text-secondary rounded hover:bg-bg-tertiary transition-colors" title="Customize">
          <Sparkles size={12} />
        </button>
        {demos && (
          <button onClick={() => onOpenDemo(demos.id)} className="p-1.5 text-amber-500 hover:text-amber-400 rounded hover:bg-amber-500/10 transition-colors" title="Demo">
            <Play size={12} />
          </button>
        )}
      </div>
      {template.usage_count > 0 && (
        <span className="text-[0.5rem] text-text-tertiary shrink-0 flex items-center gap-1">
          <Clock size={10} />
          {template.usage_count}
        </span>
      )}
    </div>
  );
}


