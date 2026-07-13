import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShortcutStore } from "@features/settings/stores/shortcutStore";
import { SHORTCUTS, getDefaultKeyMap } from "@/constants/shortcuts";
import { registerComposeShortcut, getCurrentShortcut, DEFAULT_SHORTCUT } from "@shared/services/globalShortcut";
import { Button } from "@shared/components/ui/Button";
import { SettingGroup } from "@features/settings/components/SettingsHelpers";
import { HelpCard } from "@features/settings/components/HelpCard";
import { usePlatform } from "@shared/hooks/usePlatform";

/** Format a shortcut string using platform-appropriate symbols */
function formatShortcut(shortcut: string): string {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  return shortcut
    .replace(/CmdOrCtrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/CommandOrControl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Command/g, "⌘")
    .replace(/Ctrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Shift/g, "⇧")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/Meta/g, isMac ? "⌘" : "Win");
}

export default function ShortcutsTab() {
  const keyMap = useShortcutStore((s) => s.keyMap);
  const setKey = useShortcutStore((s) => s.setKey);
  const resetKey = useShortcutStore((s) => s.resetKey);
  const resetAll = useShortcutStore((s) => s.resetAll);
  const defaults = getDefaultKeyMap();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [composeShortcut, setComposeShortcut] = useState(DEFAULT_SHORTCUT);
  const [recordingGlobal, setRecordingGlobal] = useState(false);
  const globalRecorderRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const current = getCurrentShortcut();
    if (current) setComposeShortcut(current);
  }, []);

  const handleGlobalRecord = useCallback((e: React.KeyboardEvent) => {
    if (!recordingGlobal) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    const key = e.key;
    if (key !== "Control" && key !== "Meta" && key !== "Shift" && key !== "Alt") {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      const shortcut = parts.join("+");
      setComposeShortcut(shortcut);
      setRecordingGlobal(false);
      registerComposeShortcut(shortcut).catch((err) => {
        console.error("Failed to register shortcut:", err);
      });
    }
  }, [recordingGlobal]);

  const handleKeyRecord = useCallback((e: React.KeyboardEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    const key = e.key;
    if (key === "Control" || key === "Meta" || key === "Shift" || key === "Alt") return;

    if (parts.length > 0) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
    } else {
      parts.push(key);
    }

    setKey(id, parts.join("+"));
    setRecordingId(null);
  }, [setKey]);

  const hasCustom = Object.entries(keyMap).some(([id, keys]) => defaults[id] !== keys);
  const platform = usePlatform();

  const { t } = useTranslation();
  return (
    <>
      {/* Platform info hint */}
      <div className="flex items-center gap-2 px-1 py-2 mb-2 text-xs text-text-tertiary bg-bg-tertiary/50 rounded-lg">
        <span>⌘ = Cmd</span>
        <span>⌥ = Alt</span>
        <span>⇧ = Shift</span>
        <span>⌃ = Ctrl</span>
        <span className="ms-auto text-text-tertiary/60">{platform.os === "macos" ? "macOS" : platform.os === "windows" ? "Windows" : "Linux"}</span>
      </div>

      <SettingGroup title={t('settings.globalShortcut')}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-text-secondary">{t('settings.quickCompose')}</span>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t('settings.quickComposeDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="text-xs bg-bg-tertiary px-2 py-1 rounded border border-border-primary font-mono min-w-16 text-center">
              {formatShortcut(composeShortcut)}
            </kbd>
            <Button
              ref={globalRecorderRef}
              variant={recordingGlobal ? "primary" : "secondary"}
              size="xs"
              onClick={() => setRecordingGlobal(true)}
              onKeyDown={handleGlobalRecord}
              onBlur={() => setRecordingGlobal(false)}
            >
              {recordingGlobal ? t('settings.pressKeys') : t('settings.change')}
            </Button>
          </div>
        </div>
      </SettingGroup>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-tertiary">
          {t('settings.shortcutsDescription')}
        </p>
        {hasCustom && (
          <Button
            variant="ghost"
            size="xs"
            onClick={resetAll}
            className="shrink-0 ms-4"
          >
            {t('settings.resetAll')}
          </Button>
        )}
      </div>
      {SHORTCUTS.map((section) => (
        <SettingGroup key={section.category} title={section.category}>
          <div className="space-y-1">
            {section.items.map((item) => {
              const currentKey = keyMap[item.id] ?? item.keys;
              const isDefault = currentKey === defaults[item.id];
              const isRecording = recordingId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-1"
                >
                  <span className="text-sm text-text-secondary">
                    {item.desc}
                  </span>
                  <div className="flex items-center gap-2 ms-4 shrink-0">
                    <Button
                      variant={isRecording ? "primary" : "secondary"}
                      size="xs"
                      onClick={() => setRecordingId(isRecording ? null : item.id)}
                      onKeyDown={(e) => {
                        if (isRecording) handleKeyRecord(e, item.id);
                      }}
                      onBlur={() => { if (isRecording) setRecordingId(null); }}
                      className={!isRecording ? "font-mono" : ""}
                    >
                      {isRecording ? t('settings.pressKey') : formatShortcut(currentKey)}
                    </Button>
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="xs"
                        iconOnly
                        onClick={() => resetKey(item.id)}
                        title={t('settings.resetToDefault', { key: defaults[item.id] })}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <HelpCard
            items={[
              { type: "why", text: "Keyboard shortcuts dramatically speed up navigation and common actions, reducing mouse dependency and repetitive strain." },
              { type: "how", text: "Click any shortcut key to start recording — press your desired key combination and it will be saved automatically. Red indicators show custom bindings." },
              { type: "when", text: "Use shortcuts for frequent actions like compose, search, archive, and folder navigation. Customize any binding that doesn't feel natural." },
              { type: "tip", text: "Start with navigation shortcuts (j/k to move, o to open) — they provide the biggest productivity boost." },
            ]}
          />
        </SettingGroup>
      ))}
    </>
  );
}
