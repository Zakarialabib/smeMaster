import { ThemeTile, type ThemeMode } from "@features/settings/components/cards/ThemeTile";
import {
  ColorPickerCircle,
} from "@features/settings/components/cards/ColorPickerCircle";

export interface AppearanceSectionProps {
  currentTheme: ThemeMode;
  currentAccent: string;
  onThemeChange: (mode: ThemeMode) => void;
  onAccentChange: (color: string) => void;
  currentSurface?: "flat" | "glass";
  onSurfaceChange?: (surface: "flat" | "glass") => void;
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
  currentSurface = "flat",
  onSurfaceChange,
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

      {/* Surface style: Flat (default) vs Glass */}
      {onSurfaceChange && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Surface
          </h3>
          <div className="flex gap-3">
            {([
              { id: "flat", label: "Flat" },
              { id: "glass", label: "Glass" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSurfaceChange(opt.id)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  currentSurface === opt.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-primary text-[var(--text-secondary)] hover:bg-bg-hover"
                }`}
                aria-pressed={currentSurface === opt.id}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Glass adds frosted orbs and blur for a richer look.
          </p>
        </div>
      )}
    </section>
  );
}

