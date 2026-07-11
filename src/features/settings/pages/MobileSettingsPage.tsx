import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Toggle } from "@shared/components/ui/Toggle";
import { ThemeTile } from "@features/settings/components/cards/ThemeTile";
import { ColorPickerCircle } from "@features/settings/components/cards/ColorPickerCircle";
import { useThemeStore } from "@shared/theme/themeStore";
import type { ThemeMode } from "@shared/theme/themeStore";
import { COLOR_THEMES } from "@/constants/themes";
import {
  getBackgroundSyncPrefs,
  setBackgroundSyncPrefs,
} from "@shared/services/settings/settingsService";
import {
  ArrowLeft,
  BookOpen,
  Palette,
  UserCircle,
  Database,
  Bell,
  Shield,
  Trash2,
  Smartphone,
  BarChart3,
  Filter,
  Plus,
  ChevronRight,
} from "lucide-react";

// ── iOS-style Grouped Section ─────────────────────────────────────────────
interface SectionGroupProps {
  children: React.ReactNode;
  className?: string;
}

function SectionGroup({ children, className = "" }: SectionGroupProps) {
  return (
    <div className={`rounded-xl overflow-hidden bg-white/10 dark:bg-white/5 backdrop-blur-[12px] border border-white/15 dark:border-white/5 ${className}`}>
      {children}
    </div>
  );
}

// ── iOS-style Row ─────────────────────────────────────────────────────────
interface SettingsRowProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  control?: React.ReactNode;
  destructive?: boolean;
}

function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
  control,
  destructive = false,
}: SettingsRowProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`flex items-center gap-3 px-4 py-3.5 w-full text-left transition-all duration-150 active:bg-white/10 dark:active:bg-white/5 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Icon */}
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent shrink-0">
        <Icon size={17} />
      </span>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate leading-tight ${destructive ? "text-danger" : "text-text-primary"}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-text-tertiary truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Control or chevron */}
      <div className="shrink-0 flex items-center">
        {control ? (
          control
        ) : onClick ? (
          <ChevronRight size={16} className="text-text-tertiary/50" />
        ) : null}
      </div>
    </Comp>
  );
}

// ── Section Divider ───────────────────────────────────────────────────────
function SectionDivider() {
  return <div className="h-px bg-white/10 dark:bg-white/5 mx-4" />;
}

// ── Mode label helper ─────────────────────────────────────────────────────
const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

// ── Main Component ─────────────────────────────────────────────────────────
export function MobileSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  /* ── Theme ───────────────────────────────────────────────────────────── */
  const { mode, colorTheme, setMode, setColorTheme } = useThemeStore();

  const modeLabel = MODE_LABELS[mode];

  const currentThemeName = useMemo(
    () => COLOR_THEMES.find((ct) => ct.id === colorTheme)?.name ?? "Indigo",
    [colorTheme],
  );

  /* ── Background Sync ─────────────────────────────────────────────────── */
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncIntervalMins, setSyncIntervalMins] = useState(15);

  /* ── Cache ───────────────────────────────────────────────────────────── */
  const [cacheSize, setCacheSize] = useState("calculating...");

  /* ── Biometric ───────────────────────────────────────────────────────── */
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  /* ── Push Notifications ──────────────────────────────────────────────── */
  const [pushEnabled, setPushEnabled] = useState(true);

  /* ── UI State ────────────────────────────────────────────────────────── */
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);

  /* ── Effects ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    void getBackgroundSyncPrefs().then((p) => {
      setSyncEnabled(p.enabled);
      setSyncIntervalMins(p.intervalMins);
    });

    import("@shared/services/assets/assetCacheService")
      .then(({ getCacheSizeFormatted }) => {
        getCacheSizeFormatted()
          .then(setCacheSize)
          .catch(() => setCacheSize("unavailable"));
      })
      .catch(() => setCacheSize("desktop only"));

    import("@shared/services/db/invoke/command")
      .then(({ invokeCommand }) => {
        invokeCommand<{ isAvailable: boolean }>("check_biometric")
          .then((r) => {
            setBioAvailable(r.isAvailable);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  /* ── Handlers ────────────────────────────────────────────────────────── */
  const handleSyncToggle = useCallback(
    async (enabled: boolean) => {
      setSyncEnabled(enabled);
      await setBackgroundSyncPrefs({ enabled, intervalMins: syncIntervalMins });
    },
    [syncIntervalMins],
  );

  const handleIntervalChange = useCallback(
    async (intervalMins: number) => {
      setSyncIntervalMins(intervalMins);
      await setBackgroundSyncPrefs({ enabled: syncEnabled, intervalMins });
    },
    [syncEnabled],
  );

  const handleClearCache = useCallback(() => {
    import("@shared/services/assets/assetCacheService")
      .then(({ clearCache }) => {
        clearCache().then(() => setCacheSize("0 B"));
      })
      .catch(() => {});
  }, []);

  const handleThemeModeSelect = useCallback(
    (newMode: ThemeMode) => {
      setMode(newMode);
    },
    [setMode],
  );

  const handleAccentColorSelect = useCallback(
    (swatch: string) => {
      const theme = COLOR_THEMES.find((ct) => ct.swatch === swatch);
      if (theme) {
        setColorTheme(theme.id);
      }
    },
    [setColorTheme],
  );

  const accentColors = useMemo(() => COLOR_THEMES.slice(0, 6), []);

  /* ── Navigation ──────────────────────────────────────────────────────── */
  const goToInbox = useCallback(
    () => navigate({ to: "/mail/$label", params: { label: "inbox" } }),
    [navigate],
  );
  const goToAccounts = useCallback(
    () => navigate({ to: "/settings/$tab", params: { tab: "accounts" } }),
    [navigate],
  );
  const goToPairing = useCallback(
    () => navigate({ to: "/settings/device-pairing" }),
    [navigate],
  );
  const goToCampaigns = useCallback(
    () => navigate({ to: "/campaigns" }),
    [navigate],
  );
  const goToMailRules = useCallback(
    () => navigate({ to: "/settings/$tab", params: { tab: "mail-rules" } }),
    [navigate],
  );

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full bg-bg-primary text-text-primary overflow-hidden">
      {/* ════════════════════════════════════════════════════════════════════
          Top Bar — minimal, native-feel
          ════════════════════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-4 py-3 shrink-0 z-10 border-b border-white/10 dark:border-white/5">
        <button
          type="button"
          onClick={goToInbox}
          className="flex items-center justify-center w-9 h-9 rounded-full text-accent active:bg-accent/10 transition-colors"
          aria-label={t("common.back")}
        >
          <ArrowLeft size={22} />
        </button>

        <h1 className="text-[17px] font-semibold text-text-primary">
          Settings
        </h1>

        <button
          type="button"
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-secondary active:bg-white/10 transition-colors"
          aria-label={t("nav.help")}
        >
          <BookOpen size={20} />
        </button>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          Scrollable Content — iOS-style grouped sections
          ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-32 space-y-6 [-webkit-overflow-scrolling:touch]">
        {/* ── Section: Appearance ─────────────────────────────────────────── */}
        <div>
          <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
            Appearance
          </p>
          <SectionGroup>
            <SettingsRow
              icon={Palette}
              title={t("settings.tabs.general")}
              subtitle={`${modeLabel} · ${currentThemeName}`}
              onClick={() => setAppearanceExpanded((prev) => !prev)}
            />

            {appearanceExpanded && (
              <div className="px-4 pb-4 pt-2 space-y-5 border-t border-white/10 dark:border-white/5">
                {/* Theme mode selector */}
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary mb-3">
                    Theme Mode
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <ThemeTile
                      mode="light"
                      selected={mode === "light"}
                      onSelect={handleThemeModeSelect}
                    />
                    <ThemeTile
                      mode="dark"
                      selected={mode === "dark"}
                      onSelect={handleThemeModeSelect}
                    />
                    <ThemeTile
                      mode="system"
                      selected={mode === "system"}
                      onSelect={handleThemeModeSelect}
                    />
                  </div>
                </div>

                {/* Accent color picker */}
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary mb-3">
                    Accent Color
                  </h3>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {accentColors.map((ct) => (
                      <ColorPickerCircle
                        key={ct.id}
                        color={ct.swatch}
                        selected={colorTheme === ct.id}
                        onSelect={handleAccentColorSelect}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SectionGroup>
        </div>

        {/* ── Section: Accounts & Sync ──────────────────────────────────── */}
        <div>
          <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
            Accounts & Sync
          </p>
          <SectionGroup>
            <SettingsRow
              icon={UserCircle}
              title={t("settings.tabs.accounts")}
              subtitle="Manage email accounts"
              onClick={goToAccounts}
            />
            <SectionDivider />
            <SettingsRow
              icon={Database}
              title="Background Sync"
              subtitle={syncEnabled ? `${syncIntervalMins} min interval` : "Disabled"}
              control={
                <Toggle
                  checked={syncEnabled}
                  onChange={(checked) => void handleSyncToggle(checked)}
                  size="sm"
                  aria-label={t("settings.enableBackgroundSync")}
                />
              }
            />
          </SectionGroup>
        </div>

        {/* ── Section: Notifications ──────────────────────────────────────── */}
        <div>
          <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
            Notifications
          </p>
          <SectionGroup>
            <SettingsRow
              icon={Bell}
              title={t("settings.tabs.notifications")}
              subtitle="Push alerts & sounds"
              control={
                <Toggle
                  checked={pushEnabled}
                  onChange={(checked) => setPushEnabled(checked)}
                  size="sm"
                  aria-label={t("settings.pushNotifications")}
                />
              }
            />
          </SectionGroup>
        </div>

        {/* ── Section: Security ──────────────────────────────────────────── */}
        {bioAvailable && (
          <div>
            <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
              Security
            </p>
            <SectionGroup>
              <SettingsRow
                icon={Shield}
                title={t("settings.security")}
                subtitle={t("settings.biometricLock")}
                control={
                  <Toggle
                    checked={bioEnabled}
                    onChange={(checked) => setBioEnabled(checked)}
                    size="sm"
                    aria-label={t("settings.biometricLock")}
                  />
                }
              />
            </SectionGroup>
          </div>
        )}

        {/* ── Section: Storage ──────────────────────────────────────────── */}
        <div>
          <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
            Storage
          </p>
          <SectionGroup>
            <SettingsRow
              icon={Trash2}
              title="Cache"
              subtitle={cacheSize === "calculating..." ? "Calculating..." : cacheSize}
              control={
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={cacheSize === "0 B" || cacheSize === "calculating..."}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent active:bg-accent/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              }
            />
          </SectionGroup>
        </div>

        {/* ── Section: Devices ──────────────────────────────────────────── */}
        <div>
          <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
            Devices
          </p>
          <SectionGroup>
            <SettingsRow
              icon={Smartphone}
              title="Device Pairing"
              subtitle="Pair mobile devices"
              onClick={goToPairing}
            />
          </SectionGroup>
        </div>

        {/* ── Section: Features ──────────────────────────────────────────── */}
        <div>
          <p className="text-[13px] font-medium text-text-tertiary uppercase tracking-[0.5px] px-1 mb-2">
            Features
          </p>
          <SectionGroup>
            <SettingsRow
              icon={BarChart3}
              title="Campaigns"
              subtitle="Send & analytics"
              onClick={goToCampaigns}
            />
            <SectionDivider />
            <SettingsRow
              icon={Filter}
              title={t("settings.tabs.mailRules")}
              subtitle="Labels & filters"
              onClick={goToMailRules}
            />
          </SectionGroup>
        </div>

        {/* ── Sync interval picker (visible when sync is enabled) ────────── */}
        {syncEnabled && (
          <SectionGroup className="animate-[fadeIn_200ms_ease-out]">
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">Sync interval</span>
                <select
                  value={syncIntervalMins}
                  onChange={(e) => void handleIntervalChange(Number(e.target.value))}
                  className="text-sm bg-white/15 dark:bg-white/10 text-text-primary px-3 py-1.5 rounded-lg border border-white/20 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-accent appearance-none"
                >
                  <option value={5}>5 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>
            </div>
          </SectionGroup>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Floating Action Button — Add Account
          ════════════════════════════════════════════════════════════════════ */}
      <button
        type="button"
        onClick={goToAccounts}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-accent text-white shadow-lg shadow-accent/30 active:scale-90 transition-transform duration-150 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label="Add account"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
