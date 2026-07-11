/**
 * RagSearchBar — Frosted glass search input for the AI Assistant.
 *
 * Full-width, tall glass input with auto-focus and submit-on-Enter.
 *
 * @module
 */

import { type FormEvent, type KeyboardEvent, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@shared/utils/cn";

// ── Props ────────────────────────────────────────────────────────────────────

export interface RagSearchBarProps {
  /** Current query value */
  value: string;
  /** Called on every keystroke */
  onChange: (value: string) => void;
  /** Called when the user submits a query */
  onSubmit: (query: string) => void;
  /** Whether a search is in flight */
  disabled?: boolean;
  /** Optional placeholder override */
  placeholder?: string;
  /** Additional classes */
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RagSearchBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask anything about your emails, files, and vault…",
  className,
}: RagSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative w-full", className)}>
      {/* Search icon */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        {disabled ? (
          <Loader2 className="w-5 h-5 text-text-tertiary animate-spin" />
        ) : (
          <Search className="w-5 h-5 text-text-tertiary" />
        )}
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Search your knowledge base"
        className={cn(
          "w-full h-12 pl-12 pr-4",
          "text-text-primary text-base",
          "bg-white/80 dark:bg-white/8",
          "backdrop-blur-[--glass-blur-heavy]",
          "border border-white/30 dark:border-white/10",
          "rounded-[--frost-radius]",
          "placeholder:text-text-tertiary",
          "focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30",
          "transition-all duration-200",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      />
    </form>
  );
}
