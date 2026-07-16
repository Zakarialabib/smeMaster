import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Sparkles,
  Send,
  Settings2,
  Signature,
  FileText,
  MessageSquare,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@shared/utils/cn";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { notify } from "@shared/services/notifications/toastHelper";
import { getSetting, setSetting } from "@features/settings/db/settings";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { insertSignature } from "@features/mail/db/signatures";
import { SignatureEditor } from "@features/settings/components/SignatureEditor";
import { TemplateManager } from "@features/settings/components/TemplateManager";
import { QuickReplyEditor } from "@features/settings/components/QuickReplyEditor";
import { AiSignatureGenerateModal } from "@features/settings/components/AiSignatureGenerateModal";
import type { GeneratedSignature } from "@shared/services/ai/signatureGenerator";
import { ContentQualityAnalyzer } from "@features/settings/components/ContentQualityAnalyzer";
import { HelpCard, InlineTooltip } from "@features/settings/components/HelpCard";
import { usePlatform } from "@shared/hooks/usePlatform"
import { SettingGroup, SettingRow, ToggleRow, ButtonGroup } from "@features/settings/components/SettingsHelpers";

/* ─── Undo Send Delay Slider ─── */

function UndoSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <span className="text-xs text-text-tertiary w-6 text-end tabular-nums">{value}s</span>
      <input
        type="range"
        min={5}
        max={30}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="
          w-32 h-1.5 rounded-full appearance-none cursor-pointer
          bg-border-secondary accent-accent
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:duration-150
          [&::-webkit-slider-thumb]:hover:scale-110
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        "
        aria-label="Undo send delay in seconds"
      />
      <div className="flex items-center gap-1 text-[0.625rem] text-text-tertiary">
        <span className="text-text-tertiary/50">5s</span>
        <span className="text-text-tertiary/30">—</span>
        <span className="text-text-tertiary/50">30s</span>
      </div>
    </div>
  );
}

/* ─── Live Preview — mock email with realistic background ─── */

function LivePreview({ undoSendDelay, showSignature }: { undoSendDelay: number; showSignature: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-primary overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
      {/* Email header bar */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border-secondary bg-gray-50 dark:bg-slate-800/60">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs font-medium text-text-primary">me@example.com</span>
        </div>
        <span className="text-[0.625rem] text-text-tertiary ltr:ml-auto rtl:mr-auto">to: recipient@example.com</span>
      </div>
      {/* Email body — white background mimics actual email render */}
      <div className="p-5 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-semibold text-accent shrink-0">
            JD
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">John Doe</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Re: Project Update</div>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          Hi Team, just a quick update on the project timeline. I've completed the initial review and everything looks on track for the Q2 release.
        </p>
        {showSignature && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
            <p className="text-xs text-gray-400">—</p>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">John Doe</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Product Lead, SME Master</p>
          </div>
        )}
        {undoSendDelay > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-accent/5 rounded-lg px-3.5 py-2.5 border border-accent/10">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            <span>{t("settings.livePreviewUndoAvailable", "Undo available")} — <strong className="font-semibold text-accent">{undoSendDelay}s</strong> {t("settings.livePreviewRemaining", "remaining")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Setup Steps ──────────────────────────────────────────────── */

const SETUP_STEPS: { id: string; icon: typeof Send }[] = [
  { id: "sending", icon: Send },
  { id: "behavior", icon: Settings2 },
  { id: "signatures", icon: Signature },
  { id: "templates", icon: FileText },
  { id: "quick-replies", icon: MessageSquare },
  { id: "content-quality", icon: Zap },
];

/* ─── Setup step i18n helpers (labels reuse existing keys) ─────── */

function setupStepLabel(id: string, t: TFunction): string {
  switch (id) {
    case "sending":
      return t("settings.sending");
    case "behavior":
      return t("settings.behavior");
    case "signatures":
      return t("settings.signatures");
    case "templates":
      return t("search.templates");
    case "quick-replies":
      return t("quickReply.title");
    case "content-quality": return t("settings.setupContentQuality", "Content Quality");
    default:
      return id;
  }
}

function setupStepDescription(id: string, t: TFunction): string {
  switch (id) {
    case "sending":
      return t("settings.setup.sending.desc", "Undo delay & send options");
    case "behavior":
      return t("settings.setup.behavior.desc", "Reply mode & read tracking");
    case "signatures":
      return t("settings.setup.signatures.desc", "Add your email signature");
    case "templates":
      return t("settings.setup.templates.desc", "Save email templates");
    case "quick-replies":
      return t("settings.setup.quickReplies.desc", "Pre-written responses");
    case "content-quality":
      return t("settings.setup.contentQuality.desc", "AI-powered content check");
    default:
      return "";
  }
}

/* ─── Stats Card ─── */

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone?: "accent" | "success" | "warning" | "neutral";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
        tone === "accent" && "bg-accent/5 border-accent/20",
        tone === "success" && "bg-success/5 border-success/20",
        tone === "warning" && "bg-warning/5 border-warning/20",
        tone === "neutral" && "bg-bg-tertiary/40 border-border/40",
      )}
    >
      <div className="p-2 rounded-lg bg-white/50">
        <Icon
          className={cn(
            "w-4 h-4",
            tone === "accent" && "text-accent",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "neutral" && "text-text-tertiary",
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-sm font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

/* ─── ComposingSettings Component ─── */

export default function ComposingTab() {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobileDevice = screen.isMobile;
  const defaultReplyMode = useLayoutStore((s) => s.defaultReplyMode);
  const setDefaultReplyMode = useLayoutStore((s) => s.setDefaultReplyMode);
  const markAsReadBehavior = useLayoutStore((s) => s.markAsReadBehavior);
  const setMarkAsReadBehavior = useLayoutStore((s) => s.setMarkAsReadBehavior);
  const sendAndArchive = useLayoutStore((s) => s.sendAndArchive);
  const setSendAndArchive = useLayoutStore((s) => s.setSendAndArchive);
  const [undoSendDelay, setUndoSendDelay] = useState(5);
  const sectionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const delay = await getSetting("undo_send_delay_seconds");
      setUndoSendDelay(Number(delay ?? "5"));
    }
    load();
  }, []);

  const handleUndoDelayChange = useCallback(async (value: number) => {
    setUndoSendDelay(value);
    await setSetting("undo_send_delay_seconds", String(value));
    notify(t("settings.tabs.composing"), `${t("settings.undoSendDelaySet", "Undo send delay set to")} ${value}s.`);
  }, []);

  // AI generation modals state
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigRefreshKey, setSigRefreshKey] = useState(0);

  const handleSigGenerated = useCallback(async (_sig: GeneratedSignature) => {
    if (!activeAccountId) {
      notify(t("settings.signatures"), t("settings.signaturesSelectAccountFirst", "Please select an account first."));
      return;
    }
    await insertSignature({
      accountId: activeAccountId,
      name: _sig.name,
      bodyHtml: _sig.html,
      isDefault: false,
    });
    setSigRefreshKey((k) => k + 1);
    notify(t("settings.signatures"), t("settings.signaturesSavedToast", "AI signature saved to your account."));
  }, [activeAccountId]);

  // ── Setup step tracking ─────────────────────────────────
  const [activeStep, setActiveStep] = useState<string>("sending");
  const [setupExpanded, setSetupExpanded] = useState(true);

  const scrollToSection = useCallback((sectionId: string) => {
    setActiveStep(sectionId);
    const el = document.getElementById(`composing-section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const stepIndex = SETUP_STEPS.findIndex((s) => s.id === activeStep);
  const progressPct = ((stepIndex + 1) / SETUP_STEPS.length) * 100;

  // ── Render ────────────────────────────────────────────
  return (
    <div ref={sectionsRef} className="space-y-6">
      {/* ── Header Stats Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Clock}
          label={t("settings.stat.undoSend", "Undo Send")}
          value={`${undoSendDelay}s`}
          tone={undoSendDelay > 0 ? "success" : "warning"}
        />
        <StatCard
          icon={Settings2}
          label={t("settings.stat.replyMode", "Reply Mode")}
          value={defaultReplyMode === "replyAll" ? t("actionBar.replyAll") : t("actionBar.reply")}
          tone="accent"
        />
        <StatCard
          icon={Layers}
          label={t("settings.stat.markAsRead", "Mark as Read")}
          value={markAsReadBehavior === "instant" ? t("settings.instantly") : markAsReadBehavior === "2s" ? t("settings.after2s") : t("settings.manually")}
          tone={markAsReadBehavior !== "manual" ? "success" : "neutral"}
        />
        <StatCard
          icon={Send}
          label={t("settings.stat.sendArchive", "Send & Archive")}
          value={sendAndArchive ? t("common.enabled") : t("common.disabled")}
          tone={sendAndArchive ? "accent" : "neutral"}
        />
      </div>

      {/* ── Setup Progress Stepper ─────────────────────────────────── */}
      <div className="bg-accent/5 border border-accent/12 rounded-xl p-4">
        <button
          type="button"
          onClick={() => setSetupExpanded(!setupExpanded)}
          className="flex items-center justify-between w-full text-start"
        >
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">
            {t("settings.composing.setupGuide", "Setup Guide")}
          </span>
          <span className="text-xs text-text-tertiary ltr:ms-2 rtl:me-2">
            {t("settings.composing.step", "Step")} {stepIndex + 1} {t("settings.composing.of", "of")} {SETUP_STEPS.length}
          </span>
          </div>
          {setupExpanded ? <ChevronDown size={16} className="text-text-tertiary" /> : <ChevronRight size={16} className="text-text-tertiary" />}
        </button>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {setupExpanded && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {SETUP_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = activeStep === step.id;
              const isCompleted = idx < stepIndex;
              const isPending = idx > stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => scrollToSection(step.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
                    isActive && "bg-accent text-white shadow-sm border-accent scale-[1.02]",
                    isCompleted && "bg-success/10 text-success border-success/20",
                    isPending && "bg-bg-secondary text-text-tertiary border-border-primary/50 hover:text-text-primary hover:bg-bg-hover",
                  )}
                >
                  <StepIcon size={18} />
                  <span className="text-[10px] font-semibold leading-tight">{setupStepLabel(step.id, t)}</span>
                  <span className="text-[8px] opacity-70 leading-tight hidden sm:block">{setupStepDescription(step.id, t)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Live Preview — shows how settings affect composed emails ── */}
      {!isMobileDevice && (
        <SettingGroup title={t("settings.livePreview", "Live Preview")} description={t("settings.livePreviewDesc", "See how your email renders with the current composing settings. Toggle options below to reflect changes in real time.")}>
          <LivePreview undoSendDelay={undoSendDelay} showSignature={true} />
        </SettingGroup>
      )}

      {/* ── Sending Section ── */}
      <div id="composing-section-sending">
        <SettingGroup
          title={t('settings.sending')}
          description={t("settings.sendingDesc", "Configure how emails are dispatched, including undo delay and archive behavior.")}
        >
          {/* Undo Send Delay — slider + quick-pick segmented control */}
          <SettingRow label={t('settings.undoSendDelay')}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <UndoSlider value={undoSendDelay} onChange={handleUndoDelayChange} />
                <InlineTooltip text="The time window after sending during which you can recall the email. Held in the local Tauri cache before dispatch." />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary">{t('settings.undoSendQuickPick', 'Quick pick')}</span>
                <ButtonGroup
                  value={String(undoSendDelay)}
                  onChange={(v) => handleUndoDelayChange(Number(v))}
                  options={[
                    { value: '5', label: '5s' },
                    { value: '10', label: '10s' },
                    { value: '20', label: '20s' },
                    { value: '30', label: '30s' },
                  ]}
                />
              </div>
            </div>
          </SettingRow>
          {/* Education: Undo Send */}
          <HelpCard
            items={[
              { type: "why", text: t("settings.help.sending.why", "Prevents accidental sends and lets you catch mistakes before the email reaches the recipient's inbox.") },
              { type: "how", text: t("settings.help.sending.how", "The email is held in the local Tauri cache for the selected duration before being dispatched to the SMTP server.") },
              { type: "when", text: t("settings.help.sending.when", "Best for high-stakes business communication, client proposals, or when composing on mobile with autocorrect risks.") },
            ]}
          />
          {/* Send and Archive */}
          <ToggleRow
            label={t('settings.sendAndArchive')}
            description={t('settings.sendAndArchiveDescription')}
            checked={sendAndArchive}
            onToggle={() => setSendAndArchive(!sendAndArchive)}
          />
        </SettingGroup>
      </div>

      {/* ── Behavior Section ── */}
      <div id="composing-section-behavior">
        <SettingGroup
          title={t('settings.behavior')}
          description={t("settings.behaviorDesc", "Control default reply mode, mark-as-read behavior, and reading workflow preferences.")}
        >
          <SettingRow label={t('settings.defaultReplyAction')}>
            <div className="flex items-center gap-2">
              <ButtonGroup
                value={defaultReplyMode}
                onChange={(v) => setDefaultReplyMode(v as "reply" | "replyAll")}
                options={[
                  { value: "reply", label: t('actionBar.reply') },
                  { value: "replyAll", label: t('actionBar.replyAll') },
                ]}
              />
              <InlineTooltip text="Choose whether clicking Reply defaults to the individual sender or all recipients on the thread." />
            </div>
          </SettingRow>
          <SettingRow label={t('settings.markAsRead')}>
            <div className="flex items-center gap-2">
              <ButtonGroup
                value={markAsReadBehavior}
                onChange={(v) => setMarkAsReadBehavior(v as "instant" | "2s" | "manual")}
                options={[
                  { value: "instant", label: t('settings.instantly') },
                  { value: "2s", label: t('settings.after2s') },
                  { value: "manual", label: t('settings.manually') },
                ]}
              />
              <InlineTooltip text="Control when messages are marked as read: instantly when opened, after a short delay, or only when you manually mark them." />
            </div>
          </SettingRow>
          <HelpCard
            collapsible
            items={[
              { type: "why", text: t("settings.help.behavior.why", "Behavior settings control how the app responds to your actions — default reply mode saves clicks, mark-as-read behavior keeps your inbox tidy automatically.") },
              { type: "how", text: t("settings.help.behavior.how", "Reply mode sets whether Reply goes to sender only or all recipients. Mark-as-read can be instant, delayed, or manual depending on your reading workflow.") },
              { type: "when", text: t("settings.help.behavior.when", "Set reply mode if you frequently need to reply-all. Choose instant read marking for rapid triage, or manual for careful inbox management.") },
            ]}
          />
        </SettingGroup>
      </div>

      {/* ── Signatures Section ── */}
      <div id="composing-section-signatures">
        <SettingGroup title={t('settings.signatures')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">
              {t('settings.signatures')}
            </span>
            <button
              type="button"
              onClick={() => setShowSigModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-accent bg-accent/5 hover:bg-accent/10 rounded-lg border border-accent/20 hover:border-accent/30 transition-colors"
            >
              <Sparkles size={12} />
              {t("settings.signaturesGenerateAi", "Generate with AI")}
            </button>
          </div>
          <HelpCard
            items={[
              { type: "why", text: t("settings.help.signatures.why", "Signatures provide professional consistency and can include legal disclaimers, contact info, and brand elements.") },
              { type: "how", text: t("settings.help.signatures.how", "Signatures are automatically appended to new emails and replies. You can create multiple signatures and set defaults per account.") },
              { type: "when", text: t("settings.help.signatures.when", "Use for all business correspondence, client emails, and any communication requiring a professional footer.") },
            ]}
          />
          <div className="mt-4">
            <SignatureEditor key={sigRefreshKey} />
          </div>
        </SettingGroup>
      </div>

      {/* AI Signature Generation Modal */}
      <AiSignatureGenerateModal
        isOpen={showSigModal}
        onClose={() => setShowSigModal(false)}
        onInsert={handleSigGenerated}
        onSave={handleSigGenerated}
      />

      {/* ── Templates Section ── */}
      <div id="composing-section-templates">
        <SettingGroup
          title={t("search.templates")}
          description={t("search.templateDesc", "Create reusable email templates with variable placeholders for consistent messaging.")}
        >
          <HelpCard
            items={[
              { type: "why", text: t("settings.help.templates.why", "Templates save time by reusing common email structures with variable placeholders for personalized content.") },
              { type: "how", text: t("settings.help.templates.how", "Create templates with {{variable}} placeholders. When applied, you're prompted to fill in the variables before sending.") },
              { type: "when", text: t("settings.help.templates.when", "Ideal for repetitive emails like invoices, onboarding messages, status updates, and follow-ups.") },
            ]}
          />
          <div className="mt-4">
            <TemplateManager />
          </div>
        </SettingGroup>
      </div>

      {/* ── Quick Replies Section ── */}
      <div id="composing-section-quick-replies">
        <SettingGroup
          title={t("quickReply.title")}
          description={t("quickReply.description", "Save pre-written responses for common inquiries to respond faster.")}
        >
          <HelpCard
            items={[
              { type: "why", text: t("settings.help.quickReplies.why", "Quick replies let you respond to common inquiries with pre-written answers, saving keystrokes and ensuring consistency.") },
              { type: "how", text: t("settings.help.quickReplies.how", "Saved snippets appear in the quick reply bar. Click to insert them into your reply with a single tap.") },
              { type: "when", text: t("settings.help.quickReplies.when", "Perfect for support teams, sales responses, and any situation where you answer the same questions repeatedly.") },
            ]}
          />
          <p className="text-xs text-text-tertiary mt-4 mb-3">
            {t('settings.quickRepliesDescription')}
          </p>
          <QuickReplyEditor />
        </SettingGroup>
      </div>

      {/* ── Content Quality Section ── */}
      <div id="composing-section-content-quality">
        <SettingGroup
          title={t('settings.contentQualityTitle')}
          description={t("settings.contentQuality.desc", "Write better emails with AI-powered analysis, spam detection, and readability scoring.")}
        >
          <HelpCard
            items={[
              { type: "why", text: t("settings.help.contentQuality.why", "Content quality analysis helps you write clearer, more effective emails by catching readability issues, spam triggers, and tone mismatches before you send.") },
              { type: "how", text: t("settings.help.contentQuality.how", "The analyzer checks your composition in real time: readability grade, spam score, sentiment, and engagement predictions.") },
              { type: "when", text: t("settings.help.contentQuality.when", "Enable for all outbound email or toggle per-message from the composer toolbar. Review suggestions before hitting send.") },
            ]}
          />
          <div className="mt-4">
            <ContentQualityAnalyzer />
          </div>
        </SettingGroup>
      </div>
    </div>
  );
}
