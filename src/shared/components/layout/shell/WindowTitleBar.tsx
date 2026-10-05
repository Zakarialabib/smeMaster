import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAccountStore } from '@features/accounts/stores/accountStore';
import { useSyncStore } from '@shared/stores/syncStore';
import { usePlatform } from '@shared/hooks/usePlatform';
import { useThemeStore } from '@shared/theme/themeStore';
import type { ThemeMode } from '@shared/theme/themeStore';
import { uiBus } from '@shared/services/events/uiBus';
import { changeLanguage, LOCALE_NAMES, LOCALE_DIRS, SUPPORTED_LOCALES } from '../../../../locales';
import type { SupportedLocale } from '../../../../locales';
import { COLOR_THEMES } from '@/constants/themes';
import {
  Minus,
  Square,
  X,
  Copy,
  ChevronDown,
  Circle,
  Loader2,
  Keyboard,
  Sun,
  Moon,
  Monitor,
  Globe,
  Check,
  Languages,
  ArrowLeftRight,
  Palette,
} from 'lucide-react';

// ── Route path → breadcrumb i18n key ──────────────────────────────────
const ROUTE_KEYS: Record<string, string> = {
  '/dashboard/mobile': 'nav.dashboard',
  '/dashboard': 'nav.dashboard',
  '/mail/inbox': 'nav.inbox',
  '/mail': 'nav.mail',
  '/people': 'nav.crm',
  '/crm': 'nav.crm',
  '/campaigns': 'common.campaigns',
  '/calendar': 'nav.productivity',
  '/tasks': 'nav.productivity',
  '/settings/general': 'common.settings',
  '/settings': 'common.settings',
  '/vault': 'nav.vault',
  '/automation': 'common.automation',
  '/ai-assistant': 'nav.aiAssistant',
  '/invoicing': 'common.invoicing',
  '/erp': 'nav.erp',
  '/pos': 'nav.pos',
  '/attachments': 'common.attachments',
  '/help': 'nav.help',
};

function getBreadcrumb(pathname: string, t: (key: string) => string): string {
  if (ROUTE_KEYS[pathname]) return t(ROUTE_KEYS[pathname]);
  if (pathname.startsWith('/mail/')) return t('nav.mail');
  if (pathname.startsWith('/settings/')) return t('common.settings');
  if (pathname.startsWith('/help/')) return t('nav.help');
  if (pathname.startsWith('/label/')) return t('nav.label');
  return 'SMEMaster';
}

// ── Dropdown (language selector, color picker, account switcher) ───────
// Rendered in a portal at z-[100] so it floats above every sidebar, panel
// and modal instead of being clipped by a stacking context.
function Dropdown({
  trigger,
  children,
  align = 'end',
  menuClassName = 'min-w-[160px] py-1.5 overflow-hidden',
  buttonClassName = 'flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/10 dark:hover:bg-white/8 active:scale-90 transition-all duration-150',
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  menuClassName?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    setAnchor(btnRef.current?.getBoundingClientRect() ?? null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isRtl = document.documentElement.dir === 'rtl';
  const endSide = align === 'end';
  const style: React.CSSProperties =
    endSide !== isRtl
      ? { top: (anchor?.bottom ?? 0) + 6, right: window.innerWidth - (anchor?.right ?? 0) }
      : { top: (anchor?.bottom ?? 0) + 6, left: anchor?.left ?? 0 };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((p) => !p)}
        className={buttonClassName}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={`fixed z-[100] bg-sidebar-bg/95 backdrop-blur-[20px] border border-white/15 dark:border-white/8 rounded-2xl shadow-xl animate-[fadeIn_150ms_ease-out] ${menuClassName}`}
            style={style}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

function DropdownItem({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium transition-colors ${
        selected
          ? 'text-accent bg-accent/10'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5 dark:hover:bg-white/5'
      }`}
    >
      <Icon size={15} />
      <span className="flex-1 text-start">{label}</span>
      {selected && <Check size={13} className="text-accent" />}
    </button>
  );
}

// ── Color theme dot ────────────────────────────────────────────────────
function ColorDot({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded-full border-2 transition-all duration-150 active:scale-90 ${
        selected ? 'border-accent scale-110' : 'border-transparent hover:scale-105'
      }`}
      style={{ backgroundColor: color }}
      aria-label={`Accent color ${color}`}
    />
  );
}

// ── Props ──────────────────────────────────────────────────────────────
interface WindowTitleBarProps {
  /** Whether to show window control buttons. Default: true */
  showWindowControls?: boolean;
  /** Callback when account is switched */
  onAccountSwitch?: (accountId: string) => void;
}

// ── Main component ──────────────────────────────────────────────────────
export function WindowTitleBar({
  showWindowControls = true,
  onAccountSwitch,
}: WindowTitleBarProps) {
  const { t } = useTranslation();
  const { os } = usePlatform();
  const location = useLocation();
  const isMac = os === 'macos';

  // ── Window state (desktop only) ────────────────────────────────────────
  const [maximized, setMaximized] = useState(false);

  // ── Theme config (mobile-native) ───────────────────────────────────────
  const breadcrumb = getBreadcrumb(location.pathname, t);
  const mode = useThemeStore((s) => s.mode);
  const colorTheme = useThemeStore((s) => s.colorTheme);
  const setMode = useThemeStore((s) => s.setMode);
  const setColorTheme = useThemeStore((s) => s.setColorTheme);
  const [lang, setLang] = useState<SupportedLocale>(
    () => (localStorage.getItem('i18nextLng') as SupportedLocale) || 'en',
  );

  // ── Account / sync state ──────────────────────────────────────────────
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
  const isSyncingFolder = useSyncStore((s) => s.isSyncingFolder);
  const isSyncing = isSyncingFolder !== null;
  const activeAccount = accounts.find((a) => a.id === activeAccountId);

  // ── Window state tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!showWindowControls) return;
    let unlisten: (() => void) | undefined;
    try {
      const appWindow = getCurrentWindow();
      appWindow
        .isMaximized()
        .then(setMaximized)
        .catch(() => {});
      appWindow
        .onResized(() => {
          appWindow
            .isMaximized()
            .then(setMaximized)
            .catch(() => {});
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch(() => {});
    } catch {
      /* web fallback */
    }
    return () => {
      unlisten?.();
    };
  }, [showWindowControls]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleMinimize = useCallback(() => {
    try {
      getCurrentWindow().minimize();
    } catch {}
  }, []);
  const handleMaximize = useCallback(() => {
    try {
      getCurrentWindow().toggleMaximize();
    } catch {}
  }, []);
  const handleClose = useCallback(() => {
    try {
      getCurrentWindow().close();
    } catch {}
  }, []);

  const handleToggleShortcuts = useCallback(() => {
    uiBus.emit('toggle:shortcuts-help');
  }, []);

  const handleLanguageChange = useCallback(async (lng: SupportedLocale) => {
    setLang(lng);
    await changeLanguage(lng);
    document.documentElement.dir = LOCALE_DIRS[lng] || 'ltr';
    document.documentElement.lang = lng;
  }, []);

  const dir = LOCALE_DIRS[lang] || 'ltr';

  const toggleRTL = useCallback(async () => {
    const newDir = dir === 'ltr' ? 'rtl' : 'ltr';
    const targetLocale = (Object.entries(LOCALE_DIRS).find(([, d]) => d === newDir)?.[0] ||
      'en') as SupportedLocale;
    await handleLanguageChange(targetLocale);
  }, [dir, handleLanguageChange]);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const idx = Math.max(0, order.indexOf(mode as ThemeMode));
    setMode(order[(idx + 1) % order.length]!);
  }, [mode, setMode]);

  const handleAccountSelect = useCallback(
    (id: string) => {
      setActiveAccount(id);
      onAccountSwitch?.(id);
    },
    [setActiveAccount, onAccountSwitch],
  );

  const ThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;
  const accentColors = COLOR_THEMES.slice(0, 6);

  return (
    <header
      data-tauri-drag-region
      className="flex items-center justify-between px-3 py-1.5 shrink-0 bg-sidebar-bg/80 backdrop-blur-[12px] border-b border-white/10 dark:border-white/5 min-h-[44px] z-20 select-none"
    >
      {/* ── Left: Logo + Breadcrumb + Sync indicator ────────────────── */}
      <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
        {/* Logo */}
        <span data-tauri-drag-region className="text-sm font-bold tracking-tight shrink-0">
          <span className="text-accent">SME</span>
          <span className="text-text-primary">Master</span>
        </span>

        {/* Separator */}
        <span className="text-text-tertiary/40 text-[10px] select-none">/</span>

        {/* Breadcrumb / page name */}
        <span
          data-tauri-drag-region
          className="text-xs font-medium text-text-tertiary truncate max-w-[120px]"
        >
          {breadcrumb}
        </span>

        {/* Sync indicator (desktop: hidden on smallest screens) */}
        <span
          data-tauri-drag-region
          className="hidden sm:flex items-center ms-1"
          title={isSyncing ? t('common.syncing', 'Syncing...') : t('common.synced', 'Synced')}
        >
          {isSyncing ? (
            <Loader2 size={11} className="text-accent animate-spin" />
          ) : (
            <Circle size={6} className="text-green-500 fill-green-500" />
          )}
        </span>
      </div>

      {/* ── Center: Account switcher (desktop, multi-account) ─────── */}
      {accounts.length > 1 && (
        <div data-tauri-drag-region className="hidden md:block">
          <Dropdown
            align="end"
            menuClassName="w-52 py-1 max-h-44 overflow-y-auto"
            buttonClassName="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
            trigger={
              <span
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
                title={activeAccount?.email ?? t('common.selectAccount')}
              >
                <span className="truncate max-w-[100px]">
                  {activeAccount?.email ?? t('common.noAccount')}
                </span>
                <ChevronDown size={10} className="shrink-0" />
              </span>
            }
          >
            {accounts.map((acct) => (
              <button
                key={acct.id}
                onClick={() => handleAccountSelect(acct.id)}
                className={`w-full text-start px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                  acct.id === activeAccountId
                    ? 'text-accent bg-accent/10'
                    : 'text-sidebar-text/70 hover:text-sidebar-text hover:bg-sidebar-hover'
                }`}
              >
                <span className="truncate flex-1">{acct.email}</span>
                {acct.id === activeAccountId && (
                  <Circle size={5} className="fill-accent text-accent shrink-0" />
                )}
              </button>
            ))}
          </Dropdown>
        </div>
      )}

      {/* ── Right: Configs + Desktop controls ────────────────────── */}
      <div data-tauri-drag-region className="flex items-center gap-0.5">
        {/* Color picker */}
        <Dropdown
          trigger={<Palette size={15} />}
          align="end"
          menuClassName="flex items-center gap-1.5 px-2.5 py-1.5"
        >
          {accentColors.map((ct) => (
            <ColorDot
              key={ct.id}
              color={ct.swatch}
              selected={colorTheme === ct.id}
              onClick={() => setColorTheme(ct.id)}
            />
          ))}
        </Dropdown>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/10 dark:hover:bg-white/8 active:scale-90 transition-all duration-150"
          aria-label={`Theme: ${mode}`}
          title={`Theme: ${mode}`}
        >
          <ThemeIcon size={15} />
        </button>

        {/* Language dropdown */}
        <Dropdown trigger={<Globe size={15} />} align="end">
          {(SUPPORTED_LOCALES as readonly string[]).map((l) => {
            const locale = l as SupportedLocale;
            return (
              <DropdownItem
                key={locale}
                icon={Languages}
                label={LOCALE_NAMES[locale]}
                selected={lang === locale}
                onClick={() => void handleLanguageChange(locale)}
              />
            );
          })}
        </Dropdown>

        {/* RTL toggle */}
        <button
          onClick={toggleRTL}
          className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 active:scale-90 ${
            dir === 'rtl'
              ? 'text-accent bg-accent/10'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/10 dark:hover:bg-white/8'
          }`}
          aria-label={`Direction: ${dir}`}
          title={`Direction: ${dir}`}
        >
          <ArrowLeftRight size={14} />
        </button>

        {/* ── Desktop-only controls (hidden on small screens) ──── */}
        <span className="hidden md:flex items-center gap-0.5 ms-1 ps-1.5 border-s border-white/10 dark:border-white/5">
          {/* Keyboard shortcuts */}
          <button
            onClick={handleToggleShortcuts}
            className="flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/10 dark:hover:bg-white/8 transition-colors"
            title={t('common.keyboardShortcuts', 'Keyboard Shortcuts')}
          >
            <Keyboard size={14} />
          </button>

          {/* Window controls (hidden on macOS) */}
          {!isMac && showWindowControls && (
            <>
              <button
                onClick={handleMinimize}
                className="flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:bg-white/10 dark:hover:bg-white/8 transition-colors"
                title={t('common.minimize')}
              >
                <Minus size={13} />
              </button>
              <button
                onClick={handleMaximize}
                className="flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:bg-white/10 dark:hover:bg-white/8 transition-colors"
                title={maximized ? t('common.restore') : t('common.maximize')}
              >
                {maximized ? <Copy size={11} /> : <Square size={11} />}
              </button>
              <button
                onClick={handleClose}
                className="flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:bg-danger hover:text-white transition-colors"
                title={t('common.close')}
              >
                <X size={13} />
              </button>
            </>
          )}
        </span>
      </div>
    </header>
  );
}
