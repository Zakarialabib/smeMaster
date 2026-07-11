import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CSSTransition } from "react-transition-group";
import { useLayoutStore } from "@shared/stores/layoutStore";
import { useThemeStore } from "@shared/stores/themeStore";
import { useComposerStore } from "@features/mail/stores/composerStore";
import { useThreadStore } from "@features/mail/stores/threadStore";
import { useAccountStore } from "@features/accounts/stores/accountStore";
import { getGmailClient } from "@features/mail/services/gmail/tokenManager";
import { getTemplatesForAccount, type DbTemplate } from "@features/mail/db/templates";
import { useActiveLabel } from "@shared/hooks/useRouteNavigation";
import { navigateToLabel, navigateBack, getSelectedThreadId } from "@/router/navigate";
import { SearchX, Lightbulb } from "lucide-react";
import { usePlatform } from "@shared/hooks/usePlatform";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const { screen } = usePlatform();
  const isMobile = screen.category === "phone" || screen.category === "phone-folded";
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const setTheme = useThemeStore((s) => s.setTheme);
  const openComposer = useComposerStore((s) => s.openComposer);
  const activeLabel = useActiveLabel();
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);

  useEffect(() => {
    if (!isOpen || !activeAccountId) return;
    getTemplatesForAccount(activeAccountId).then(setTemplates);
  }, [isOpen, activeAccountId]);

  const commands: Command[] = useMemo(() => [
    // Navigation
    { id: "go-inbox", label: t('search.goToInbox'), shortcut: "g i", category: t('search.nav'), action: () => { navigateToLabel("inbox"); onClose(); } },
    { id: "go-starred", label: t('search.goToStarred'), shortcut: "g s", category: t('search.nav'), action: () => { navigateToLabel("starred"); onClose(); } },
    { id: "go-sent", label: t('search.goToSent'), shortcut: "g t", category: t('search.nav'), action: () => { navigateToLabel("sent"); onClose(); } },
    { id: "go-drafts", label: t('search.goToDrafts'), shortcut: "g d", category: t('search.nav'), action: () => { navigateToLabel("drafts"); onClose(); } },
    { id: "go-snoozed", label: t('search.goToSnoozed'), category: t('search.nav'), action: () => { navigateToLabel("snoozed"); onClose(); } },
    { id: "go-trash", label: t('search.goToTrash'), category: t('search.nav'), action: () => { navigateToLabel("trash"); onClose(); } },
    { id: "go-all", label: t('search.goToAllMail'), category: t('search.nav'), action: () => { navigateToLabel("all"); onClose(); } },

    // Actions
    { id: "compose", label: t('search.composeNewEmail'), shortcut: "c", category: t("filter.actions"), action: () => { openComposer(); onClose(); } },
    { id: "deselect", label: t('search.closeThread'), shortcut: "Esc", category: t("filter.actions"), action: () => { navigateBack(); onClose(); } },
    { id: "spam", label: activeLabel === "spam" ? t("email.notSpam") : t("email.reportSpam"), shortcut: "!", category: t("filter.actions"), action: async () => {
      onClose();
      const selectedId = getSelectedThreadId();
      const accountId = useAccountStore.getState().activeAccountId;
      if (!selectedId || !accountId) return;
      try {
        const client = await getGmailClient(accountId);
        if (activeLabel === "spam") {
          await client.modifyThread(selectedId, ["INBOX"], ["SPAM"]);
        } else {
          await client.modifyThread(selectedId, ["SPAM"], ["INBOX"]);
        }
        useThreadStore.getState().removeThread(selectedId);
      } catch (err) {
        console.error("Spam action failed:", err);
      }
    } },

    // Tasks
    { id: "task-create", label: t('search.createTask'), category: t('tasks.tasks'), action: () => {
      onClose();
      useLayoutStore.getState().setTaskSidebarVisible(true);
    } },
    { id: "task-extract", label: t('search.createTaskFromEmail'), shortcut: "t", category: t('tasks.tasks'), action: () => {
      onClose();
      const threadId = getSelectedThreadId();
      if (threadId) {
        window.dispatchEvent(new CustomEvent("smemaster-extract-task", { detail: { threadId } }));
      }
    } },
    { id: "task-view", label: t('search.viewTasks'), shortcut: "g k", category: t('tasks.tasks'), action: () => { navigateToLabel("tasks"); onClose(); } },
    { id: "task-toggle-panel", label: t('search.toggleTaskPanel'), category: t('tasks.tasks'), action: () => { useLayoutStore.getState().toggleTaskSidebar(); onClose(); } },

    // AI
    { id: "ask-ai", label: t('search.askAiAboutInbox'), category: t('search.ai'), action: () => { onClose(); window.dispatchEvent(new Event("smemaster-toggle-ask-inbox")); } },

    // Settings
    { id: "toggle-sidebar", label: t('search.toggleSidebar'), shortcut: "Ctrl+Shift+E", category: t('search.settings'), action: () => { toggleSidebar(); onClose(); } },
    { id: "theme-light", label: t('search.switchToTheme', { theme: t('settings.light') }), category: t('search.settings'), action: () => { setTheme("light"); onClose(); } },
    { id: "theme-dark", label: t('search.switchToTheme', { theme: t('settings.dark') }), category: t('search.settings'), action: () => { setTheme("dark"); onClose(); } },
    { id: "theme-system", label: t('search.switchToTheme', { theme: t('settings.tabGroupSystem') }), category: t('search.settings'), action: () => { setTheme("system"); onClose(); } },

    // Templates
    ...templates.map((tmpl) => ({
      id: `template-${tmpl.id}`,
      label: t('search.insertTemplate', { name: tmpl.name }),
      category: t('search.templates'),
      action: () => {
        openComposer({
          mode: "new" as const,
          to: [],
          subject: tmpl.subject ?? "",
          bodyHtml: tmpl.body_html,
        });
        onClose();
      },
    })),
  ], [onClose, openComposer, activeLabel, toggleSidebar, setTheme, templates, t]);

  const filtered = query
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((p) => Math.min(p + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIdx]) {
        filtered[selectedIdx].action();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIdx, onClose],
  );

  // Build index map and group by category
  const filteredIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((cmd, idx) => map.set(cmd.id, idx));
    return map;
  }, [filtered]);
  const categories = useMemo(() => [...new Set(filtered.map((c) => c.category))], [filtered]);

  // ── Shortcut learning toast ─────────────────────────────────────────
  const [learnedShortcut, setLearnedShortcut] = useState<string | null>(null);
  const [learnedLabel, setLearnedLabel] = useState<string | null>(null);
  const learnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeWithLearning = useCallback((cmd: Command) => {
    // If the command has a shortcut, show a learning hint
    if (cmd.shortcut) {
      setLearnedShortcut(cmd.shortcut);
      setLearnedLabel(cmd.label);
      if (learnTimerRef.current) clearTimeout(learnTimerRef.current);
      learnTimerRef.current = setTimeout(() => {
        setLearnedShortcut(null);
        setLearnedLabel(null);
      }, 3000);
    }
    cmd.action();
  }, []);

  return (
    <CSSTransition nodeRef={overlayRef} in={isOpen} timeout={200} classNames="modal" unmountOnExit>
    <div ref={overlayRef} className={`fixed inset-0 z-[60] flex ${isMobile ? "items-end justify-center" : "items-start justify-center pt-[15vh]"}`}>
      <div className="absolute inset-0 bg-black/30 glass-backdrop" onClick={onClose} />
      <div className={`${isMobile ? "fixed bottom-0 left-0 right-0 rounded-t-2xl max-h-[70vh]" : "absolute top-12 left-1/2 -translate-x-1/2 w-[480px] rounded-lg"} bg-bg-primary border border-border-primary glass-modal w-full overflow-hidden modal-panel`}>
        {/* Input */}
        <div className="px-4 py-3 border-b border-border-primary">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('search.typeACommand')}
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>

        {/* Shortcut learning toast */}
        {learnedShortcut && (
          <div className="px-4 py-2 bg-accent/10 border-b border-accent/20 animate-slide-down">
            <div className="flex items-center gap-2 text-xs">
              <Lightbulb size={12} className="text-accent shrink-0" />
              <span className="text-text-secondary">
                Tip: Use <kbd className="px-1.5 py-0.5 rounded font-mono text-[0.625rem] bg-bg-tertiary border border-border-secondary text-accent">{learnedShortcut}</kbd> for "{learnedLabel}"
              </span>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
              <SearchX size={32} className="text-text-tertiary/50 mb-2" />
              <p className="text-sm text-text-tertiary">{t('search.noCommandsFound')}</p>
              <p className="text-xs text-text-tertiary/60 mt-1">{t('search.tryDifferentKeywords')}</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat}>
                <div className="px-4 py-1 text-[0.625rem] font-semibold uppercase tracking-wider text-text-tertiary">
                  {cat}
                </div>
                {filtered
                  .filter((c) => c.category === cat)
                  .map((cmd) => {
                    const globalIdx = filteredIndexMap.get(cmd.id) ?? -1;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => executeWithLearning(cmd)}
                        className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-bg-hover text-sm ${
                          isMobile ? "min-h-[44px]" : ""
                        } ${
                          globalIdx === selectedIdx ? "bg-accent/10 ring-1 ring-accent/30" : ""
                        }`}
                      >
                        <span className="text-text-primary">{cmd.label}</span>
                        {cmd.shortcut ? (
                          <kbd className="text-[0.625rem] text-accent bg-accent/8 border border-accent/25 px-1.5 py-0.5 rounded font-mono">
                            {cmd.shortcut}
                          </kbd>
                        ) : (
                          <span className="text-[0.5rem] text-text-tertiary italic">
                            no shortcut
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border-primary bg-bg-secondary/50">
          <div className="flex items-center justify-center gap-3 text-[0.625rem] text-text-tertiary">
            <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">↑↓</kbd> {t('search.navigate')}</span>
            <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">↵</kbd> {t('search.select')}</span>
            <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">Esc</kbd> {t('common.close')}</span>
            <span className="text-[0.5rem] text-text-tertiary/60">
              Commands with <kbd className="text-accent bg-accent/8 px-1 py-0.5 rounded font-mono">shortcuts</kbd> can be triggered via keyboard
            </span>
          </div>
        </div>
      </div>
    </div>
    </CSSTransition>
  );
}


