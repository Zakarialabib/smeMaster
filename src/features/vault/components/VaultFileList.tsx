import { VaultFileCard } from "./VaultFileCard";
import type { VaultFileItem } from "../stores/vaultStore";

interface VaultFileListProps {
  entries: VaultFileItem[];
  viewMode: "grid" | "list";
  onNavigate: (path: string) => void;
  onPreview: (entry: VaultFileItem) => void;
  onDelete: (path: string) => void;
  selectionMode?: boolean;
  selectedPaths?: string[];
  onToggleSelect?: (path: string) => void;
}

export function VaultFileList({
  entries,
  viewMode,
  onNavigate,
  onPreview,
  onDelete,
  selectionMode = false,
  selectedPaths = [],
  onToggleSelect,
}: VaultFileListProps) {
  if (entries.length === 0) return null;

  if (viewMode === "grid") {
    return (
      <div
        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-3"
        role="list"
        aria-label="Vault files"
      >
        {entries.map((entry, idx) => (
          <VaultFileCard
            key={entry.path}
            entry={entry}
            viewMode="grid"
            onNavigate={onNavigate}
            onPreview={onPreview}
            onDelete={onDelete}
            selectionMode={selectionMode}
            isSelected={selectedPaths.includes(entry.path)}
            onToggleSelect={onToggleSelect}
            index={idx}
          />
        ))}
      </div>
    );
  }

  return (
    <div role="list" aria-label="Vault files">
      {entries.map((entry, idx) => (
        <VaultFileCard
          key={entry.path}
          entry={entry}
          viewMode="list"
          onNavigate={onNavigate}
          onPreview={onPreview}
          onDelete={onDelete}
          selectionMode={selectionMode}
          isSelected={selectedPaths.includes(entry.path)}
          onToggleSelect={onToggleSelect}
          index={idx}
        />
      ))}
    </div>
  );
}
