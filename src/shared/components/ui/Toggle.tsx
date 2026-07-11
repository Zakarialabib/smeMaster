import { useId } from "react";

type ToggleSize = "sm" | "md";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: ToggleSize;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

const trackSizes: Record<ToggleSize, string> = {
  sm: "w-8 h-4",
  md: "w-11 h-6",
};

const knobSizes: Record<ToggleSize, string> = {
  sm: "w-3 h-3",
  md: "w-5 h-5",
};

const knobTranslate: Record<ToggleSize, string> = {
  sm: "translate-x-4",
  md: "translate-x-5",
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  size = "md",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: ToggleProps) {
  const id = useId();

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent min-h-[44px] ${
          checked ? "bg-accent" : "bg-text-tertiary/30"
        } ${trackSizes[size]}`}
      >
        <span
          className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${knobSizes[size]} ${
            checked ? knobTranslate[size] : "translate-x-0.5"
          }`}
        />
      </button>
      {label && (
        <span className="text-sm text-text-primary select-none">
          {label}
        </span>
      )}
    </label>
  );
}

