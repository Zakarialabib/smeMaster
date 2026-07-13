import { Check } from "lucide-react";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeTileProps {
  mode: ThemeMode;
  selected: boolean;
  onSelect: (mode: ThemeMode) => void;
}

const modeLabel: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeTile({ mode, selected, onSelect }: ThemeTileProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      aria-pressed={selected}
      aria-label={`${modeLabel[mode]} theme`}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-md border-2 transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected
          ? "border-accent bg-accent/5"
          : "border-transparent bg-bg-tertiary hover:border-border-primary"
      }`}
    >
      {/* Preview illustration */}
      <div
        className={`w-full h-16 rounded-md overflow-hidden border ${
          mode === "dark" ? "border-slate-600" : "border-slate-200"
        }`}
      >
        {mode === "light" && (
          <div className="h-full flex flex-col">
            <div className="h-3 bg-white border-b border-slate-200" />
            <div className="flex-1 bg-gray-50 p-1.5 flex flex-col gap-1">
              <div className="h-1.5 w-3/4 rounded-sm bg-slate-200" />
              <div className="h-1.5 w-1/2 rounded-sm bg-slate-100" />
            </div>
          </div>
        )}
        {mode === "dark" && (
          <div className="h-full flex flex-col">
            <div className="h-3 bg-slate-800 border-b border-slate-700" />
            <div className="flex-1 bg-slate-900 p-1.5 flex flex-col gap-1">
              <div className="h-1.5 w-3/4 rounded-sm bg-slate-700" />
              <div className="h-1.5 w-1/2 rounded-sm bg-slate-800" />
            </div>
          </div>
        )}
        {mode === "system" && (
          <div className="h-full flex">
            <div className="w-1/2 flex flex-col">
              <div className="h-3 bg-white border-b border-slate-200" />
              <div className="flex-1 bg-gray-50 p-1.5 flex flex-col gap-1">
                <div className="h-1.5 w-3/4 rounded-sm bg-slate-200" />
                <div className="h-1.5 w-1/2 rounded-sm bg-slate-100" />
              </div>
            </div>
            <div className="w-px bg-slate-300" />
            <div className="w-1/2 flex flex-col">
              <div className="h-3 bg-slate-800 border-b border-slate-700" />
              <div className="flex-1 bg-slate-900 p-1.5 flex flex-col gap-1">
                <div className="h-1.5 w-3/4 rounded-sm bg-slate-700" />
                <div className="h-1.5 w-1/2 rounded-sm bg-slate-800" />
              </div>
            </div>
          </div>
        )}
      </div>

      <span className="text-sm font-medium text-text-primary">
        {modeLabel[mode]}
      </span>

      {/* Checkmark */}
      {selected && (
        <span className="absolute top-2 end-2 flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

