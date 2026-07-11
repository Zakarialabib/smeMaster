import { useState, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";
import { useVaultStore } from "../stores/vaultStore";

interface VaultSearchBarProps {
  className?: string;
}

export function VaultSearchBar({ className = "" }: VaultSearchBarProps) {
  const { searchQuery, setSearchQuery, executeSearch, clearSearch } =
    useVaultStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim()) {
          executeSearch(value);
        } else {
          clearSearch();
        }
      }, 300);
    },
    [executeSearch, clearSearch],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setLocalQuery("");
    setSearchQuery("");
    clearSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClear();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={localQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search files..."
        className="w-full pl-8 pr-8 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded-md border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent placeholder:text-text-tertiary transition-colors"
        aria-label="Search vault files"
      />
      {localQuery && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
