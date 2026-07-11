import { Check } from "lucide-react";

export interface ColorPickerCircleProps {
  color: string;
  selected: boolean;
  onSelect: (color: string) => void;
}

export function ColorPickerCircle({
  color,
  selected,
  onSelect,
}: ColorPickerCircleProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(color)}
      aria-pressed={selected}
      aria-label={`Accent color ${color}`}
className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          selected
            ? "ring-2 ring-accent ring-offset-2"
            : "hover:scale-110"
        }`}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <Check
          size={16}
          className="text-white drop-shadow-sm"
          strokeWidth={3}
        />
      )}
    </button>
  );
}

