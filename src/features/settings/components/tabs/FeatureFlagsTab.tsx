/**
 * Feature Flags Settings Tab — Testing & Debug UI
 *
 * Provides a live view of all feature flags grouped by category,
 * with the ability to toggle between Basic and Pro tiers and override
 * usage counts for testing progressive disclosure behavior.
 *
 * Design: Award-wining UI with clear visual hierarchy, status badges,
 * usage progress bars, and smooth micro-interactions.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Settings, UserCircle, Users, PenLine, FileText, Bell, Clock, Keyboard,
  Sparkles, Filter, GitBranch, Lock, ShieldCheck, HardDrive, Smartphone,
  Activity, BarChart3, ClipboardCheck, FileCheck, Globe, Ban, MailX, Thermometer,
  Zap, ChevronDown, ChevronRight, Search, RotateCcw, type LucideIcon,
} from "lucide-react";
import { useFeatureFlagStore, type FeatureUsage } from "@features/settings/stores/featureFlagStore";
import {
  FEATURE_FLAGS, type FeatureFlag, type Tier, setDevProMode, isDevProMode,
} from "@/constants/featureFlags";
import { HelpCard } from "@features/settings/components/HelpCard";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { Toggle } from "@shared/components/ui/Toggle";

/* ─── Icon map (lazy: string → component) ─── */
const ICON_MAP: Record<string, LucideIcon> = {
  Settings, UserCircle, Users, PenLine, FileText, Bell, Clock, Keyboard,
  Sparkles, Filter, GitBranch, Lock, ShieldCheck, HardDrive, Smartphone,
  Activity, BarChart3, ClipboardCheck, FileCheck, Globe, Ban, MailX, Thermometer,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Zap;
}

/* ─── Status Badge ─── */
function StatusBadge({ access }: { access: FeatureUsage["access"] }) {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    enabled: "bg-success/10 text-success border-success/20",
    limited: "bg-warning/10 text-warning border-warning/20",
    locked: "bg-danger/10 text-danger border-danger/20",
  };
  const labels: Record<string, string> = {
    enabled: t('settings.featureStatusEnabled'),
    limited: t('settings.featureStatusLimited'),
    locked: t('settings.proOnly'),
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles[access] ?? styles.locked}`}>
      {labels[access] ?? t('settings.proOnly')}
    </span>
  );
}

/* ─── Usage Bar ─── */
function UsageBar({ current, max, t }: { current: number; max: number | null; t: TFunction }) {
  if (max === null) {
    return (
      <span className="text-[10px] text-text-tertiary font-mono">
        {current} / ∞
      </span>
    );
  }
  if (max === 0) {
    return (
      <span className="text-[10px] text-text-tertiary italic">{t('common.notAvailable')}</span>
    );
  }
  const pct = Math.min(100, Math.round((current / max) * 100));
  const isFull = current >= max;
  const barColor = isFull ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-accent";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono shrink-0 ${isFull ? "text-danger" : "text-text-tertiary"}`}>
        {current}/{max}
      </span>
    </div>
  );
}

/* ─── Feature Row ─── */
function FeatureRow({
  feature,
  usage,
  overrideUsage,
  onOverrideChange,
  overrideEnabled,
  t,
}: {
  feature: FeatureFlag;
  usage: FeatureUsage;
  overrideUsage: number | null;
  onOverrideChange: (id: string, val: number) => void;
  overrideEnabled: boolean;
  t: TFunction;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = resolveIcon(feature.icon);

  return (
    <div className="group rounded-xl border border-border-primary/20 bg-bg-secondary/30 hover:bg-bg-hover/20 transition-all duration-200">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Expand indicator */}
        <button className="text-text-tertiary hover:text-text-primary transition-colors">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          usage.access === "locked"
            ? "bg-danger/10 text-danger"
            : usage.access === "limited"
              ? "bg-warning/10 text-warning"
              : "bg-accent/10 text-accent"
        }`}>
          <Icon size={16} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{t(feature.name)}</span>
            <span className="text-[10px] text-text-tertiary bg-bg-tertiary/50 px-1.5 py-0.5 rounded font-mono">
              {t(feature.tier === "pro" ? "settings.proTier" : "settings.basicTier")}
            </span>
          </div>
          <p className="text-xs text-text-tertiary truncate mt-0.5">{t(feature.description)}</p>
        </div>

        {/* Usage bar */}
        <div className="hidden md:block">
          <UsageBar current={usage.current} max={usage.max} t={t} />
        </div>

        {/* Status badge */}
        <StatusBadge access={usage.access} />
      </div>

      {/* Expanded — override controls */}
      {expanded && overrideEnabled && (
        <div className="px-4 pb-3 pt-0 border-t border-border-primary/10 mt-0">
          <div className="flex items-center gap-4 pt-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-text-tertiary font-medium">{t('settings.overrideUsage')}</label>
              <input
                type="number"
                min={0}
                max={999}
                value={overrideUsage ?? usage.current}
                onChange={(e) => onOverrideChange(feature.id, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 px-2 py-1 rounded-md border border-border-primary bg-bg-secondary text-text-primary text-xs text-center font-mono focus:ring-1 focus:ring-accent focus:outline-none"
              />
            </div>
            <button
              onClick={() => onOverrideChange(feature.id, 0)}
              className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors underline"
            >
              {t('common.reset', 'Reset')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function FeatureFlagsTab() {
  const { t } = useTranslation();
  const store = useFeatureFlagStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [devPro, setDevPro] = useState(() => isDevProMode());

  // Load store on mount
  useEffect(() => { store.init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group features by category
  const groupedFeatures = useMemo(() => {
    const groups = new Map<string, FeatureFlag[]>();
    for (const feature of FEATURE_FLAGS) {
      const list = groups.get(feature.group) ?? [];
      list.push(feature);
      groups.set(feature.group, list);
    }
    return groups;
  }, []);

  // Filter features by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedFeatures;
    const q = searchQuery.toLowerCase();
    const results = new Map<string, FeatureFlag[]>();
    for (const [group, features] of groupedFeatures) {
      const matched = features.filter(
        (f) => t(f.name).toLowerCase().includes(q) || f.id.includes(q) || t(f.description).toLowerCase().includes(q),
      );
      if (matched.length > 0) results.set(group, matched);
    }
    return results;
  }, [groupedFeatures, searchQuery, t]);

  const effectiveTier = store.getEffectiveTier();

  const handleOverrideUsage = useCallback((featureId: string, val: number) => {
    store.setOverrideUsage(featureId, val);
  }, [store]);

  const handleResetAll = useCallback(() => {
    store.resetOverrides();
  }, [store]);

  return (
    <div className="space-y-6">
      {/* ─── Header: Tier Toggle + Override Controls ─── */}
      <SettingGroup title={t('settings.featureFlagTester')} description={t('settings.featureFlagTesterDesc', 'Toggle between Basic and Pro tiers and override usage counts to test progressive disclosure behavior.')}>
        {/* Tier selector */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--text-primary)]">{t('settings.subscriptionTier')}</span>
          </div>
          <div className="inline-flex rounded-lg border border-border-primary overflow-hidden" role="radiogroup">
            {[
              { value: "basic" as Tier, label: t('settings.basicTier') },
              { value: "pro" as Tier, label: t('settings.proTier') },
            ].map((opt) => {
              const isActive = (store.overrideEnabled ? store.overrideTier : effectiveTier) === opt.value;
              return (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => {
                    if (store.overrideEnabled) {
                      store.setOverrideTier(opt.value);
                    } else {
                      store.setTier(opt.value);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-accent text-white shadow-sm"
                      : "bg-transparent text-text-secondary hover:bg-bg-hover active:bg-bg-tertiary"
                  } focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Override toggle */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--text-primary)]">{t('settings.enableTestingOverrides')}</span>
            <p className="text-xs text-[var(--text-secondary)]">{t('settings.testingOverridesDesc')}</p>
          </div>
          <Toggle
            checked={store.overrideEnabled}
            onChange={() => store.setOverrideEnabled(!store.overrideEnabled)}
          />
        </div>

        {/* Dev Pro Mode — force-unlock every feature regardless of tier */}
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-[var(--text-primary)]">Developer Pro Mode</span>
            <p className="text-xs text-[var(--text-secondary)]">
              Unlock every feature (incl. RAG &amp; Invoicing) regardless of tier or usage limits.
            </p>
          </div>
          <Toggle
            checked={devPro}
            onChange={() => {
              const next = !devPro;
              setDevPro(next);
              setDevProMode(next);
            }}
          />
        </div>

        {/* Reset */}
        {store.overrideEnabled && (
          <div className="flex items-center gap-3 pt-2 pb-1">
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              <RotateCcw size={12} />
              {t('settings.resetAllOverrides')}
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-2 pt-3 border-t border-border-primary/10">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="font-semibold text-text-primary">{FEATURE_FLAGS.length}</span> {t('settings.totalFeatures', 'total features')}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-success" />
            {FEATURE_FLAGS.filter((f) => store.getFeatureAccess(f.id, 0) === "enabled").length} {t('settings.featureStatusEnabled').toLowerCase()}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-warning" />
            {FEATURE_FLAGS.filter((f) => store.getFeatureAccess(f.id, 0) === "limited").length} {t('settings.featureStatusLimited').toLowerCase()}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-danger" />
            {FEATURE_FLAGS.filter((f) => store.getFeatureAccess(f.id, 0) === "locked").length} {t('settings.proOnly').toLowerCase()}
          </div>
        </div>
      </SettingGroup>

      {/* ─── Education: Feature Flags ─────────────────────────────── */}
      <HelpCard
        collapsible
        items={[
          { type: "why", text: "Feature flags let you test and preview Pro-tier capabilities while on a Basic plan. Use override controls to simulate different usage scenarios without affecting real data." },
          { type: "how", text: "Toggle subscription tier between Basic and Pro to see which features unlock. Enable Testing Overrides to simulate usage counts and verify progressive disclosure behavior." },
          { type: "when", text: "Use during development to test tier gating. Use overrides to preview Pro features before upgrading. Developer Pro Mode unlocks everything for testing." },
          { type: "tip", text: "Developer Pro Mode bypasses all tier checks — ideal for testing features without toggling individual overrides. Disable it to return to real tier restrictions." },
        ]}
      />

      {/* ─── Search ─── */}
      <div className="relative">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('settings.searchFeatures', 'Search features by name, id, or description...')}
          className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-border-primary bg-bg-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Feature Groups ─── */}
      {Array.from(filteredGroups.entries()).map(([group, features]) => (
        <div key={group} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">
              {t(group)}
            </h3>
            <div className="h-px flex-1 bg-border-primary/20" />
            <span className="text-[10px] text-text-tertiary font-mono">
              {features.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {features.map((feature) => {
              // Real usage would come from DB queries — for testing we use 0 as default
              const usage = store.getFeatureUsage(feature.id, 0);
              const overrideVal = store.overrideUsage[feature.id] ?? null;
              return (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  usage={usage}
                  overrideUsage={overrideVal}
                  onOverrideChange={handleOverrideUsage}
                  overrideEnabled={store.overrideEnabled}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      ))}

      {filteredGroups.size === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-text-tertiary">{t('settings.noFeaturesMatch', 'No features match')} "{searchQuery}"</p>
        </div>
      )}

      {/* ─── Legend ─── */}
      <div className="flex items-center gap-6 px-1 py-2 text-[10px] text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success/60" />
          {t('settings.legendEnabled')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning/60" />
          {t('settings.legendLimited')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-danger/60" />
          {t('settings.legendProOnly')}
        </div>
      </div>
    </div>
  );
}
