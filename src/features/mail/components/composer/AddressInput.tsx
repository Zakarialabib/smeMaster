import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@shared/components/ui/Button";
import { searchContacts, type DbContact } from "@features/contacts/db/contacts.ts";

export interface ContactLookupInfo {
  displayName: string | null;
}

interface AddressInputProps {
  label: string;
  addresses: string[];
  onChange: (addresses: string[]) => void;
  placeholder?: string;
  /** Map of email → contact lookup results to show alongside address chips */
  contactInfo?: Record<string, ContactLookupInfo | null>;
  /** Whether this is a "new" composer mode (shows org badges) */
  isNewMode?: boolean;
}

export function AddressInput({
  label,
  addresses,
  onChange,
  placeholder = "Add recipients...",
  contactInfo,
  isNewMode = false,
}: AddressInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<DbContact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (value.length >= 2) {
        searchTimerRef.current = setTimeout(async () => {
          const results = await searchContacts(value, 5);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setSelectedIdx(-1);
        }, 200);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [],
  );

  const addAddress = useCallback(
    (address: string) => {
      const trimmed = address.trim();
      if (trimmed && !addresses.includes(trimmed)) {
        onChange([...addresses, trimmed]);
      }
      setInputValue("");
      setSuggestions([]);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [addresses, onChange],
  );

  const removeAddress = useCallback(
    (index: number) => {
      onChange(addresses.filter((_, i) => i !== index));
    },
    [addresses, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (showSuggestions && selectedIdx >= 0) {
        addAddress(suggestions[selectedIdx]!.email);
      } else if (inputValue.trim()) {
        addAddress(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && addresses.length > 0) {
      removeAddress(addresses.length - 1);
    } else if (e.key === "ArrowDown" && showSuggestions) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && showSuggestions) {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-text-tertiary pt-1.5 w-8 shrink-0">
        {label}
      </span>
      <div className="flex-1 flex flex-wrap items-center gap-1 min-h-[32px] relative">
        {addresses.map((addr) => {
          const info = contactInfo?.[addr];
          return (
            <span
              key={addr}
              className="inline-flex items-center gap-1 bg-accent-light text-accent text-xs px-2 py-0.5 rounded-full"
            >
              <span className="flex items-center gap-1.5">
                <span className="max-w-[160px] truncate" title={addr}>
                  {addr}
                </span>
                {info?.displayName && (
                  <span className="inline-flex items-center gap-1 text-text-tertiary font-medium">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <circle cx="5" cy="5" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
                    </svg>
                    <span className="truncate max-w-[100px]" title={info.displayName}>
                      {info.displayName}
                    </span>
                  </span>
                )}
                {isNewMode && info?.displayName && (
                  <span className="inline-flex items-center gap-0.5 text-[0.625rem] text-text-tertiary/60 border-l border-border-secondary pl-1.5 ml-0.5">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                      <rect x="1" y="2" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="0.8" fill="none" />
                      <path d="M2 2V1.5C2 1.22 2.22 1 2.5 1h3C5.78 1 6 1.22 6 1.5V2" stroke="currentColor" strokeWidth="0.8" fill="none" />
                    </svg>
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => onChange(addresses.filter((a) => a !== addr))}
                className="h-auto w-auto p-0 text-[0.625rem] leading-none hover:text-danger"
              >
                ×
              </Button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Delay to allow click on suggestion
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
            blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150);
            if (inputValue.trim()) addAddress(inputValue);
          }}
          placeholder={addresses.length === 0 ? placeholder : ""}
          aria-label={label}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />

        {/* Autocomplete dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 mt-1 w-full bg-bg-primary border border-border-primary rounded-md shadow-lg z-50 py-1">
            {suggestions.map((contact, i) => (
              <button
                key={contact.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addAddress(contact.email)}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-hover ${
                  i === selectedIdx ? "bg-bg-hover" : ""
                }`}
              >
                <div className="text-text-primary">
                  {contact.display_name ?? contact.email}
                </div>
                {contact.display_name && (
                  <div className="text-xs text-text-tertiary">
                    {contact.email}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

