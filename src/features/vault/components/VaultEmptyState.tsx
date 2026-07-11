import { Folder, Upload } from "lucide-react";
import { EmptyState } from "@shared/components/ui/EmptyState";

interface VaultEmptyStateProps {
  onUpload: () => void;
}

export function VaultEmptyState({ onUpload }: VaultEmptyStateProps) {
  return (
    <EmptyState
      icon={Folder}
      title="No files yet"
      subtitle="Upload files to your encrypted vault to keep them safe and accessible across devices."
      action={
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
        >
          <Upload size={13} aria-hidden="true" />
          Upload a file
        </button>
      }
    />
  );
}
