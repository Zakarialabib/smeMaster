import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LayoutPanelLeft, LayoutPanelTop, PanelRightClose, Maximize2, Type, Layers, Columns3, Trash2, AlertTriangle } from "lucide-react";
import { useThemeStore } from "@shared/stores/themeStore";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useSettingsUiStore } from "@shared/stores/settingsUiStore";
import { getSetting, setSetting } from "@features/settings/db/settings";
import { COLOR_THEMES } from "@/constants/themes";
import type { ColorThemeId } from "@/constants/themes";
import { Button } from "@shared/components/ui/Button";
import { Toggle } from "@shared/components/ui/Toggle";
import { LanguageSwitcher } from "@features/settings/components/LanguageSwitcher";
import { InlineTooltip } from "@features/settings/components/HelpCard";
import { usePlatform } from "@shared/hooks/usePlatform";
import { ButtonGroup, ChoiceCards } from "@features/settings/components/SettingsHelpers";
import { SettingsSection, SettingsRow } from "@shared/components/settings";
import SidebarNavEditor from "../SidebarNavEditor";
import { AppearanceSection } from "@shared/components/layout/shell/AppearanceSection";
import type { ThemeMode } from "@features/settings/components/cards/ThemeTile";
import { isAutoLaunchEnabled, enableAutoLaunch, disableAutoLaunch } from "@shared/services/autoLaunch";
import { DataWipeDialog } from "@features/settings/components/DataWipeDialog";

const inputClass =
  "w-48 px-3.5 py-2 rounded-lg border border-border-primary bg-bg-secondary text-text-primary text-sm focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors";

const ACCENT_HEX_TO_THEME: Record<string, ColorThemeId> = {
  "#6366f1": "indigo",
  "#8b5cf6": "violet",
  "#ec4899": "rose",
  "#f59e0b": "amber",
  "#10b981": "emerald",
  "#06b6d4": "sky",
  "#0B57D0": "frost",
};

const ACCENT_THEME_TO_HEX: Record<ColorThemeId, string> = {
  indigo: "#6366f1",
  violet: "#8b5cf6",
  rose: "#ec4899",
  amber: "#f59e0b",
  emerald: "#10b981",
  sky: "#06b6d4",
  orange: "#f59e0b",
  slate: "#6366f1",
  frost: "#0B57D0",
};

export default function GeneralTab() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.mode);
  const setTheme = useThemeStore((s) => s.setMode);
  const fontScale = useThemeStore((s) => s.fontScale);
  const setFontScale = useThemeStore((s) => s.setFontScale);
  const colorTheme = useThemeStore((s) => s.colorTheme);
  const setColorTheme = useThemeStore((s) => s.setColorTheme);
  const reduceMotion = useThemeStore((s) => s.reduceMotion);
  const setReduceMotion = useThemeStore((s) => s.setReduceMotion);
  const highContrast = useThemeStore((s) => s.highContrast);
  const setHighContrast = useThemeStore((s) => s.setHighContrast);
  const surface = useThemeStore((s) => s.surface);
  const setSurface = useThemeStore((s) => s.setSurface);
  const density = useThemeStore((s) => s.density);
  const setDensity = useThemeStore((s) => s.setDensity);
  const readingPanePosition = useLayoutStore((s) => s.readingPanePosition);
  const setReadingPanePosition = useLayoutStore((s) => s.setReadingPanePosition);
  const readingPaneExpanded = useLayoutStore((s) => s.readingPaneExpanded);
  const setReadingPaneExpanded = useLayoutStore((s) => s.setReadingPaneExpanded);
  const emailDensity = useLayoutStore((s) => s.emailDensity);
  const setEmailDensity = useLayoutStore((s) => s.setEmailDensity);
  const inboxViewMode = useLayoutStore((s) => s.inboxViewMode);
  const setInboxViewMode = useLayoutStore((s) => s.setInboxViewMode);

  const currentAccent = useMemo<string>(() => {
    return ACCENT_THEME_TO_HEX[colorTheme] ?? COLOR_THEMES.find((t) => t.id === colorTheme)?.swatch ?? "#6366f1";
  }, [colorTheme]);

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
  };

  const handleAccentChange = (hex: string) => {
    const themeId = ACCENT_HEX_TO_THEME[hex] ?? "indigo";
    setColorTheme(themeId);
  };

  const [blockRemoteImages, setBlockRemoteImages] = useState(true);
  const [phishingDetectionEnabled, setPhishingDetectionEnabled] = useState(true);
  const [phishingSensitivity, setPhishingSensitivity] = useState<"low" | "default" | "high">("default");
  const [biometricLockEnabled, setBiometricLockEnabled] = useState(false);
  const { screen } = usePlatform();
  const { mobile: isMobileDevice } = usePlatform();
  const [cacheMaxMb, setCacheMaxMb] = useState("500");
  const [cacheSizeMb, setCacheSizeMb] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const advancedMode = useSettingsUiStore((s) => s.advancedMode);

  useEffect(() => {
    async function load() {
      const blockImg = await getSetting("block_remote_images");
      setBlockRemoteImages(blockImg !== "false");
      const phishingEnabled = await getSetting("phishing_detection_enabled");
      setPhishingDetectionEnabled(phishingEnabled !== "false");
      const phishingSens = await getSetting("phishing_sensitivity");
      if (phishingSens === "low" || phishingSens === "high") setPhishingSensitivity(phishingSens);
      const bioVal = await getSetting("biometric_lock_enabled");
      setBiometricLockEnabled(bioVal === "true");
      const cacheMax = await getSetting("attachment_cache_max_mb");
      setCacheMaxMb(cacheMax ?? "500");
      try {
        const { getCacheSize } = await import("@features/mail/services/attachments/cacheManager");
        const size = await getCacheSize();
        setCacheSizeMb(Math.round(size / (1024 * 1024) * 10) / 10);
      } catch {
      }
    }
    load();

    isAutoLaunchEnabled().then(setAutoLaunchEnabled).catch(() => {});
  }, []);

  return (
    <>
      {/* ── Appearance (inline, no card wrapper — AppearanceSection has its own) ── */}
      <AppearanceSection
        currentTheme={theme}
        currentAccent={currentAccent}
        onThemeChange={handleThemeChange}
        onAccentChange={handleAccentChange}
        currentSurface={surface}
        onSurfaceChange={setSurface}
        currentDensity={density}
        onDensityChange={setDensity}
      />

      {/* ── Display ────────────────────────────────────────────────── */}
      <SettingsSection title="Display" description="Font size, motion, and contrast preferences">
        <SettingsRow label={t('settings.fontSize')}>
          <ButtonGroup
            options={[
              { value: "small", label: t('settings.small'), icon: Type },
              { value: "default", label: t('settings.default'), icon: Type },
              { value: "large", label: t('settings.large'), icon: Type },
              { value: "xlarge", label: t('settings.xlarge'), icon: Type },
            ]}
            value={fontScale}
            onChange={(val) => { setFontScale(val as "small" | "default" | "large" | "xlarge"); }}
          />
        </SettingsRow>
        <SettingsRow label={t('settings.reduceMotion')} description={t('settings.reduceMotionDescription')}>
          <Toggle
            checked={reduceMotion}
            onChange={() => setReduceMotion(!reduceMotion)}
            size="sm"
          />
        </SettingsRow>
        <SettingsRow label={t('settings.highContrast')} description={t('settings.highContrastDescription')}>
          <Toggle
            checked={highContrast}
            onChange={() => setHighContrast(!highContrast)}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Layout ─────────────────────────────────────────────────── */}
      <SettingsSection title="Layout" description="Reading pane, email density, and inbox view">
        {screen.isDesktop && (
          <>
            <SettingsRow label={t('settings.readingPane')}>
              <ChoiceCards
                options={[
                  { value: "right", label: "Right", description: "Side-by-side view", icon: LayoutPanelLeft },
                  { value: "bottom", label: "Bottom", description: "Stacked view", icon: LayoutPanelTop },
                  { value: "expanded", label: "Expanded", description: "Full-width preview", icon: Maximize2 },
                  { value: "hidden", label: "Hidden", description: "No preview pane", icon: PanelRightClose },
                ]}
                value={readingPaneExpanded ? "expanded" : readingPanePosition}
                onChange={(val) => {
                  if (val === "expanded") {
                    setReadingPaneExpanded(true);
                  } else {
                    setReadingPaneExpanded(false);
                    setReadingPanePosition(val as "right" | "bottom" | "hidden");
                  }
                }}
              />
            </SettingsRow>
            <div className="flex items-center gap-2 px-3 py-2 text-[0.7rem] text-text-tertiary bg-bg-tertiary/40 rounded-lg border border-border-primary/50 mx-3 mb-1">
              <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[0.6rem] font-mono bg-bg-secondary border border-border-primary rounded leading-none">m</kbd>
              <span>Cycle pane position</span>
              <span className="w-px h-3 bg-border-primary" />
              <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[0.6rem] font-mono bg-bg-secondary border border-border-primary rounded leading-none">[</kbd>
              <span>/</span>
              <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[0.6rem] font-mono bg-bg-secondary border border-border-primary rounded leading-none">]</kbd>
              <span>Expand/collapse</span>
            </div>
          </>
        )}
        <SettingsRow label={t('settings.emailDensity')}>
          <ButtonGroup
            options={[
              { value: "compact", label: t('settings.compact') },
              { value: "default", label: t('settings.default') },
              { value: "spacious", label: t('settings.spacious') },
            ]}
            value={emailDensity}
            onChange={(val) => { setEmailDensity(val as "compact" | "default" | "spacious"); }}
          />
        </SettingsRow>
        <SettingsRow label={t('settings.inboxViewMode')}>
          <ButtonGroup
            options={[
              { value: "unified", label: t('settings.unified'), icon: Layers },
              { value: "split", label: t('settings.split'), icon: Columns3 },
            ]}
            value={inboxViewMode}
            onChange={(val) => { setInboxViewMode(val as "unified" | "split"); }}
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Language & Region ──────────────────────────────────────── */}
      <SettingsSection title="Language & Region">
        <LanguageSwitcher />
      </SettingsSection>

      {/* ── Settings Mode ──────────────────────────────────────────── */}
      <SettingsSection title="Settings Mode" description="Toggle advanced configuration options">
        <SettingsRow
          label="Advanced Settings"
          description="Show Queue, Backup, Templates, and Shortcuts tabs"
        >
          <Toggle
            checked={advancedMode}
            onChange={() => { useSettingsUiStore.getState().setAdvancedMode(!advancedMode); }}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── System ─────────────────────────────────────────────────── */}
      <SettingsSection title="System">
        <SettingsRow
          label="Launch on startup"
          description="Start SMEMaster automatically when you log in"
        >
          <Toggle
            checked={autoLaunchEnabled}
            onChange={async () => {
              if (autoLaunchEnabled) {
                await disableAutoLaunch();
              } else {
                await enableAutoLaunch();
              }
              setAutoLaunchEnabled(!autoLaunchEnabled);
            }}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      {/* ── Privacy & Security ─────────────────────────────────────── */}
      <SettingsSection title={t('settings.privacyAndSecurity')}>
        <SettingsRow
          label={t('settings.blockRemoteImages')}
          description={t('settings.blockRemoteImagesDescription')}
        >
          <Toggle
            checked={blockRemoteImages}
            onChange={async () => {
              const newVal = !blockRemoteImages;
              setBlockRemoteImages(newVal);
              await setSetting("block_remote_images", newVal ? "true" : "false");
            }}
            size="sm"
          />
        </SettingsRow>
        <SettingsRow
          label={t('settings.phishingDetection')}
          description={t('settings.phishingDetectionDescription')}
        >
          <Toggle
            checked={phishingDetectionEnabled}
            onChange={async () => {
              const newVal = !phishingDetectionEnabled;
              setPhishingDetectionEnabled(newVal);
              await setSetting("phishing_detection_enabled", newVal ? "true" : "false");
            }}
            size="sm"
          />
        </SettingsRow>
        {phishingDetectionEnabled && (
          <SettingsRow label={t('settings.detectionSensitivity')}>
            <div className="flex items-center gap-2">
              <ButtonGroup
                options={[
                  { value: "low", label: t('settings.low') },
                  { value: "default", label: t('settings.default') },
                  { value: "high", label: t('settings.high') },
                ]}
                value={phishingSensitivity}
                onChange={async (val) => {
                  setPhishingSensitivity(val as "low" | "default" | "high");
                  await setSetting("phishing_sensitivity", val);
                }}
              />
              <InlineTooltip text="Higher sensitivity catches more threats but may produce more false positives. Lower sensitivity reduces false alarms." />
            </div>
          </SettingsRow>
        )}
        {isMobileDevice ? (
          <SettingsRow
            label={t('settings.biometricLock')}
            description={t('settings.biometricLockDescription')}
          >
            <Toggle
              checked={biometricLockEnabled}
              onChange={async () => {
                const newVal = !biometricLockEnabled;
                setBiometricLockEnabled(newVal);
                await setSetting("biometric_lock_enabled", newVal ? "true" : "false");
              }}
              size="sm"
            />
          </SettingsRow>
        ) : (
          <SettingsRow label={t('settings.biometricLock')}>
            <span className="text-xs text-text-tertiary">Available on mobile devices</span>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* ── Sidebar Nav Editor (inline) ────────────────────────────── */}
      <SidebarNavEditor />

      {/* ── Storage ────────────────────────────────────────────────── */}
      <SettingsSection title={t('settings.storage')} description="Attachment caching">
        <div className="flex items-center justify-between py-3 first:pt-0 gap-4 min-h-[40px] rounded-lg px-3 -mx-3 transition-colors hover:bg-bg-hover/30 border-b border-border-primary/10">
          <div>
            <span className="text-sm font-medium text-text-primary">{t('settings.attachmentCache')}</span>
            <p className="text-xs text-text-tertiary mt-0.5">
              {cacheSizeMb !== null ? t('settings.nMbUsed', { n: cacheSizeMb }) : t('settings.calculating')}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              setClearingCache(true);
              try {
                const { clearAllCache } = await import("@features/mail/services/attachments/cacheManager");
                await clearAllCache();
                setCacheSizeMb(0);
              } catch (err) {
                console.error("Failed to clear cache:", err);
              } finally {
                setClearingCache(false);
              }
            }}
            disabled={clearingCache}
            className="bg-bg-tertiary text-text-primary border border-border-primary"
          >
            {clearingCache ? t('settings.clearing') : t('settings.clearCache')}
          </Button>
        </div>
        <SettingsRow label={t('settings.maxCacheSize')}>
          <select
            value={cacheMaxMb}
            onChange={async (e) => {
              const val = e.target.value;
              setCacheMaxMb(val);
              await setSetting("attachment_cache_max_mb", val);
            }}
            className={inputClass}
          >
            <option value="100">{t('settings.nMb', { n: 100 })}</option>
            <option value="250">{t('settings.nMb', { n: 250 })}</option>
            <option value="500">{t('settings.nMb', { n: 500 })}</option>
            <option value="1000">{t('settings.nGb', { n: 1 })}</option>
            <option value="2000">{t('settings.nGb', { n: 2 })}</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      {/* ── Data Management ────────────────────────────────────────── */}
      <SettingsSection
        title="Data Management"
        description="Permanently delete all locally stored data. Your email accounts on the server will not be affected."
        variant="danger"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-danger/5 border border-danger/10 rounded-lg">
            <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary leading-relaxed">
              This action is <strong>irreversible</strong>. All locally cached data will be
              permanently deleted. After wiping, the app will restart with a fresh database.
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={() => setDialogOpen(true)}
          >
            Delete All Data
          </Button>
        </div>
      </SettingsSection>

      <DataWipeDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
