import { useState, useMemo } from "react";
import { SHORTCUTS } from "@/constants/shortcuts";
import { useShortcutStore } from "@features/settings/stores/shortcutStore";
import { Modal } from "@shared/components/ui/Modal";
import { Search } from "lucide-react";

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

function getPlatformKey(shortcut: string): string {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  if (isMac) {
    return shortcut
      .replace(/Ctrl\+/gi, "⌘")
      .replace(/Command\+/gi, "")
      .replace(/Option\+/gi, "⌥")
      .replace(/Shift\+/gi, "⇧");
  }
  return shortcut
    .replace(/Command\+/gi, "Ctrl+")
    .replace(/⌘/g, "Ctrl")
    .replace(/⌥/g, "Alt");
}

function getShortcutParts(shortcut: string): { primary: string; hint?: string } {
  const isMac = navigator.platform.toLowerCase().includes("mac");

  // Handle compound shortcuts like "g then i"
  const thenMatch = shortcut.match(/^(.+?)\s+then\s+(.+)$/i);
  if (thenMatch) {
    const prefix = thenMatch[1]!;
    const suffix = thenMatch[2]!;
    return {
      primary: prefix,
      hint: `then ${suffix}`,
    };
  }

  // Handle "Ctrl+A" style shortcuts
  const ctrlMatch = shortcut.match(/^Ctrl\+(.+)$/i);
  if (ctrlMatch) {
    const key = ctrlMatch[1]!;
    return {
      primary: isMac ? `⌘${key}` : `Ctrl+${key}`,
    };
  }

  return { primary: shortcut };
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const keyMap = useShortcutStore((s) => s.keyMap);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SHORTCUTS;

    const q = searchQuery.toLowerCase();
    return SHORTCUTS.map((section) => {
      const matchingItems = section.items.filter(
        (item) =>
          item.desc.toLowerCase().includes(q) ||
          item.keys.toLowerCase().includes(q) ||
          section.category.toLowerCase().includes(q),
      );
      return matchingItems.length > 0
        ? { ...section, items: matchingItems }
        : null;
    }).filter(Boolean) as typeof SHORTCUTS;
  }, [searchQuery]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="lg" width="w-full max-w-lg" zIndex="z-[60]">
      {/* Search bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded-md">
          <Search size={14} className="text-text-tertiary shrink-0" />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
          <kbd className="text-[0.5rem] text-text-tertiary bg-bg-secondary px-1 py-0.5 rounded font-mono border border-border-secondary">
            /
          </kbd>
        </div>
      </div>

      <div className="p-4 max-h-[55vh] overflow-y-auto space-y-4">
        {filteredSections.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-tertiary">
            No shortcuts match "{searchQuery}"
          </div>
        ) : (
          filteredSections.map((section) => (
            <div key={section.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                {section.category}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const displayKey = keyMap[item.id] ?? item.keys;
                  const parts = getShortcutParts(displayKey);
                  const platformKey = getPlatformKey(displayKey);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-bg-hover transition-colors"
                    >
                      <span className="text-sm text-text-secondary">
                        {item.desc}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Primary key */}
                        <kbd className="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded font-mono border border-border-secondary">
                          {parts.primary}
                        </kbd>
                        {parts.hint && (
                          <span className="text-[0.625rem] text-text-tertiary">
                            {parts.hint}
                          </span>
                        )}
                        {/* Windows variant — shown when different from Mac */}
                        {platformKey !== parts.primary && (
                          <kbd className="text-[0.625rem] text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded font-mono border border-border-secondary">
                            {platformKey}
                          </kbd>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend footer */}
      <div className="px-4 py-2 border-t border-border-primary bg-bg-secondary/50">
        <div className="flex items-center justify-center gap-3 text-[0.625rem] text-text-tertiary">
          <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">⌘</kbd> Mac</span>
          <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">Ctrl</kbd> Windows</span>
          <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">⇧</kbd> Shift</span>
          <span><kbd className="text-text-secondary bg-bg-tertiary px-1 py-0.5 rounded font-mono text-[0.5rem]">⌥</kbd> Alt</span>
        </div>
      </div>
    </Modal>
  );
}
