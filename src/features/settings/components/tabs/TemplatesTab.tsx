import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, FileText, BookOpen, Download, Plus } from "lucide-react";
import { TemplateManager } from "@features/settings/components/TemplateManager";
import { AiTemplateGenerateModal } from "@features/settings/components/AiTemplateGenerateModal";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { Button } from "@shared/components/ui/Button";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import {
  insertTemplate,
  countTemplatesCount,
  seedAllPresets,
  seedCampaignTemplates,
} from "@features/mail/db/templates";
import { notify } from "@shared/services/notifications/toastHelper";
import { navigateToSettings } from "@/router/navigate";
import type { GeneratedTemplate } from "@shared/services/ai/templateGenerator";

/* ─── Demo preset previews ─── */

interface DemoPreset {
  name: string;
  subject: string;
  category: string;
  icon: string;
}

const DEMO_PRESETS: DemoPreset[] = [
  { name: "Follow-Up", subject: "Checking in", category: "follow_up", icon: "↪" },
  { name: "Thank You", subject: "Thank you", category: "customer_success", icon: "✓" },
  { name: "Meeting Request", subject: "Meeting request", category: "internal", icon: "📅" },
  { name: "Product Launch", subject: "Introducing our latest product", category: "marketing", icon: "🚀" },
];

const CATEGORY_COLORS: Record<string, string> = {
  follow_up: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  customer_success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  internal: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  marketing: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  sales: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  transactional: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  personal: "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

/* ─── Demo template card ─── */

function DemoTemplateCard({ preset }: { preset: DemoPreset }) {
  const catColor = CATEGORY_COLORS[preset.category] ?? "bg-bg-tertiary text-text-tertiary border-border-primary";
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border-primary bg-bg-primary/50 hover:bg-bg-hover/30 transition-colors">
      <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center text-sm shrink-0">
        {preset.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-primary">{preset.name}</div>
        <div className="text-xs text-text-tertiary truncate mt-0.5">{preset.subject}</div>
        <span className={`inline-block mt-1.5 text-[0.5rem] px-1.5 py-0.5 rounded-full border ${catColor}`}>
          {preset.category.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}

/* ─── TemplatesTab ─── */

export default function TemplatesTab() {
  const { t } = useTranslation();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [showAiModal, setShowAiModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const count = await countTemplatesCount();
      setTemplateCount(count);
    } catch {
      setTemplateCount(0);
    } finally {
      setLoadingCount(false);
    }
  }, []);

  useEffect(() => {
    loadCount();
  }, [loadCount, refreshKey]);

  const handleAiTemplateSave = useCallback(async (tmpl: GeneratedTemplate) => {
    if (!activeAccountId) {
      notify("Templates", "Please select an account first.");
      return;
    }
    await insertTemplate({
      accountId: activeAccountId,
      name: tmpl.name,
      subject: tmpl.name,
      bodyHtml: tmpl.html,
      shortcut: null,
      origin: "ai_generated",
    });
    setRefreshKey((k) => k + 1);
    notify("Templates", "AI template saved.");
  }, [activeAccountId]);

  const handleSeedDemos = useCallback(async () => {
    if (!activeAccountId) {
      notify("Templates", "Please select an account first.");
      return;
    }
    setSeeding(true);
    try {
      await seedAllPresets();
      await seedCampaignTemplates();
      setRefreshKey((k) => k + 1);
      notify("Templates", "Demo templates loaded successfully.");
    } catch (err) {
      console.error("Failed to seed templates:", err);
      notify("Templates", "Failed to load demo templates.");
    } finally {
      setSeeding(false);
    }
  }, [activeAccountId]);

  const hasAccount = !!activeAccountId;
  const isEmpty = templateCount === 0;

  return (
    <div className="flex flex-col gap-4 md:gap-6 max-w-3xl">
      {/* ── Header: stats + actions ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <FileText size={16} className="text-text-tertiary" />
          {loadingCount ? (
            <span className="text-xs text-text-tertiary">Loading...</span>
          ) : (
            <span>
              <strong className="text-text-primary">{templateCount}</strong>{" "}
              {templateCount === 1 ? "template" : "templates"} in library
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEmpty && hasAccount && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSeedDemos}
              disabled={seeding}
              icon={seeding ? undefined : <Download size={14} />}
              className="bg-bg-tertiary text-text-primary border border-border-primary"
            >
              {seeding ? "Loading..." : "Load Demo Templates"}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/5 hover:bg-accent/10 rounded-lg border border-accent/20 hover:border-accent/30 transition-colors"
          >
            <Sparkles size={12} />
            Generate with AI
          </button>
        </div>
      </div>

      {/* ── No account state ── */}
      {!hasAccount && (
        <SettingGroup title="No Account Selected" description="You need to add an email account before creating or managing templates.">
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => navigateToSettings("accounts")}
            >
              Add Account
            </Button>
          </div>
        </SettingGroup>
      )}

      {/* ── Empty library: show demo presets + seed button ── */}
      {isEmpty && hasAccount && (
        <SettingGroup
          title="Getting Started"
          description="Your template library is empty. Load ready-made demo templates to see examples, or create your own from scratch below."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {DEMO_PRESETS.map((preset) => (
              <DemoTemplateCard key={preset.name} preset={preset} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSeedDemos}
              disabled={seeding}
              icon={seeding ? undefined : <BookOpen size={14} />}
            >
              {seeding ? "Loading..." : `Seed ${DEMO_PRESETS.length}+ Demo Templates`}
            </Button>
            <span className="text-[0.625rem] text-text-tertiary">
              Includes email, campaign, warmup, and workflow presets
            </span>
          </div>
        </SettingGroup>
      )}

      {/* ── Template Manager (full CRUD) ── */}
      {hasAccount && (
        <SettingGroup title={t("search.templates")}>
          <TemplateManager key={refreshKey} />
          <HelpCard
            items={[
              { type: "why", text: "Templates save time by reusing common email structures with variable placeholders for personalized content." },
              { type: "how", text: "Create templates with {{variable}} placeholders. When applied, you're prompted to fill in the variables before sending." },
              { type: "when", text: "Ideal for repetitive emails like invoices, onboarding messages, status updates, and follow-ups." },
              { type: "tip", text: "Use the AI generation button to quickly create well-written templates from a simple description of what you need." },
            ]}
          />
        </SettingGroup>
      )}

      {/* ── AI Generation Modal ── */}
      <AiTemplateGenerateModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onInsert={handleAiTemplateSave}
        onSave={handleAiTemplateSave}
      />
    </div>
  );
}
