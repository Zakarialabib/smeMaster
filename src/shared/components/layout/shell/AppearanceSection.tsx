import { ThemeTile, type ThemeMode } from "@features/settings/components/cards/ThemeTile";
import {
  ColorPickerCircle,
} from "@features/settings/components/cards/ColorPickerCircle";

export interface AppearanceSectionProps {
  currentTheme: ThemeMode;
  currentAccent: string;
  onThemeChange: (mode: ThemeMode) => void;
  onAccentChange: (color: string) => void;
}

const PRESET_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
] as const;

export function AppearanceSection({
  currentTheme,
  currentAccent,
  onThemeChange,
  onAccentChange,
}: AppearanceSectionProps) {
  return (
    <section className="space-y-6">
      {/* Theme selection */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          Appearance
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {(["light", "dark", "system"] as const).map((mode) => (
            <ThemeTile
              key={mode}
              mode={mode}
              selected={currentTheme === mode}
              onSelect={onThemeChange}
            />
          ))}
        </div>
      </div>

      {/* Accent color selection */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
          Accent Color
        </h3>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <ColorPickerCircle
              key={color}
              color={color}
              selected={currentAccent === color}
              onSelect={onAccentChange}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

