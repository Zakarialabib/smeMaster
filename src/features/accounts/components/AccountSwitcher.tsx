import { useState, useRef, useCallback, useMemo } from "react";
import { useAccountStore, type Account } from "@features/accounts/stores/accountStore";
import { ChevronDown, Check, Plus, UserPlus, RefreshCw, AlertCircle } from "lucide-react";
import { useClickOutside } from "@shared/hooks/useClickOutside";
import { cn } from "@shared/utils/cn";

// ── Types ───────────────────────────────────────────────────────────────

export interface RichAccount {
  id: string;
  email: string;
  displayName: string | null;
  providerType: string;
  syncState: string;
  lastSyncAt: number | null;
  hasError: boolean;
}

interface AccountSwitcherProps {
  collapsed: boolean;
  onAddAccount: () => void;
  /** Optional rich account data. Falls back to accountStore if not provided. */
  accounts?: RichAccount[];
  /** Currently selected account ID */
  selectedId?: string | null;
  /** Called when user selects an account */
  onSelect?: (id: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Map provider string to a short letter badge */
function providerLetter(provider: string): string {
  switch (provider) {
    case "gmail_api":
      return "G";
    case "microsoft_graph":
      return "O";
    case "jmap":
      return "J";
    default:
      return provider[0]?.toUpperCase() ?? "?";
  }
}

/** Tailwind class for the provider badge background */
function providerBadgeClass(provider: string): string {
  switch (provider) {
    case "gmail_api":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
    case "microsoft_graph":
      return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
    case "jmap":
      return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
    default:
      return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
  }
}

/** Format relative time (e.g. "2m ago", "1h ago", "never") */
function relativeTime(timestamp: number | null): string {
  if (timestamp === null || timestamp === undefined) return "never";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 0) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

/** Sync state display config */
const syncStateConfig: Record<
  string,
  { label: string; icon: "spinner" | "alert" | "none" }
> = {
  syncing: { label: "Syncing…", icon: "spinner" },
  error: { label: "Sync error", icon: "alert" },
  backoff: { label: "Backing off", icon: "alert" },
  idle: { label: "Idle", icon: "none" },
};

// ── Sub-components ──────────────────────────────────────────────────────

interface AccountRowProps {
  account: RichAccount;
  isActive: boolean;
  onSelect: (id: string) => void;
}

/** Single account row in the dropdown */
function AccountRow({ account, isActive, onSelect }: AccountRowProps) {
  const letter = providerLetter(account.providerType);
  const syncCfg = syncStateConfig[account.syncState ?? "idle"] ?? { label: "Idle", icon: "none" as const };

  return (
    <button
      key={account.id}
      onClick={() => onSelect(account.id)}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all duration-150",
        isActive
          ? "glass-accent-tint text-accent"
          : "text-text-primary hover:glass-accent-tint",
      )}
    >
      {/* Provider badge + avatar area */}
      <div className="relative shrink-0">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden",
            isActive
              ? "bg-accent text-white"
              : providerBadgeClass(account.providerType),
          )}
        >
          {letter}
        </div>

        {/* Error indicator — red dot */}
        {account.hasError && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-bg-primary"
            aria-label="Sync error"
            title="Sync error"
          />
        )}
      </div>

      {/* Account info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate leading-tight flex items-center gap-1.5">
          {account.displayName || account.email.split("@")[0]}

          {/* Sync state indicator */}
          {syncCfg.icon === "spinner" && (
            <RefreshCw
              size={11}
              className="shrink-0 animate-spin text-accent"
              aria-label={syncCfg.label}
            />
          )}
          {syncCfg.icon === "alert" && (
            <AlertCircle
              size={11}
              className="shrink-0 text-danger"
              aria-label={syncCfg.label}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-secondary truncate leading-tight">
          <span className="truncate">{account.email}</span>
          <span className="text-text-tertiary shrink-0" aria-label="Last sync">
            · {relativeTime(account.lastSyncAt)}
          </span>
        </div>
      </div>

      {/* Active checkmark */}
      {isActive && (
        <Check size={14} className="shrink-0 text-accent" />
      )}
    </button>
  );
}

/** The main avatar shown in the trigger — slightly larger */
function ActiveAvatar({ account }: { account: RichAccount | Account | undefined }) {
  if (!account) return null;

  const letter = "providerType" in account
    ? providerLetter(account.providerType)
    : (account.displayName?.[0] ?? account.email[0] ?? "?").toUpperCase();

  return (
    <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0 text-sm font-semibold overflow-hidden">
      {letter}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function AccountSwitcher({
  collapsed,
  onAddAccount,
  accounts: richAccountsProp,
  selectedId: selectedIdProp,
  onSelect: onSelectProp,
}: AccountSwitcherProps) {
  const storeAccounts = useAccountStore((s) => s.accounts);
  const storeActiveId = useAccountStore((s) => s.activeAccountId);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(dropdownRef, () => setOpen(false));

  // Use rich accounts if provided, otherwise convert store accounts
  const effectiveAccounts: RichAccount[] = useMemo(() => {
    if (richAccountsProp) return richAccountsProp;
    return storeAccounts.map((a) => ({
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      providerType: a.provider ?? "imap",
      syncState: "idle",
      lastSyncAt: null,
      hasError: false,
    }));
  }, [richAccountsProp, storeAccounts]);

  const effectiveSelectedId = selectedIdProp ?? storeActiveId;
  const effectiveOnSelect = onSelectProp ?? setActiveAccount;

  const activeAccount = effectiveAccounts.find((a) => a.id === effectiveSelectedId);

  const handleSwitch = useCallback(
    (id: string) => {
      effectiveOnSelect(id);
      setOpen(false);
    },
    [effectiveOnSelect],
  );

  const handleAdd = useCallback(() => {
    onAddAccount();
    setOpen(false);
  }, [onAddAccount]);

  // No accounts — prompt to add
  if (effectiveAccounts.length === 0) {
    return (
      <div className="p-3">
        <button
          onClick={onAddAccount}
          className={cn(
            "flex items-center w-full rounded-lg p-2 text-sm text-sidebar-text/70 hover:bg-sidebar-hover hover:text-sidebar-text transition-colors",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <UserPlus size={16} className="text-accent" />
          </div>
          {!collapsed && <span className="font-medium">Add Account</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="relative p-2" ref={dropdownRef}>
      {/* Trigger button and add button container */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center flex-1 rounded-lg p-1.5 transition-all duration-150",
            collapsed ? "justify-center" : "gap-2.5",
            open ? "glass-accent-tint" : "hover:glass-accent-tint",
          )}
        >
          <ActiveAvatar account={activeAccount} />
          {!collapsed && activeAccount && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-sidebar-text truncate leading-tight">
                  {activeAccount.displayName || activeAccount.email.split("@")[0]}
                </div>
                <div className="text-xs text-sidebar-text/50 truncate leading-tight">
                  {activeAccount.email}
                </div>
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "shrink-0 text-sidebar-text/40 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </>
          )}
        </button>
        {!collapsed && activeAccount && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddAccount();
            }}
            className={cn(
              "shrink-0 w-6 h-6 rounded-md flex items-center justify-center",
              "text-sidebar-text/50 hover:text-accent hover:glass-accent-tint transition-all duration-150",
            )}
            aria-label="Add account"
            title="Add account"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 py-1 rounded-lg glass-dropdown animate-in fade-in duration-100",
            collapsed ? "left-full ml-1 top-0 w-64" : "left-2 right-2",
          )}
        >
          {effectiveAccounts.length > 1 && (
            <div className="px-3 py-1.5 text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider">
              Accounts
            </div>
          )}

          {effectiveAccounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isActive={account.id === effectiveSelectedId}
              onSelect={handleSwitch}
            />
          ))}

          <div className="border-t border-border-primary my-1" />
          <button
            onClick={handleAdd}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-text-secondary hover:glass-accent-tint hover:text-text-primary transition-all duration-150"
          >
            <div className="w-7 h-7 rounded-full bg-bg-tertiary flex items-center justify-center shrink-0">
              <Plus size={14} />
            </div>
            <span>Add account</span>
          </button>
        </div>
      )}
    </div>
  );
}
